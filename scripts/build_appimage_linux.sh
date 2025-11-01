#!/usr/bin/env bash
set -euo pipefail

# Build an AppImage for the Python sidecar in src-python using PyInstaller.
# Run this on Linux or WSL2. It will:
#  - create a venv
#  - install requirements and pyinstaller
#  - generate a PyInstaller spec file under src-python/antonai.spec
#  - run pyinstaller to produce dist/antonai
#  - create an AppDir and use appimagetool to build antonai.AppImage
#
# Usage: ./scripts/build_appimage_linux.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Root: $ROOT_DIR"
cd "$ROOT_DIR"

if [ "$(uname -s)" != "Linux" ]; then
  echo "Warning: This script is intended for Linux (native or WSL). Continue? (y/N)"
  read -r ans
  if [ "$ans" != "y" ]; then
    echo "Aborting."
    exit 1
  fi
fi

PY_VENV="src-python/.venv"
PY_BIN="$PY_VENV/bin/python"

# Create venv if missing; reuse existing venv to speed up iterative builds.
if [ ! -d "$PY_VENV" ]; then
  echo "Creating venv at $PY_VENV"
  python3 -m venv "$PY_VENV"
else
  echo "Reusing existing venv at $PY_VENV"
fi

# Activate venv
source "$PY_VENV/bin/activate"

# Ensure pip/wheel are up-to-date
pip install --upgrade pip wheel

# Install requirements and pyinstaller only if pyinstaller isn't already available
# or if FORCE_REINSTALL=1 is set in the environment.
if [ "${FORCE_REINSTALL:-0}" = "1" ] || [ ! -x "$PY_VENV/bin/pyinstaller" ]; then
  echo "Installing Python requirements and PyInstaller into venv..."
  pip install --upgrade -r src-python/requirements.txt pyinstaller==5.11.0
else
  echo "PyInstaller already present in venv; skipping pip install. Set FORCE_REINSTALL=1 to force reinstall."
fi

# Create a PyInstaller spec that collects the 'app' package and its submodules.
# Important: the script path must be given relative to pathex (src-python). When
# PyInstaller runs from the repository root it will prepend pathex to the script
# path; using a relative 'app/main.py' avoids duplicating 'src-python/src-python/...'.
SPEC_FILE="src-python/antonai.spec"
cat > "$SPEC_FILE" <<'PYI_SPEC'
# -*- mode: python -*-
import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# SPECPATH is the directory containing this spec file (src-python/)
# Build absolute path to the app directory
app_dir = os.path.join(SPECPATH, 'app')

# Collect everything under the "app" package so we don't miss dynamic imports.
# Note: pathex below points at the src-python directory, and the script path is
# given relative to that directory (app/main.py). This makes the 'app' package
# importable during analysis and allows collect_submodules('app') to work.
# Force-include stdlib/module 'ipaddress' which may be missed by analysis.
# Note: collect_submodules('app') already includes app.services, app.models, etc.
hiddenimports = collect_submodules('app') + ['ipaddress']

# Bundle the local source 'app' directory into the frozen app.
# Use absolute path based on SPECPATH to avoid path resolution issues.
# Format: (source_absolute_path, destination_in_bundle)
datas = [(app_dir, 'app')]

a = Analysis(
    ['app/main.py'],
    pathex=['src-python'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    # Point PyInstaller at our local hooks directory so custom hooks (hook-app.py, etc.)
    # placed under src-python/hooks are picked up during analysis.
    hookspath=['src-python/hooks'],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='antonai',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='antonai',
)
PYI_SPEC

echo "Running PyInstaller with spec: $SPEC_FILE"
# The spec file now includes the src-python/app directory in its datas list,
# so we don't need --add-data here (which would conflict with the .spec file).
pyinstaller "$SPEC_FILE" --noconfirm --clean --distpath dist --workpath build

# Prepare AppDir
APPDIR="AppDir"
rm -rf "$APPDIR" dist/antonai.AppImage
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/icons/hicolor/128x128/apps" "$APPDIR/usr/share/applications"
cp dist/antonai/antonai "$APPDIR/usr/bin/antonai"

# Create a simple .desktop file
cat > "$APPDIR/antonai.desktop" <<'DESK'
[Desktop Entry]
Name=AntonAI Sidecar
Exec=antonai
Icon=antonai
Type=Application
Categories=Utility;
DESK

# Copy a placeholder icon if available
if [ -f "src-tauri/icons/icon.png" ]; then
  convert -resize 128x128 src-tauri/icons/icon.png "$APPDIR/usr/share/icons/hicolor/128x128/apps/antonai.png" || cp src-tauri/icons/icon.png "$APPDIR/usr/share/icons/hicolor/128x128/apps/antonai.png"
fi

# Download appimagetool if missing
APPIMAGETOOL="./appimagetool-x86_64.AppImage"
if [ ! -f "$APPIMAGETOOL" ]; then
  echo "Downloading appimagetool (this is ~10-20MB)"
  wget -O "$APPIMAGETOOL" "https://github.com/AppImage/AppImageKit/releases/download/13/appimagetool-x86_64.AppImage" || \
    curl -L -o "$APPIMAGETOOL" "https://github.com/AppImage/AppImageKit/releases/download/13/appimagetool-x86_64.AppImage" || \
    (echo "Failed to download appimagetool"; exit 1)
  chmod +x "$APPIMAGETOOL"
fi

echo "Creating AppImage..."
"$APPIMAGETOOL" "$APPDIR" dist/antonai.AppImage
echo "Done: dist/antonai.AppImage"

echo "Tip: To reproduce the original ModuleNotFoundError you saw, run the built AppImage and inspect stdout/stderr."
echo "If building on WSL, run the AppImage inside WSL native environment (not Windows)."

exit 0
