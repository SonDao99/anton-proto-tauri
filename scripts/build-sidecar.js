import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';
import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const pythonDir = join(projectRoot, 'src-python');
const binariesDir = join(projectRoot, 'src-tauri', 'binaries');

// Determine platform-specific settings
const isWindows = platform() === 'win32';
const pyinstallerPath = join(pythonDir, '.venv', 'Scripts', 'pyinstaller.exe');
  
const builtBinary = isWindows
  ? join(pythonDir, 'dist', 'main.exe')
  : join(pythonDir, 'dist', 'main');
  
const targetBinary = isWindows
  ? join(binariesDir, 'main.exe')
  : join(binariesDir, 'main');

console.log('Building Python sidecar...');
console.log('Platform:', platform());
console.log('Python directory:', pythonDir);

try {
  // Ensure binaries directory exists
  if (!existsSync(binariesDir)) {
    mkdirSync(binariesDir, { recursive: true });
  }

  // Run PyInstaller with main.spec
  console.log('Running PyInstaller with main.spec...');
  console.log('PyInstaller path:', pyinstallerPath);
  
  let result;
  if (isWindows) {
    // On Windows with Git Bash, we need to use cmd.exe with /c and proper args
    result = spawnSync(pyinstallerPath, ['main.spec'], {
      cwd: pythonDir,
      stdio: 'inherit',
      shell: true, // Use shell to properly handle Windows paths in Git Bash
    });
  } else {
    // On Unix, run directly
    result = spawnSync('pyinstaller', ['main.spec'], {
      cwd: pythonDir,
      stdio: 'inherit',
    });
  }
  
  if (result.error) {
    throw result.error;
  }
  
  if (result.status !== 0) {
    throw new Error(`PyInstaller exited with code ${result.status}`);
  }

  // Copy the built binary
  console.log(`Copying ${builtBinary} to ${targetBinary}...`);
  copyFileSync(builtBinary, targetBinary);

  // Make executable on Unix
  if (!isWindows) {
    console.log('Setting executable permissions...');
    chmodSync(targetBinary, 0o755);
  }

  console.log('Sidecar built successfully!');
  
  // Run rename-sidecar.js
  console.log('Running rename-sidecar.js...');
  const renameResult = spawnSync('node', ['../scripts/rename-sidecar.js'], {
    cwd: join(projectRoot, 'src-tauri'),
    stdio: 'inherit',
  });
  
  if (renameResult.status !== 0) {
    throw new Error(`rename-sidecar.js exited with code ${renameResult.status}`);
  }

  console.log('Done!');

} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
