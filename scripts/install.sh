#!/usr/bin/env bash
# Workspace helper (--check/--frontend) or fail-closed Linux desktop installer (--desktop).
# Never piped into a shell. Never embeds secrets.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/apps/desktop"
RELEASES_API="https://api.github.com/repos/Filip2k03/kyvon_ops/releases/latest"
INSTALL_DIR="${KYVON_INSTALL_DIR:-${HOME}/.local/bin}"

usage() {
  printf '%s\n' \
    "Usage: scripts/install.sh [--check|--frontend|--all|--desktop]" \
    "" \
    "  --check     Check git, bun, cargo; make no changes." \
    "  --frontend  Install locked desktop JS dependencies with Bun." \
    "  --all       Same as --frontend (default)." \
    "  --desktop   Download a published Linux AppImage, verify SHA-256, install to ~/.local/bin." \
    "" \
    "This script does not pipe remote content into a shell." \
    " --desktop fails closed if GitHub has no matching asset or checksum."
}

check_tool() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; return 1; }
  printf '%s: ' "$1"
  "$1" --version 2>/dev/null | head -n 1 || true
}

err() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

install_desktop() {
  [ "$(uname -s)" = "Linux" ] || err "--desktop currently supports Linux only. Use a published GitHub release asset for macOS or Windows."

  local arch target
  arch="$(uname -m)"
  case "${arch}" in
    x86_64|amd64) target="x86_64" ;;
    aarch64|arm64) target="aarch64" ;;
    *) err "Unsupported architecture: ${arch}" ;;
  esac

  command -v curl >/dev/null 2>&1 || err "curl is required"
  command -v python3 >/dev/null 2>&1 || err "python3 is required to parse the GitHub release JSON"

  local tmp name url sums_url tag
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' EXIT

  log() { printf '[kyvon-install] %s\n' "$*"; }
  log "Querying ${RELEASES_API}"
  curl -fsSL --proto '=https' --tlsv1.2 "${RELEASES_API}" -o "${tmp}/release.json" \
    || err "Could not fetch the latest GitHub release. A 404 means no published release exists yet."

  python3 - "${tmp}/release.json" "${target}" "${tmp}/assets.env" <<'PY' || err "Could not parse GitHub release JSON"
import json, sys
path, target, out = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
tag = data.get("tag_name") or ""
app = sums = None
for a in data.get("assets") or []:
    n = a.get("name") or ""
    u = a.get("browser_download_url") or ""
    lower = n.lower()
    if "appimage" in lower and target.lower() in lower:
        app = (n, u)
    if lower in ("sha256sums", "sha256sums.txt", "sha256sum"):
        sums = (n, u)
with open(out, "w", encoding="utf-8") as f:
    f.write("tag=%s\n" % tag.replace("\n", ""))
    if app and sums:
        f.write("name=%s\n" % app[0].replace("\n", ""))
        f.write("url=%s\n" % app[1].replace("\n", ""))
        f.write("sums_url=%s\n" % sums[1].replace("\n", ""))
PY

  # shellcheck disable=SC1091
  . "${tmp}/assets.env"
  if [ -z "${name:-}" ] || [ -z "${url:-}" ] || [ -z "${sums_url:-}" ]; then
    err "No verified Linux AppImage + SHA256SUMS pair in the latest GitHub release (tag=${tag:-none}, arch=${target}). Refusing to install."
  fi

  case "${url}" in
    https://github.com/Filip2k03/kyvon_ops/releases/download/*) ;;
    *) err "Unexpected download URL (refusing redirects off GitHub releases): ${url}" ;;
  esac
  case "${sums_url}" in
    https://github.com/Filip2k03/kyvon_ops/releases/download/*) ;;
    *) err "Unexpected checksum URL: ${sums_url}" ;;
  esac

  log "Downloading ${name} (${tag})"
  curl -fsSL --proto '=https' --tlsv1.2 "${url}" -o "${tmp}/${name}"
  curl -fsSL --proto '=https' --tlsv1.2 "${sums_url}" -o "${tmp}/SHA256SUMS"

  grep -F "${name}" "${tmp}/SHA256SUMS" >/dev/null || err "SHA256SUMS does not mention ${name}"

  (
    cd "${tmp}"
    if command -v sha256sum >/dev/null 2>&1; then
      grep -F "${name}" SHA256SUMS | sha256sum -c -
    elif command -v shasum >/dev/null 2>&1; then
      grep -F "${name}" SHA256SUMS | shasum -a 256 -c -
    else
      err "Neither sha256sum nor shasum is available"
    fi
  ) || err "Checksum verification failed. The file was not installed."

  mkdir -p "${INSTALL_DIR}"
  chmod 0755 "${tmp}/${name}"
  # Do not overwrite a running binary in place; write then rename.
  cp "${tmp}/${name}" "${INSTALL_DIR}/kyvon-ops.new"
  mv "${INSTALL_DIR}/kyvon-ops.new" "${INSTALL_DIR}/kyvon-ops"
  log "Installed ${INSTALL_DIR}/kyvon-ops from ${tag}. Existing config was not touched."
  log "Launch: ${INSTALL_DIR}/kyvon-ops"
}

mode="all"
case "${1:-}" in
  --check) mode="check" ;;
  --frontend|--all|'') mode="install" ;;
  --desktop) mode="desktop" ;;
  -h|--help) usage; exit 0 ;;
  *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
esac

if [ "$mode" = "desktop" ]; then
  install_desktop
  exit 0
fi

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
echo "desktop-build=./scripts/build-desktop.sh"
