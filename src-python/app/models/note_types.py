from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from enum import Enum

class NoteType(str, Enum):
    """Supported medical note types"""
    WARD_ROUND = "ward_round"
    DISCHARGE = "discharge"

class Citation(BaseModel):
    """Citation linking content to source"""
    source_id: str = Field(description="File name or identifier")
    quote: str = Field(description="Exact text from source supporting this information")
    line_number: Optional[int] = Field(None, description="Line number in source file")
    section: Optional[str] = Field(None, description="Section of source document")

class NoteSection(BaseModel):
    """A section of a medical note with citations"""
    title: str
    content: str
    citations: List[Citation] = []

class MedicalNote(BaseModel):
    """Base structure for any medical note"""
    note_type: NoteType
    sections: List[NoteSection]
    metadata: Dict = {}

class MedicalNoteFormatter(ABC):
    """Abstract base class for all note formatters"""
    
    @property
    @abstractmethod
    def note_type(self) -> NoteType:
        """Return the type of note this formatter creates"""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt for this note type"""
        pass
    
    @abstractmethod
    def get_sections(self) -> List[str]:
        """Return required sections for this note type"""
        pass
    
    @abstractmethod
    def format_user_message(self, medical_content: dict[str, str], instruction: str) -> str:
        """Format the user message with medical content"""
        pass
    
    @abstractmethod
    def validate_note(self, note: str) -> bool:
        """Validate the generated note structure"""
        pass
    
    def format_with_citations(self, content: str, citations: List[Citation]) -> str:
        """Format content with inline citations"""
        # Add citation markers like [1], [2] inline
        formatted = content
        for i, citation in enumerate(citations, 1):
            # This is a simplified version - enhance based on your needs
            formatted += f" [{i}]"
        return formatted
