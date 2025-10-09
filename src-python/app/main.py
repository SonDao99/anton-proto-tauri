from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup LangGraph workflow
workflow = StateGraph(state_schema=MessagesState)

model = ChatOpenAI(
    model=os.getenv('OPENROUTER_MODEL', 'meta-llama/llama-3.1-8b-instruct:free'),
    base_url='https://openrouter.ai/api/v1',
    api_key=os.getenv('OPENROUTER_API_KEY'),
    temperature=0.7,
)

def call_model(state: MessagesState):
    response = model.invoke(state['messages'])
    return {'messages': response}

workflow.add_node('model', call_model)
workflow.add_edge(START, 'model')

memory = MemorySaver()
graph_app = workflow.compile(checkpointer=memory)

@app.websocket("/ws/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    await websocket.accept()
    print(f"WebSocket connected: {thread_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            print(f"Received message: {message_data['message']}")
            
            config = {'configurable': {'thread_id': thread_id}}
            queue = Queue()
            
            def run_stream():
                try:
                    print("[LG] Starting stream...")
                    last_message_content = ""
                    
                    for event in graph_app.stream(
                        {'messages': [HumanMessage(content=message_data['message'])]},
                        config,
                        stream_mode='values',  # Changed from 'messages'
                    ):
                        # Get the last message in the state
                        messages = event.get('messages', [])
                        if messages:
                            last_msg = messages[-1]
                            
                            # Check if it's an assistant message
                            if hasattr(last_msg, 'content') and type(last_msg).__name__ in ['AIMessage', 'AIMessageChunk']:
                                content = last_msg.content
                                
                                # Send only the delta
                                if content and len(content) > len(last_message_content):
                                    delta = content[len(last_message_content):]
                                    print(f"[LG] Sending delta: '{delta[:50]}...'")
                                    queue.put(('chunk', delta))
                                    last_message_content = content
                    
                    print("[LG] Stream complete")
                    queue.put(('done', None))
                except Exception as e:
                    print(f"[LG] ERROR: {e}")
                    import traceback
                    traceback.print_exc()
                    queue.put(('error', str(e)))

            
            # Start streaming in background thread
            threading.Thread(target=run_stream, daemon=True).start()
            
            # Send chunks as they arrive
            stream_active = True
            while stream_active:
                await asyncio.sleep(0.01)
                
                while not queue.empty():
                    msg_type, content = queue.get()
                    
                    if msg_type == 'chunk':
                        await websocket.send_text(json.dumps({
                            'content': content,
                            'type': 'chunk'
                        }))
                    elif msg_type == 'done':
                        print("Sending done signal")
                        await websocket.send_text(json.dumps({'type': 'done'}))
                        stream_active = False
                        break
                    elif msg_type == 'error':
                        print(f"Sending error: {content}")
                        await websocket.send_text(json.dumps({
                            'type': 'error',
                            'content': content
                        }))
                        stream_active = False
                        break
                    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {thread_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    port = 8000
    print(f"PORT:{port}", flush=True)  # To inform Tauri of the port
    sys.stdout.flush()
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=port)
