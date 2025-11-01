import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const pythonDir = join(projectRoot, 'src-python');

// Determine the correct Python executable path based on platform
const isWindows = platform() === 'win32';
const pythonExe = isWindows 
  ? join(pythonDir, '.venv', 'Scripts', 'python.exe')
  : join(pythonDir, '.venv', 'bin', 'python');

const mainScript = join(pythonDir, 'app', 'main.py');

console.log('Starting Python development server...');
console.log('Python executable:', pythonExe);
console.log('Main script:', mainScript);

const proc = spawn(pythonExe, [mainScript], {
  cwd: pythonDir,
  stdio: 'inherit',
  shell: false
});

proc.on('error', (err) => {
  console.error('Failed to start Python process:', err.message);
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
