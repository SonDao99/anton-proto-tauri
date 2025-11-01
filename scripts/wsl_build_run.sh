#!/usr/bin/env bash
set -euo pipefail
# Usage: open WSL (Ubuntu), cd to the repository root (Windows path mounted under /mnt)
# Example: cd /mnt/c/Users/sonda/Documents/AntonAI/anton-proto-tauri
# Then run: ./scripts/wsl_build_run.sh

echo "Starting AppImage build & run (WSL)"

echo "Installing OS packages (you may be prompted for sudo password)"
sudo apt update
sudo apt install -y python3-venv python3-pip wget libfuse2

# Make the existing build script executable and run it
chmod +x scripts/build_appimage_linux.sh
./scripts/build_appimage_linux.sh

echo "Build finished. Listing dist:"
ls -la dist || true

# Ensure the produced AppImage is executable and run it, capturing logs
if [ -f dist/antonai.AppImage ]; then
  chmod +x dist/antonai.AppImage || true
  echo "Running AppImage and capturing stdout/stderr to run.log..."
  ./dist/antonai.AppImage &> run.log || true
  echo "AppImage run finished. Tail of run.log:"
  tail -n 200 run.log || true
else
  echo "dist/antonai.AppImage not found; check build output above."
fi

# As a faster debug step, run the unpacked dist executable directly to see Python tracebacks
if [ -x dist/antonai/antonai ]; then
  echo "Running dist/antonai/antonai (unpacked executable) to capture stdout/stderr..."
  dist/antonai/antonai &> dist_run.log || true
  echo "Tail of dist_run.log:"
  tail -n 200 dist_run.log || true
fi

echo "Inspecting dist/antonai contents to check if 'app' package was included"
ls -R dist/antonai | sed -n '1,200p'
echo "Searching for 'services' directories inside dist/antonai:"
find dist/antonai -type d -name services -print || true
echo "Searching for import lines referencing 'services' inside dist/antonai:"
grep -R --line-number "from services" dist/antonai || true

echo "To extract AppImage if you prefer manual inspection:"
echo "  ./dist/antonai.AppImage --appimage-extract"
echo "Then inspect the resulting squashfs-root/ directory for bundled Python files."

echo "If 'app/services' is missing, update the PyInstaller spec to include hiddenimports or datas for the 'app' package, rebuild, and retry."

echo "Done."