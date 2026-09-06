#!/usr/bin/env bash
# KyvonOPS — workspace control: agent profiles, permissions, verification, smoke tests.
# No heredocs. Fail closed. Does not download unsigned binaries.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENTS_SOURCE="${REPO_ROOT}/docs/agents"
AGENTS_TARGET="${REPO_ROOT}/.agents/agents"

if [ -t 1 ]; then
  BOLD=$'\033[1m'
  GREEN=$'\033[0;32m'
  AMBER=$'\033[0;33m'
  ROSE=$'\033[0;31m'
  CYAN=$'\033[0;36m'
  NC=$'\033[0m'
else
  BOLD="" GREEN="" AMBER="" ROSE="" CYAN="" NC=""
fi

log_info()  { printf '%s[INFO]%s %s\n' "${CYAN}" "${NC}" "$*"; }
log_ok()    { printf '%s[OK]%s %s\n' "${GREEN}" "${NC}" "$*"; }
log_warn()  { printf '%s[WARN]%s %s\n' "${AMBER}" "${NC}" "$*"; }
log_error() { printf '%s[ERROR]%s %s\n' "${ROSE}" "${NC}" "$*" >&2; }

usage() {
  printf '\n%sKyvonOPS control%s\n\n' "${BOLD}" "${NC}"
  printf 'Usage: %s <command> [options]\n\n' "$(basename "$0")"
  printf 'Commands:\n'
  printf '  install-agents      Copy docs/agents/* into .agents/agents/\n'
  printf '  fix-perms           Make .agents writable by the current user\n'
  printf '  verify-workspace    cargo fmt/clippy/test and desktop bun build+test\n'
  printf '  smoke-ssh           Read-only live SSH smoke (needs SSH_HOST, SSH_USER, SSH_KEY)\n'
  printf '  smoke-pty           Interactive PTY smoke (same env vars)\n'
  printf '  full-check          fix-perms + install-agents + verify-workspace\n'
  printf '\nOptions:\n'
  printf '  -t, --target-dir DIR   Override agent install directory\n'
  printf '  -h, --help             This help\n\n'
}

cmd_fix_perms() {
  printf '\n%s=== Healing workspace permissions ===%s\n' "${BOLD}" "${NC}"
  local current_user current_group
  current_user="$(id -un)"
  current_group="$(id -gn)"

  if [ -d "${REPO_ROOT}/.agents" ]; then
    if [ -w "${REPO_ROOT}/.agents" ]; then
      chmod -R u+rwX "${REPO_ROOT}/.agents"
      log_ok "Permissions healthy on .agents"
    else
      log_warn "Need elevated privilege to reclaim .agents ownership"
      sudo chown -R "${current_user}:${current_group}" "${REPO_ROOT}/.agents"
      chmod -R u+rwX "${REPO_ROOT}/.agents"
      log_ok "Reclaimed .agents ownership"
    fi
  else
    mkdir -p "${AGENTS_TARGET}"
    log_ok "Created ${AGENTS_TARGET}"
  fi
}

cmd_install_agents() {
  printf '\n%s=== Installing agent profiles ===%s\n' "${BOLD}" "${NC}"
  if [ ! -d "${AGENTS_SOURCE}" ]; then
    log_error "Missing ${AGENTS_SOURCE}"
    exit 1
  fi

  if [ -d "$(dirname "${AGENTS_TARGET}")" ] && [ ! -w "$(dirname "${AGENTS_TARGET}")" ]; then
    log_warn ".agents is write-protected. Healing permissions..."
    cmd_fix_perms
  fi

  mkdir -p "${AGENTS_TARGET}"
  local profile dest
  for profile in "${AGENTS_SOURCE}"/*/agent.md; do
    [ -f "${profile}" ] || continue
    dest="${AGENTS_TARGET}/$(basename "$(dirname "${profile}")")"
    mkdir -p "${dest}"
    cp "${profile}" "${dest}/agent.md"
    chmod 0644 "${dest}/agent.md"
    log_ok "Installed $(basename "${dest}") -> ${dest}/agent.md"
  done
  printf '\n%sInstalled profiles:%s\n' "${GREEN}${BOLD}" "${NC}"
  find "${AGENTS_TARGET}" -maxdepth 2 -name agent.md -print
}

cmd_verify_workspace() {
  printf '\n%s=== Workspace verification ===%s\n' "${BOLD}" "${NC}"
  log_info "Rust formatting"
  (cd "${REPO_ROOT}" && cargo fmt --all -- --check)
  log_ok "fmt clean"
  log_info "Clippy"
  (cd "${REPO_ROOT}" && cargo clippy --workspace --all-targets --all-features -- -D warnings)
  log_ok "clippy clean"
  log_info "Rust tests"
  (cd "${REPO_ROOT}" && cargo test --workspace --all-features)
  log_ok "Rust tests passed"
  log_info "Desktop build and tests"
  (cd "${REPO_ROOT}/apps/desktop" && bun run build && bun run test)
  log_ok "Frontend build and tests passed"
  printf '\n%sALL REPOSITORY VERIFICATION GATES PASSED.%s\n' "${GREEN}${BOLD}" "${NC}"
}

require_ssh_env() {
  if [ -z "${SSH_HOST:-}" ] || [ -z "${SSH_USER:-}" ] || [ -z "${SSH_KEY:-}" ]; then
    log_error "SSH_HOST, SSH_USER, and SSH_KEY must be set."
    log_info "Example: SSH_HOST=10.0.0.5 SSH_USER=operator SSH_KEY=\${HOME}/.ssh/id_ed25519 $0 $1"
    exit 1
  fi
}

cmd_smoke_ssh() {
  require_ssh_env smoke-ssh
  bash "${REPO_ROOT}/scripts/live-ssh-smoke.sh"
}

cmd_smoke_pty() {
  require_ssh_env smoke-pty
  bash "${REPO_ROOT}/scripts/live-pty-smoke.sh"
}

if [ $# -eq 0 ]; then
  usage
  exit 0
fi

COMMAND="$1"
shift

while [ $# -gt 0 ]; do
  case "$1" in
    -t|--target-dir)
      AGENTS_TARGET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

case "${COMMAND}" in
  install-agents) cmd_install_agents ;;
  fix-perms) cmd_fix_perms ;;
  verify-workspace) cmd_verify_workspace ;;
  smoke-ssh) cmd_smoke_ssh ;;
  smoke-pty) cmd_smoke_pty ;;
  full-check)
    cmd_fix_perms
    cmd_install_agents
    cmd_verify_workspace
    ;;
  -h|--help) usage ;;
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
