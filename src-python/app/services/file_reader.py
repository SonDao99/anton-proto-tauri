from pathlib import Path

class FileReader:
    def __init__(self, directory):
        self.directory = directory
        
    def read_file(self, file_path: Path) -> str:
        try:
            with open(file_path, 'r') as file:
                return file.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return ""

    def read_all_files(self) -> dict[str, str]:
        file_contents = {}
        for file_path in Path(self.directory).glob('*'):
            if file_path.is_file():
                content = self.read_file(file_path)
                file_contents[file_path.name] = content
        
        return file_contents