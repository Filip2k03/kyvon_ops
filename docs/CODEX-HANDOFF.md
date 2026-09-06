# Codex Astra — task handoff

Paste the brief below into Codex. It is written to be self-contained: it
states the ground truth, the rules that are not negotiable, and one task with
a definition of done.

Regenerate the "Current state" section from the repo before reusing it — a
stale handoff is worse than none.

---

## Ground truth (verified 2026-09-06)

Repository: `github.com/Filip2k03/kyvon_ops`, branch `main`.
Public site: <https://kyvonops.sys.thuyakyaw.com> (Cloudflare Pages, auto-deploys from `main`).

**Green:**
- `cargo test --workspace --all-features` — 196 tests
- `cargo clippy --workspace --all-targets --all-features -- -D warnings`
- `cargo fmt --all -- --check`
- `cd apps/desktop && bun run build && bun test` — 26 tests
- GitHub Actions CI passes on every push

**Working end to end:**
- Tauri backend compiles and runs; inventory persists to SQLite under the app
  data directory
- `connect` opens a real SSH session with host-key verification: unknown and
  changed keys prompt the operator, a timeout rejects, trust is persisted only
  when granted
- `start_collector` pipes `COLLECTOR_SCRIPT` to the remote `sh -s` over stdin
  and streams framed `/proc` reads back; `sample::frames_from_block` turns them
  into typed samples; the Command Center shows measured CPU and memory
- `kyvon-core/tests/schema.rs` fails the build when a TypeScript mirror drifts

**Not implemented — these return an explicit error, never a fake success:**
- `open_terminal` / `write_terminal` / `resize_terminal` / `close_terminal`
- `list_services` / `start_service` / `stop_service`
- `list_files` / `read_file` / `write_file` / `delete_file`
- `probe_capabilities`

**Also outstanding:**
- Ten feature screens are one-line placeholders (`LogCenter`, `DockerOverview`,
  `NetworkOverview`, `StorageOverview`, `ProcessExplorer`, `SecurityCenter`,
  `ServiceManager`, `FileManager`, `NotesEditor`, `ServerDetail`)
- `agent/` has no Rust crate, only `bootstrap.sh`; the release workflow detects
  this and skips the musl build
- No release has been tagged, so the downloads page correctly shows "no release
  published yet"

## Rules that are not negotiable

1. **Never fabricate data.** If a measurement is unavailable, say so. No
   placeholder telemetry, no example hostnames or IPs presented as real, no
   command that reports success without executing. This is PROMPTS.md §108 and
   the §126 quality gate, and violations of it have been the single largest
   source of bugs in this repo.
2. **Never add a generic shell tool** to the MCP surface. Every tool is typed
   and schema-validated. `kyvon-security::Cmd` has no constructor taking a
   whole command line; keep it that way.
3. **Secrets stay in the OS keychain.** SQLite holds connection shape only.
   Nothing that leaves the process — UI, logs, MCP responses — may carry a
   password, token, key or cookie; everything routes through
   `kyvon-policy::redactor`.
4. **Writes verify afterwards:** execute, confirm expected state, record audit.
5. **Errors are actionable** (§118): name the target, the probable cause and
   the next step. Never "Unknown error".
6. **Types cross the boundary once.** Define in `kyvon-core`, mirror in
   `apps/desktop/src/types/`, and run `cargo test -p kyvon-core --test schema`.
7. Read a module before changing it. The Rust crates carry doc comments
   explaining *why* a design is what it is; preserve that reasoning.

## Task

Implement the terminal commands in `apps/desktop/src-tauri/src/commands/terminal.rs`.

`connect` already stores a live `SshSession` in `SessionManager`, and
`kyvon-ssh` exposes `TerminalHandle` and `TerminalItem` for PTY channels. The
frontend surface exists at `apps/desktop/src/features/terminal/TerminalView.tsx`
and currently refuses all input, printing "Not executed: no SSH channel is
attached" — it must never claim an outcome for a command it did not run.

Required:
- `open_terminal(id)` allocates a PTY on the server's existing session, stores
  the handle, and returns a session id the frontend can address
- `write_terminal`, `resize_terminal`, `close_terminal` operate on that handle
- Output streams to the frontend as `KyvonEvent::TerminalOutput`, emitted with
  `emit_event` so it lands on `kyvon://terminal` rather than the core channel —
  the separation exists so a busy terminal cannot starve the dashboard
- Terminal bytes are base64-encoded; they are not guaranteed to be valid UTF-8
- Closing the panel must close the channel, not leave a shell running remotely
- `TerminalView.tsx` forwards keystrokes and renders real output

Definition of done: all gates in "Green" above still pass, the new code has
tests where it is testable without a live host, and nothing in the UI reports
an outcome that did not happen.
