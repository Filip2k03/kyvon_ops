#!/usr/bin/env bash
# Build the real Tauri desktop bundle from the repository root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_DIR="${ROOT_DIR}/apps/desktop"

command -v bun >/dev/null 2>&1 || { echo "build-desktop.sh: bun is required" >&2; exit 1; }
test -f "${DESKTOP_DIR}/package.json" || { echo "build-desktop.sh: desktop package is missing" >&2; exit 1; }

cd "${DESKTOP_DIR}"
bun install --frozen-lockfile
exec bun run tauri build "$@"
