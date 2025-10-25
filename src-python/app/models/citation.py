from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Citation(BaseModel):
    id: str  # e.g., "nurse-note-20251010-19.43.txt:FINAL REPORT"
    number: int  # Citation number [1], [2], etc.
    filename: str
    section: str
    timestamp: Optional[datetime] = None
    content: str  # Full text of the relevant section
    context: Optional[str] = None

class CitationMap(BaseModel):
    citations: dict[int, Citation]  # Map of number -> Citation
    total_count: int
