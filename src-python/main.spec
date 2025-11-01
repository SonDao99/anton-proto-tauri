# -*- mode: python -*-
import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# SPECPATH is the directory containing this spec file (src-python/)
# Build absolute path to the app directory
app_dir = os.path.join(SPECPATH, 'app')

# Collect everything under the "app" package so we don't miss dynamic imports.
# This includes app.services, app.models, etc.
# Force-include stdlib module 'ipaddress' which may be missed by analysis.
hiddenimports = collect_submodules('app') + ['ipaddress']

# Bundle the local source 'app' directory into the frozen app.
# Use absolute path based on SPECPATH to avoid path resolution issues.
# Format: (source_absolute_path, destination_in_bundle)
datas = [(app_dir, 'app')]

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    # Point PyInstaller at our local hooks directory so custom hooks are picked up
    hookspath=['hooks'],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Create a single-file executable (onefile mode)
# All binaries, zipfiles, and datas are bundled into the EXE
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
