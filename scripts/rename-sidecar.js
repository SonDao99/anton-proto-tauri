import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function renameSidecar() {
  const isWindows = process.platform === 'win32';
  const extension = isWindows ? '.exe' : '';
  const rustInfo = (await execa('rustc', ['-vV'])).stdout;
  const targetTripleMatch = /host: (\S+)/.exec(rustInfo);

  if (!targetTripleMatch) {
    console.error('Failed to determine Rust target triple from rustc output.');
    process.exit(1);
  }

  const targetTriple = targetTripleMatch[1];
  const binariesDir = path.resolve(__dirname, '../src-tauri/binaries');
  const oldName = path.join(binariesDir, `main${extension}`);
  const newBasename = `main-${targetTriple}${extension}`;
  const newName = path.join(binariesDir, newBasename);

  if (!fs.existsSync(oldName)) {
    console.error(`Executable not found: ${oldName}`);
    process.exit(1);
  }

  fs.renameSync(oldName, newName);
  console.log(`Renamed ${oldName} to ${newName}`);

  // If CI/local run provided env vars, serialize them into .env next to the binary.
  const envFilePath = path.join(binariesDir, '.env');
  const envEntries = [
    ['OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY],
    ['OPENROUTER_MODEL', process.env.OPENROUTER_MODEL],
  ].filter(([, value]) => value && String(value).length > 0);

  if (envEntries.length && !fs.existsSync(envFilePath)) {
    const envContents = envEntries.map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
    fs.writeFileSync(envFilePath, envContents, { mode: 0o600 });
    console.log(`Wrote ${envEntries.length} environment variable(s) to ${envFilePath}`);
  } else if (!fs.existsSync(envFilePath)) {
    // Fallback: populate demo .env from example if provided.
    const examplePath = path.resolve(__dirname, '../src-python/.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envFilePath);
      console.log(`Copied example env file to ${envFilePath}`);
    }
  }

  // Record the resolved binary name for downstream steps (optional helper).
  const metadataPath = path.join(binariesDir, 'sidecar.json');
  fs.writeFileSync(
    metadataPath,
    JSON.stringify({ targetTriple, binary: newBasename }, null, 2),
    { mode: 0o644 }
  );
  console.log(`Wrote metadata to ${metadataPath}`);
}

renameSidecar().catch(error => {
  console.error(error);
  process.exit(1);
});
