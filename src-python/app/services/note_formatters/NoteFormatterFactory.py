from typing import List, Dict, Type
from models.note_types import MedicalNoteFormatter, NoteType
from services.note_formatters import (
    WardRoundFormatter,
)

class NoteFormatterFactory:
    """Factory for creating note formatters based on note type"""
    
    _formatters: Dict[NoteType, Type[MedicalNoteFormatter]] = {
        NoteType.WARD_ROUND: WardRoundFormatter,
    }
    
    @classmethod
    def create(cls, note_type: NoteType) -> MedicalNoteFormatter:
        """Create a formatter instance for the specified note type"""
        formatter_class = cls._formatters.get(note_type)
        if not formatter_class:
            raise ValueError(f"Unknown note type: {note_type}")
        return formatter_class()
    
    @classmethod
    def get_available_types(cls) -> List[NoteType]:
        """Get list of all available note types"""
        return list(cls._formatters.keys())
