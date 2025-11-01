#!/usr/bin/env bash
set -euo pipefail

# Cleanup script for build artifacts created by the AppImage / PyInstaller flow.
# Usage:
#   ./scripts/clean_builds.sh        # show what would be removed (dry run)
#   ./scripts/clean_builds.sh --yes  # actually remove the files
#
# Safe defaults: it prints targets and requires --yes to delete.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Items commonly safe to remove (adjust if you keep other build outputs)
targets=(
  "dist"
  "build"
  "AppDir"
  "appimagetool-x86_64.AppImage"
  "dist/antonai.AppImage"
  "dist/antonai"
  "src-python/antonai.spec"
  "src-python/__pycache__"
  "build"
)

echo "Planned cleanup targets:"
for t in "${targets[@]}"; do
  if [ -e "$t" ]; then
    echo "  - $t"
  fi
done

if [ "${1:-}" = "--yes" ]; then
  echo "Deleting targets..."
  for t in "${targets[@]}"; do
    if [ -e "$t" ]; then
      rm -rf "$t"
      echo "  removed $t"
    fi
  done
  echo "Cleanup complete."
else
  echo ""
  echo "Dry run only — to actually remove these files run:"
  echo "  chmod +x scripts/clean_builds.sh && ./scripts/clean_builds.sh --yes"
fi