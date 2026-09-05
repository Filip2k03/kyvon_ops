# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KyvonOPS — a local-first infrastructure operations platform. A Tauri 2 desktop app drives
SSH directly from the operator's workstation to Linux VPS hosts; a Rust workspace holds all
domain logic; a stdio MCP server exposes typed, policy-gated tools to AI agents. There is no
KyvonOPS cloud backend and no telemetry daemon phoning home.

Three specification documents govern the work, in increasing order of authority:

| File | Role |
| --- | --- |
| `kyvon_ops_blueprint.md` | Original numbered spec. Rust doc comments cite it as `specification §N` (e.g. `§36` = command risk classification, `§90` = local-first). |
| `AGENTS.md` | Short repository guidelines: structure, checks, naming, security posture, commit style. |
| `PROMPTS.md` | **The current V3.0 target spec.** Numbered §1–§128. When PROMPTS.md conflicts with the other two, PROMPTS.md wins. |

`docs/CODEX.md` holds the inviolable agent rules and engineering playbooks; `docs/HANDOFFS.md`
holds third-party API contracts and the design system tokens.

## Commands

```bash
# Rust workspace (crates/* + apps/mcp) — this is what CI gates on
cargo check --workspace --all-targets
cargo test --workspace --all-features
cargo test -p kyvon-security                  # one crate
cargo test -p kyvon-security risk::tests      # one inline test module
cargo test -p kyvon-telemetry -- --nocapture  # one test, with output
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings

# Desktop frontend (bun, not npm)
cd apps/desktop
bun install
bun run dev      # Vite on :1420
bun run build    # tsc -b && vite build

# Tauri shell (see "Known broken" — does not build today)
cd apps/desktop && bun run tauri dev

# MCP server over stdio
cargo run -p kyvon-mcp

# Mobile packaging (Capacitor wraps the same dist/ bundle)
./scripts/build-apk.sh
./scripts/build-ipa.sh
```

Rust tests are inline `#[cfg(test)] mod tests` at the bottom of the module they cover —
there is no `tests/` directory in any crate. `cargo test -p <crate> <module>::tests` is the
unit of iteration.

## Architecture

### The security boundary (this is the product)

```
AI agent → MCP → policy → approval → credential resolver → SSH → host
```

The AI receives **capabilities, never credentials**. Concretely:

- `kyvon-ssh/src/vault.rs` is the only path to a secret. Passwords and key passphrases live
  in the OS keychain under service `com.kyvon.ops`; SQLite stores connection *shape* only
  (`auth_json` describes the method, never the secret). Copying the DB yields an inventory,
  not access.
- `kyvon-security/src/shell.rs` — `Cmd` has no constructor that takes a whole command line.
  Commands are a fixed program plus separately quoted args, so injection is prevented by
  construction rather than by sanitizing.
- `kyvon-security/src/risk.rs` — `classify()` parses a command line POSIX-style and returns
  the tier of its worst segment. Unknown programs floor at `Medium`; `curl | sh`, `eval` and
  command substitution escalate on sight. The tier authorizes nothing; it decides how
  deliberate the operator's confirmation must be.
- `kyvon-ssh/src/hostkey.rs` — `HostKeyVerifier` is a required constructor argument and no
  code path returns "trusted" without consulting it. There is no flag to disable this.
- `kyvon-policy/src/redactor.rs` — every MCP response passes through `sanitize_json_value`.
- `kyvon-policy/src/tools.rs` — the MCP tool surface is a fixed list of typed schemas.
  **Never add a generic `exec_sh(command)` tool.** Each tool carries `is_read_only`, and
  `tools/list` filters by `McpRole::can_write()`.
- `kyvon-policy/src/approvals.rs` — `assess_operation_risk()` maps tool name + target env to
  a `RiskTier`; `Critical` requires second confirmation and backup verification.
- `kyvon-policy/src/tokens.rs` — `TokenAuthority` issues single-use, server-scoped,
  TTL-bounded tokens (60s default), verified with `verify_and_consume`.

### Crate layout

`kyvon-core` is the single source of truth for every type crossing a boundary — crate to
crate, or Rust to TypeScript over Tauri IPC. The TS mirror is `apps/desktop/src/types/`.
Define a type once, in `kyvon-core`, then mirror it; do not redeclare shapes locally.

- `kyvon-core` — domain model, `KyvonError`/`Result`, `KyvonEvent`, `RiskTier`, MCP types,
  `PROTOCOL_VERSION`, `SCHEMA_VERSION`, `now_ms()`.
- `kyvon-security` — shell quoting, remote path validation, risk classification.
- `kyvon-ssh` — one multiplexed `russh` session per server carries telemetry, terminals,
  SFTP and one-off exec. Eight servers means eight TCP connections, not eight per feature.
- `kyvon-telemetry` — **all parsing and arithmetic happens on the desktop, not the host.**
  The remote collector (`collector.rs`, `COLLECTOR_SCRIPT`) only concatenates `/proc` and
  `/sys` reads into framed blocks on stdout. Jiffy deltas, byte rates and `df` columns are
  computed here so they are unit-testable against fixtures — that is what makes the
  "no fake metrics" rule verifiable.
- `kyvon-storage` — SQLite via `sqlx`, one repository per concept (`ServerRepo`,
  `MetricRepo`, `AuditRepo`, …). Schema in `database/migrations/0001_initial.sql`.
- `kyvon-topology` — nginx config parsing, Docker mapping, port/socket-inode correlation,
  cgroup-based resource attribution, causal graph.
- `kyvon-diagnostics` — capacity headroom, outage-risk synthesis, latency decomposition,
  causality. Utilization, headroom and operational risk are three distinct quantities;
  never collapse CPU% into a probability of outage.
- `kyvon-policy` — approvals, redaction, tokens, tool schemas, and the JSON-RPC handler.
- `apps/mcp` — thin stdio loop; the protocol lives in `kyvon-policy/src/mcp_server.rs`.

### Desktop app

React 19 + Vite + Tailwind + Zustand + react-router, dark-first "luxury industrial". Routes
in `src/App.tsx`, nav in `components/layout/Sidebar.tsx`, feature screens in
`src/features/<domain>/`, direct third-party clients in `src/lib/api/` (Cloudflare v4,
Gemini v1beta, Stripe, reverse-proxy config generators). `src/lib/tauri.ts` and
`src/lib/events.ts` are the intended IPC bridge; Tauri commands are registered in
`src-tauri/src/lib.rs`.

`apps/desktop/capacitor.config.ts` wraps the same `dist/` bundle as the Android and iOS
apps — the mobile targets are not a separate codebase.

## Known broken — read before trusting the tree

The Rust workspace compiles and its tests pass. Almost nothing above that line is wired up.

1. **The Tauri backend does not build.** `apps/desktop/src-tauri` is commented out of
   `Cargo.toml`'s `workspace.members`, so `cargo check` inside it fails immediately with a
   workspace error. Its `state.rs` also imports `kyvon_ssh::session::Session`, which does
   not exist (the type is `SshSession`).
2. **Every Tauri command is a stub.** `src-tauri/src/commands/*.rs` return `Ok(())` or
   `Ok(vec![])` with `// Dummy impl`. The DB is opened as `:memory:` in `lib.rs`.
3. **The frontend never calls the backend.** No file under `src/features/` imports
   `@tauri-apps/*`, `TauriApi` or `listenKyvonEvent`. Screens such as `CommandCenter.tsx`
   render hardcoded `api.example.com` example data. This violates PROMPTS.md §108 and the
   "no fake metrics" gate in §126 — replacing that display data with real IPC is the
   central outstanding task, not a polish item.
4. **Command names disagree across the boundary.** The frontend invokes `get_servers`,
   `terminal_write`, `terminal_resize`; the backend registers `list_servers`,
   `write_terminal`, `resize_terminal`.
5. **`bun run build` currently fails** — `noUnusedLocals`/`noUnusedParameters` are on and
   `CloudflareManager.tsx` has unused imports and state. Ten feature screens and several UI
   components are one-line placeholders (`export const LogCenter = () => <div>Logs</div>`).
6. **`bun run lint` fails** — `package.json` declares `eslint .` but no ESLint config or
   dependency exists.
7. **`agent/` has no Rust crate**, only `bootstrap.sh` (which embeds a POSIX shell
   collector). `.github/workflows/release.yml` cross-compiles `agent/Cargo.toml` for musl
   targets and `docs/CODEX.md` references `agent/src/main.rs`; neither exists yet.
8. **Crates named in PROMPTS.md §2 that do not exist**: `kyvon-agent`, `kyvon-audit`,
   `kyvon-deployment`, `kyvon-events`. Audit currently lives in `kyvon-storage/src/audit.rs`
   and events in `kyvon-core/src/event.rs`. Check before creating a crate.
9. `kyvon-core/src/lib.rs` documents a schema test at `tests/schema.rs` keeping the TS types
   in sync. It has not been written; the mirror is maintained by hand.

## Working rules

- **A feature is not complete because the UI renders.** Complete means UI + backend + real
  data + error handling + security + tests + docs (PROMPTS.md §127).
- Every button performs a real operation or plainly states the feature is unavailable. No
  placeholder telemetry, no hardcoded VPS facts, no fabricated log lines. If data cannot be
  obtained, say so — see PROMPTS.md §108.
- Errors must be actionable: target, port, probable causes, recommended next step —
  never "Unknown error" (§118).
- Before changing a stable module, read it. The Rust crates carry deliberate doc comments
  explaining *why* a design is what it is; preserve that reasoning when editing.
- Redact `password`, `token`, `secret`, `api_key`, `authorization`, `bearer`,
  `private_key`, `BEGIN * PRIVATE KEY`, `cookie` from anything leaving the process —
  UI, logs and MCP responses alike (§50).
- Never return Kubernetes Secret contents or Docker env values holding secrets; show
  presence, not value (§35, §36).
- Cloudflare: scoped API tokens only, stored in the OS keychain — never the global API key,
  never SQLite plaintext, never a QR payload (§24).
- Write operations verify afterward: execute → verify expected state → record audit (§86).

## AI agent roster

KyvonOPS integrates exactly three agent clients, all through MCP:

| Agent | Client | Typical profile |
| --- | --- | --- |
| **Codex Astra** | OpenAI Codex | operator |
| **Claude Opus** | Claude Code | operator / administrator |
| **agy Gemini 3.8** | Google Antigravity CLI | developer |

Cursor is not a supported client — do not add Cursor configuration, docs or tooling.
All three receive identical policy-controlled capabilities through the same MCP surface;
the core must not couple to any single vendor (§55).
