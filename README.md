# AntonAI Tauri Project - Setup Guide (Cross-Platform)

This guide helps you set up and develop the AntonAI Tauri project on Windows, macOS, or Linux, including the Python FastAPI sidecar and the Tauri frontend.

---

## Prerequisites

- **Node.js** (version 22.12.0+ recommended)
    
    Use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage Node.js versions.
    
- **Rust and Cargo** (latest stable)
    
    Install via [rustup](https://rustup.rs/).
    
- **Python 3.8+**
- **Git**

---

## Project Structure

The Python FastAPI application is located in `src-python/app/main.py`. The project uses a structured approach with the main application code organized within the `app` folder.

---

## Step 1: Clone the repository

```bash
git clone <repository-url>
cd anton-proto-tauri
```

---

## Step 2: Setup Python virtual environment and install dependencies

## Windows (PowerShell)

```bash
cd src-python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## macOS/Linux (bash)

```bash
cd src-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Step 3: Build the Python sidecar executable

## Windows (PowerShell)

```bash
cd src-python
.\.venv\Scripts\pyinstaller.exe --onefile app/main.py
copy dist\main.exe ..\src-tauri\binaries\main.exe
cd ..\src-tauri
node ../scripts/rename-sidecar.js
```

## macOS/Linux (bash)

```bash
cd src-python
source .venv/bin/activate
pyinstaller --onefile app/main.py
cp dist/main ../src-tauri/binaries/main
cd ../src-tauri
node ../scripts/rename-sidecar.js
```

Alternatively, run the npm script that handles this automatically:

```bash
npm run build:sidecar
```

---

## Step 4: Install Node.js dependencies

```bash
npm install
```

---

## Step 5: Run the Tauri app in development mode

You have several options for running the development environment:

- To run only the Tauri frontend: `npm run dev:tauri`
- To run only the Python backend: `npm run dev:python`
- To run both concurrently: `npm run dev:all`

Alternatively, run manually: `npm run tauri dev`

---

## Environment Considerations

- **Windows**
    - Use PowerShell or CMD.
    - You may need to set PowerShell execution policy:
        
        ```bash
        powershellSet-ExecutionPolicy RemoteSigned
        ```
        
- **macOS/Linux**
    - Use Bash-compatible terminal.
    - Use `/` as path separator.
    - Use `source` to activate Python venv.

---

## Troubleshooting Tips

- Verify frontend dev server is running and serving on expected port.
- Confirm Rust and Python toolchains are installed and on PATH.
- Ensure Python sidecar executable is in `src-tauri/binaries` and renamed correctly.
- Check PowerShell execution policy if using Windows PowerShell.
- If window does not open, try running frontend and Tauri dev separately.

---

## Useful Command Summary

| Task | Windows command | macOS/Linux command | NPM Script (Cross-platform) |
| --- | --- | --- | --- |
| Create Python virtual env | `python -m venv .venv` | `python3 -m venv .venv` | - |
| Activate Python virtual env | `.\.venv\Scripts\Activate.ps1` (PowerShell) or `.venv\Scripts\activate.bat` (CMD) | `source .venv/bin/activate` | - |
| Run PyInstaller | `.\.venv\Scripts\pyinstaller.exe --onefile app/main.py` | `pyinstaller --onefile app/main.py` (inside venv) | - |
| Copy executable to binaries | `copy dist\main.exe ..\src-tauri\binaries\main.exe` | `cp dist/main ../src-tauri/binaries/main` | - |
| Rename sidecar executable | `node ../scripts/rename-sidecar.js` | `node ../scripts/rename-sidecar.js` | - |
| Build Python sidecar (automated) | - | - | `npm run build:sidecar` |
| Install Node.js dependencies | `npm install` | `npm install` | `npm install` |
| Run Tauri frontend only | - | - | `npm run dev:tauri` |
| Run Python backend only | - | - | `npm run dev:python` |
| Run both frontend and backend | - | - | `npm run dev:all` |
| Run Tauri app (manual) | `npm run tauri dev` | `npm run tauri dev` | `npm run tauri dev` |

---