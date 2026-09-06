#!/usr/bin/env bash
# Install repository dependencies without installing global software or secrets.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/apps/desktop"

usage() {
  cat <<'USAGE'
Usage: scripts/install.sh [--check|--frontend|--all]

  --check     Check required tools and print versions; make no changes.
  --frontend  Install the locked desktop dependencies with Bun.
  --all       Install frontend dependencies (the default).

This script does not install global packages, configure production hosts, or
read secret values. Install Rust, Bun, and platform SDKs using your OS policy.
USAGE
}

check_tool() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; return 1; }
  printf '%s: ' "$1"
  "$1" --version 2>/dev/null | head -n 1 || true
}

mode="all"
case "${1:-}" in
  --check) mode="check" ;;
  --frontend|--all|'') mode="install" ;;
  -h|--help) usage; exit 0 ;;
  *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
esac

check_tool git
check_tool bun
check_tool cargo

if [ "$mode" = "check" ]; then
  echo "environment=ready"
  exit 0
fi

test -f "${FRONTEND_DIR}/bun.lock" || {
  echo "missing frontend lockfile: ${FRONTEND_DIR}/bun.lock" >&2
  exit 1
}
cd "${FRONTEND_DIR}"
bun install --frozen-lockfile
echo "frontend=installed"
