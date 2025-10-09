import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function renameSidecar() {
  let extension = process.platform === 'win32' ? '.exe' : '';
  const rustInfo = (await execa('rustc', ['-vV'])).stdout;
  const targetTripleMatch = /host: (\S+)/.exec(rustInfo);

  if (!targetTripleMatch) {
    console.error('Failed to determine Rust target triple from rustc output.');
    process.exit(1);
  }

  const targetTriple = targetTripleMatch[1];
  const binariesDir = path.resolve(__dirname, '../src-tauri/binaries');
  const oldName = path.join(binariesDir, `main${extension}`);
  const newName = path.join(binariesDir, `main-${targetTriple}${extension}`);

  if (!fs.existsSync(oldName)) {
    console.error(`Executable not found: ${oldName}`);
    process.exit(1);
  }

  fs.renameSync(oldName, newName);
  console.log(`Renamed ${oldName} to ${newName}`);
}

renameSidecar().catch(error => {
  console.error(error);
  process.exit(1);
});
