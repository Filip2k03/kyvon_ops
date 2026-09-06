#!/usr/bin/env bash
# Package the already-built public web bundle with provenance and a checksum.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION="${KYVON_VERSION:-v4.1.0}"
COMMIT="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)"
DIST_DIR="${ROOT_DIR}/apps/desktop/dist"
OUT_DIR="${ROOT_DIR}/artifacts/web"

case "${1:-}" in
  -h|--help)
    cat <<'USAGE'
Usage: scripts/package-web-release.sh

Package apps/desktop/dist as a versioned tarball and SHA-256 checksum.
Build the frontend first with: (cd apps/desktop && bun run build)
Override the version with KYVON_VERSION=v4.1.0.
USAGE
    exit 0
    ;;
  '') ;;
  *) echo "ERROR: unknown argument: $1 (use --help)" >&2; exit 2 ;;
esac

test -s "${DIST_DIR}/index.html" || {
  echo "ERROR: ${DIST_DIR}/index.html is missing; build the frontend first." >&2
  exit 1
}
command -v tar >/dev/null 2>&1 || { echo "ERROR: tar is required." >&2; exit 1; }
command -v shasum >/dev/null 2>&1 || { echo "ERROR: shasum is required." >&2; exit 1; }

mkdir -p "${OUT_DIR}"
artifact="${OUT_DIR}/kyvonops-web-${VERSION}-${COMMIT}.tar.gz"
checksum="${artifact}.sha256"
tar -czf "${artifact}" -C "${DIST_DIR}" .
(cd "${OUT_DIR}" && shasum -a 256 "$(basename "${artifact}")" > "$(basename "${checksum}")")
printf 'artifact=%s\ncommit=%s\n' "${artifact}" "${COMMIT}"
cat "${checksum}"
