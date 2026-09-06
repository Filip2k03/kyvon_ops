# Repository truth table

What is actually implemented in `kyvon_ops`, established by reading and running
the code rather than by reading claims about it.

**Verified:** 2026-09-06, commit `39aafaf`, branch `main`.

Every row cites evidence you can re-run. Where a document and the code
disagree, the code wins. Regenerate this file before trusting it — a stale
audit is worse than none, because it carries the authority of an audit.

## How to re-verify

```sh
cargo test --workspace --all-features        # 196 pass
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
cd apps/desktop && bun run build && bun test # 26 pass
```

CI runs all four on every push and is green.

## Truth table

| Area | State | Evidence |
| --- | --- | --- |
| **Rust workspace** | Works | 9 crates + 2 apps. `cargo test --workspace` = 196 tests, clippy `-D warnings` clean. |
| **Desktop shell (Tauri)** | Works | `apps/desktop/src-tauri` compiles and `bun run tauri dev` was launched successfully on 2026-09-06; Vite bound to port 1420 and the native `kyvon-ops` process started. |
| **Frontend build** | Works | `bun run build`, 26 tests. React 19 + Vite + Tailwind + Zustand. |
| **Public website** | Works locally, public route pending | `App.tsx` routes browser → `PublicWebsite`, Tauri → `DesktopApp`. The production bundle was installed and verified through Nginx on the VPN test host at `127.0.0.1:8080`; Cloudflare DNS and Tunnel are not configured yet, so the public hostname is not claimed as live. |
| **SSH transport** | Works | `kyvon-ssh`: `russh`, one multiplexed session per server, `exec`/`stream`/PTY/SFTP. |
| **Host-key verification** | Works | `HostKeyVerifier` is a required constructor argument; no path returns trusted without it. `DesktopVerifier` consults `known_hosts`, prompts on unknown *and changed* keys, times out to **reject**. Prompt replay is tested. |
| **Credential storage** | Works | `kyvon-ssh/src/vault.rs` → OS keychain under `com.kyvon.ops`. SQLite stores `auth_json` (method shape), never the secret. |
| **Local database** | Works | SQLite via `sqlx`, opens under the app data directory. Was `:memory:` until 2026-09-06, discarding every server on close. |
| **Inventory CRUD** | Works | `add_server` / `list_servers` / `delete_server` against `ServerRepo`. Ids and timestamps assigned server-side. |
| **Connect** | Works, unproven | `connect` resolves the secret from the vault, verifies the host key, opens a session. **Never run against a real host from this repository.** |
| **Host discovery** | Works, unproven | `discovery::probe` — one script, one round trip, every check a read. Persists `HostFacts`. Same caveat: not run against a real host. |
| **Telemetry** | Works, unproven | Collector piped to remote `sh -s` over stdin; `frames_from_block` produces typed samples; Command Center shows measured CPU and memory. Parsing is tested against fixtures; the SSH path is not. |
| **Services (systemd)** | Works, unproven | `list_services`, `start_service`, `stop_service` with classify → execute → verify → audit. |
| **Risk classification** | Works | `kyvon-security::classify`. Unknown programs floor at `Medium`; `curl \| sh`, `eval`, command substitution escalate on sight. |
| **Command construction** | Works | `Cmd` has no constructor taking a whole command line. Injection is prevented by construction. |
| **Audit ledger** | Works | `AuditRepo` records actor, tier, command, exit status, duration, redacted excerpt. `Outcome::Unverified` exists because §86 requires confirmation. |
| **Redaction** | Works | `kyvon-policy::redactor` covers password, passwd, secret, token, api_key, apikey, authorization, cookie, private_key, passphrase. Tested. |
| **MCP protocol** | Partial | `kyvon-policy::mcp_server` handles initialize / tools/list / tools/call / resources / prompts, validates envelopes, answers notifications correctly. Tool schemas are typed and role-filtered. **Tool bodies return shaped responses, not live infrastructure data** — the gateway is not wired to `AppState`. |
| **MCP ↔ Claude / Codex** | Not verified | `cargo run -p kyvon-mcp` starts and speaks the protocol. No end-to-end session with either client has been run. Defaults to `McpRole::Observer`. |
| **Approval engine** | Partial | `ApprovalGate` assesses tier, issues requests, expires them; `TokenAuthority` issues single-use, server-scoped, TTL-bounded tokens. **No UI, and nothing gates an MCP write on an approval yet.** |
| **Terminal (PTY)** | Not implemented | All four commands return an explicit error. `TerminalView.tsx` refuses input rather than simulating. Assigned to Codex — see `docs/CODEX-HANDOFF.md`. |
| **Files / SFTP** | Not implemented | Commands return explicit errors. |
| **Digital twin / topology** | Partial | `kyvon-topology` parses nginx, maps Docker, correlates ports to inodes, attributes cgroups — with tests. Not called by any command. |
| **Diagnostics** | Partial | `kyvon-diagnostics` computes capacity, outage risk, latency decomposition, causality — with tests. Not called by any command. |
| **Incident engine** | Missing | `kyvon-core::incident` types exist. No detection logic. |
| **Deployments** | Missing | `kyvon-core::deployment` types exist. No implementation. |
| **Plugins** | Missing | Named in PROMPTS.md §120. No manifest, loader or sandbox. |
| **Automations** | Missing | No scheduler, triggers or cooldown. |
| **Mobile** | Shell only | Capacitor wraps the same `dist/`. Icons generated for Android and iOS. No pairing, no biometrics, no push, no device identity. |
| **Device pairing / 2FA** | Missing | No key exchange, nonce store or device registry. |
| **Kyvon agent** | Missing | `agent/` holds only `bootstrap.sh` (embedded POSIX collector). No Rust crate. The release workflow detects its absence and skips. |
| **CI** | Works | Green. Had **never passed** before 2026-09-06 — the Rust job never installed `libdbus-1-dev` for the `keyring` crate. |
| **Releases** | Works, unused | `release.yml` was structurally unable to produce artifacts (built a non-existent `agent/Cargo.toml`, and desktop bundles declared `needs:` on it). Fixed. **No tag has been pushed, so no release exists** — the downloads page correctly says so. |
| **Remote deployment test** | Verified locally on VPN host | `scripts/deploy-host.sh` deployed the prebuilt static bundle without installing Bun; `/healthz`, SPA deep links, security headers, and disabled updater metadata were verified on the approved test host. |
| **Live SSH smoke test** | Verified read-only | `scripts/live-ssh-smoke.sh` connected with strict host-key checking and verified Ubuntu 22.04, disk headroom, Nginx, systemd, `/proc` readability, and the deployed port 8080 listener. This does not replace the desktop app `SshSession` test. |
| **Schema mirror** | Works | `kyvon-core/tests/schema.rs` fails the build when a TypeScript mirror drifts. Both directions verified by reproducing real bugs. |

## Code hygiene

| Marker | Count |
| --- | --- |
| `TODO` / `FIXME` / `HACK` in Rust | 0 |
| `unimplemented!` / `todo!` / `panic!` in Rust | 0 |
| `.unwrap()` / `.expect()` outside tests | 0 |
| `console.log` / `TODO` / `mock` in frontend `src/` | 0 |
| Feature screens under 200 bytes | **10** |

The ten placeholders are `LogCenter`, `DockerOverview`, `NetworkOverview`,
`StorageOverview`, `ProcessExplorer`, `SecurityCenter`, `ServiceManager`,
`FileManager`, `NotesEditor`, `ServerDetail` — each `export const X = () =>
<div>X</div>`. `bun run build` passes, so a green build says nothing about
whether a screen exists.

## The defect class that has dominated this repository

Not memory safety, not concurrency — **fabrication**. Code that reported
something it had not measured:

| Found | Was |
| --- | --- |
| Command Center | Invented hostname, public IP, uptime, `87/100` security score |
| Terminal | Simulated shell; replied `Executed successfully (exit code 0)` to **any** input, including `systemctl restart nginx` |
| Stub commands | `stop_service` → "stopped", `delete_file` → "deleted", `read_file` → `""` (indistinguishable from an empty file, so saving over it destroys contents) |
| Header | Defaulted to `production-01` with a green "connected" dot |
| 4 TypeScript mirrors | Declared fields the backend never sends — silently `undefined` |
| `events.ts` | Listened on `kyvon-event`, which nothing emits |

All fixed. Two structural defences now exist: `Loaded<T>` in
`src/lib/backend.ts` forces ok / unavailable / failed to be distinguished, and
`tests/schema.rs` fails the build on mirror drift.

**This is why V4 §43 ("never stop after first success") and §69 ("do not
fabricate") are the load-bearing rules in that document.** Every item above
passed a build and rendered without error.

## Honest read against V4 §66

Of 33 "definition of done" items: roughly **11 done**, **7 partial**, **15 not
started**. The unproven-against-real-hardware caveat applies to every SSH-path
row above — nothing in this repository has been run against a live server.

## Next, in dependency order

1. **Prove one real desktop connection** — add the approved test host, verify the host-key prompt, then run probe and telemetry. This converts the SSH-path rows into evidence.
2. **Terminal** (Codex, assigned).
3. **Wire MCP tools to `AppState`** so `kyvon_server_health` returns real data, then gate writes on `ApprovalGate`.
4. **Call `kyvon-topology` and `kyvon-diagnostics`** — both fully built and tested, both unreachable.
5. **Configure and verify the Cloudflare Tunnel** using `docs/CLOUDFLARE_TUNNEL_SETUP.md`; do not claim the public hostname until HTTPS health checks pass.
