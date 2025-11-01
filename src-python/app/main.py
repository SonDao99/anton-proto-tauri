from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage
import os
from dotenv import load_dotenv
import json
import sys
from queue import Queue
import threading
import asyncio
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from pydantic import BaseModel
import re
from textwrap import dedent
import logging

# Ensure the app package is importable in both development and when frozen by PyInstaller.
# In a PyInstaller onefile binary, files are unpacked to sys._MEIPASS; add that path
# (or the executable directory) so imports like `from services...` still resolve.
if getattr(sys, "frozen", False):
    # If PyInstaller set _MEIPASS, prefer the unpacked bundle location.
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        app_meipass = Path(meipass) / "app"
        sys.path.insert(0, str(app_meipass))
    # Also add the directory containing the frozen executable as a fallback.
    sys.path.insert(0, str(Path(sys.executable).resolve().parent))
else:
    # Normal (source) execution: add the app directory (src-python/app) so relative imports work.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from services.llm.open_router_client import OpenRouterClient
from agents.medical_agent import MedicalAgent
from services.note_formatters.NoteFormatterFactory import NoteFormatterFactory
from services.citations.citation_extractor import CitationExtractor
from models.note_types import NoteType
from services.streams.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent  # e.g., src-python/app
# Use ~/tmp/medical-files on Ubuntu/Linux, fallback to local tmp for dev
if os.getenv("MEDICAL_FILES_DIR"):
    MEDICAL_FILES_DIR = Path(os.getenv("MEDICAL_FILES_DIR")).expanduser().resolve()
else:
    # Default: check home directory first (Ubuntu packaging), then local
    home_medical_dir = Path.home() / "tmp" / "medical-files"
    local_medical_dir = BASE_DIR / "tmp" / "medical_files"
    MEDICAL_FILES_DIR = (
        home_medical_dir if home_medical_dir.exists() else local_medical_dir
    )


def load_environment():
    """
    Load environment variables from sensible locations for both
    development (source checkout) and the packaged PyInstaller binary.

    Priority order (first match wins, override=False to respect existing vars):
      1. Directory of the frozen executable (when running the packaged sidecar)
      2. The source code directory (BASE_DIR)
      3. Current working directory
    """
    candidates = []

    # When running inside the PyInstaller onefile binary.
    if getattr(sys, "frozen", False):
        executable_dir = Path(sys.executable).resolve().parent
        candidates.append(executable_dir / ".env")

    # Source tree (useful for local dev / tests).
    candidates.append(BASE_DIR / ".env")

    # Last fallback: current working directory.
    candidates.append(Path.cwd() / ".env")

    for candidate in candidates:
        try:
            if candidate and candidate.exists():
                load_dotenv(candidate, override=False)
                break
        except Exception as exc:
            logger.warning(f"Failed loading .env from {candidate}: {exc}")


load_environment()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Simple health endpoint so the frontend can poll for readiness before opening a WebSocket.
# Frontend should poll GET /health and wait for a 200 { "status": "ok" } response.
@app.get("/health")
async def health():
    """
    Sidecar readiness probe used by the frontend to avoid WebSocket race conditions.
    """
    return {"status": "ok"}


# Initialize shared components
llm_client = OpenRouterClient()
medical_agent = MedicalAgent()
citation_extractor = CitationExtractor()


class TriggerStreamRequest(BaseModel):
    threadId: str
    docType: str = "ward_round"
    noteOptions: dict = {}


PATCH_RE = re.compile(r"<PATCH>\s*``````\s*</PATCH>", re.IGNORECASE)
MARKDOWN_RE = re.compile(r"<MARKDOWN>\s*``````\s*</MARKDOWN>", re.IGNORECASE)
OUTPUT_SPEC = dedent("""
Output format:
<PATCH>

{
"issues": [
{
"title": "...",
"fields": [
{ "name": "History/Notes", "op": "append|replace", "bullets": ["..."] },
{ "name": "Management", "op": "append|replace", "bullets": ["..."] },
{ "name": "Status", "op": "append|replace", "bullets": ["..."] },
{ "name": "Since last review", "op": "append|replace", "bullets": ["..."] }
]
}
],
"citations": { "Progress": ["[cite:...]"] }
}

text
</PATCH>

<MARKDOWN>""")


async def stream_note_to_ws(thread_id: str, doc_type: str, note_options: dict):
    websocket = await manager.get_socket(thread_id)
    if not websocket:
        return
    try:
        # Build prompts
        note_type = NoteType(doc_type)
        formatter = NoteFormatterFactory.create(note_type)
        medical_dir = Path(os.getenv("MEDICAL_FILES_DIR", str(MEDICAL_FILES_DIR)))
        logger.info(f"Using medical files dir: {medical_dir}")
        medical_content = medical_agent.read_medical_files(medical_dir)
        system_prompt = formatter.get_system_prompt()
        user_message = formatter.format_user_message(
            medical_content,
            note_options.get("instruction", f"Generate {note_type.value} note"),
        )
        messages = medical_agent.build_messages(system_prompt, user_message)

        # Stream deltas to client
        accumulated = ""
        config = {"temperature": 0.3, "model": os.getenv("OPENROUTER_MODEL")}
        for delta in llm_client.stream_chat(messages, config):
            accumulated += delta
            await websocket.send_text(json.dumps({"type": "chunk", "content": delta}))

        # Extract citation data (no HTML conversion)
        citation_map = citation_extractor.extract_citations(
            accumulated, medical_content
        )

        # Send structured data to frontend
        await websocket.send_text(
            json.dumps(
                {
                    "type": "note_complete",
                    "data": {
                        "markdown": accumulated,
                        "citations": {
                            str(num): {
                                "id": cite.id,
                                "number": cite.number,
                                "filename": cite.filename,
                                "section": cite.section,
                                "timestamp": cite.timestamp.isoformat()
                                if cite.timestamp
                                else None,
                                "content": cite.content,
                                "context": cite.context,
                            }
                            for num, cite in citation_map.citations.items()
                        },
                        "citation_count": citation_map.total_count,
                    },
                }
            )
        )

        logger.info(f"Sent note_complete with {citation_map.total_count} citations")
        await websocket.send_text(json.dumps({"type": "done"}))

    except Exception as e:
        logger.error(f"Error in stream_note_to_ws: {e}", exc_info=True)
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(e)}))
        except Exception:
            pass


@app.post("/api/notes/trigger-stream", status_code=status.HTTP_202_ACCEPTED)
async def trigger_stream(req: TriggerStreamRequest):
    ws = await manager.get_socket(req.threadId)
    if not ws:
        raise HTTPException(
            status_code=404, detail="WebSocket not connected for threadId"
        )
    # Launch streaming task tied to this threadId
    await manager.start_stream_task(
        req.threadId,
        stream_note_to_ws(req.threadId, req.docType, req.noteOptions),
    )
    return {"status": "started", "threadId": req.threadId}


manager = ConnectionManager()


@app.websocket("/ws/medical-note/{thread_id}")
async def medical_note_ws(websocket: WebSocket, thread_id: str):
    await websocket.accept()
    await manager.connect(thread_id, websocket)
    try:
        # Keep the socket alive; optional: read control messages if needed
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(thread_id)
    except Exception:
        await manager.disconnect(thread_id)


if __name__ == "__main__":
    port = 8000
    print(f"PORT:{port}", flush=True)  # To inform Tauri of the port
    sys.stdout.flush()
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=port)
