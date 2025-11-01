from pathlib import Path
import os

class FileReader:
    # Default to ~/tmp/medical-files on Ubuntu, fallback to /srv/medical_files
    DEFAULT_DIR = Path.home() / "tmp" / "medical-files"

    def __init__(self, directory: str | None = None):
        # Use provided directory, or fall back to default
        if directory:
            self.directory = Path(directory).expanduser().resolve()
        else:
            self.directory = self.DEFAULT_DIR.expanduser().resolve()
        
    def read_file(self, file_path: Path) -> str:
        try:
            with open(file_path, 'r') as file:
                return file.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return ""

    def read_all_files(self) -> dict[str, str]:
        file_contents: dict[str, str] = {}
        dir_path = Path(self.directory)

        if not dir_path.exists():
            print(f"Directory does not exist: {dir_path}")
            return file_contents

        # Optional: quick permission check (readable)
        if not os.access(str(dir_path), os.R_OK):
            print(f"Insufficient permissions to read directory: {dir_path}")
            return file_contents

        for file_path in dir_path.glob('*'):
            if file_path.is_file():
                content = self.read_file(file_path)
                file_contents[file_path.name] = content
        
        return file_contents