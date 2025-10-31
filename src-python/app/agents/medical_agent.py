from services.file_reader import FileReader
from pathlib import Path
from typing import Dict, List, Tuple

class MedicalAgent:
    """Orchestrates note generation decisions; no direct provider SDK calls."""

    def read_medical_files(self, directory: Path) -> Dict[str, str]:
        fw = FileReader(directory)
        return fw.read_all_files()

    def build_messages(self, system_prompt: str, user_message: str) -> List[dict]:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]


        
    