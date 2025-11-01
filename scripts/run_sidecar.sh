#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

VENV_DIR="src-python/.venv"
PY="$VENV_DIR/bin/python"

echo "Creating venv at $VENV_DIR if missing"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip
if [ -f "src-python/requirements.txt" ]; then
  pip install -r src-python/requirements.txt
fi

echo "Starting sidecar (src-python/app/main.py) and logging to run_sidecar.log"
"$PY" src-python/app/main.py &> run_sidecar.log || true

echo "Tail of run_sidecar.log:"
tail -n 200 run_sidecar.log || true

echo ""
echo "If you see import errors, paste the tail above here. If it starts, you'll see 'PORT:8000' or uvicorn logs."
echo ""
echo "To run in the foreground (interactive), run:"
echo "  source $VENV_DIR/bin/activate && python src-python/app/main.py"

exit 0