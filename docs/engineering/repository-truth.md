# Repository truth table

What is actually implemented in `kyvon_ops`, established by reading and running
the code rather than by reading claims about it.

**Verified:** 2026-09-06, commit `ddacce0`, branch `main`.

Every row cites evidence you can re-run. Where a document and the code
disagree, the code wins. Regenerate this file before trusting it — a stale
audit is worse than none, because it carries the authority of an audit.

## How to re-verify

```sh
cargo test --workspace --all-features        # 199 pass
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
cd apps/desktop && bun run build && bun run test # 46 unit-test pass; bun run test:e2e for Playwright
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
| **Credential storage** | **Verified in practice** | `kyvon-ssh/src/vault.rs` → OS keychain under `com.kyvon.ops`. The installed app's store holds `auth_json` = `{"type":"agent"}` for its configured server — method shape, no secret. The invariant holds against a real profile, not only in tests. |
| **Local database** | Works | SQLite via `sqlx`, opens under the app data directory. Was `:memory:` until 2026-09-06, discarding every server on close. |
| **Inventory CRUD** | Works | `add_server` / `list_servers` / `delete_server` against `ServerRepo`. Ids and timestamps assigned server-side. |
| **Connect** | **Proven against real hardware** | A genuine `ssh-ed25519` host key from `187.127.110.32:22` is recorded in the installed app's `known_hosts`, so the TCP connect, SSH handshake and host-key verification path have all run against a live server. Re-checkable: `sqlite3 "$HOME/Library/Application Support/com.kyvon.ops/kyvon.db" "SELECT host,key_type FROM known_hosts;"` |
| **Host discovery** | Works, unproven | `discovery::probe` — one script, one round trip, every check a read. Persists `HostFacts`. Same caveat: not run against a real host. |
| **Telemetry** | Works, **unproven against real hardware** | Collector piped to remote `sh -s` over stdin; `frames_from_block` produces typed samples; Command Center shows measured CPU and memory. Parsing is tested against fixtures. `metric_samples` is **0 rows** in the installed app after real use, so no sample has ever been collected from a live host — the pipeline is verified as far as "connected" and no further. |
| **Services (systemd)** | Works, unproven | `list_services`, `start_service`, `stop_service` with classify → execute → verify → audit. |
| **Risk classification** | Works | `kyvon-security::classify`. Unknown programs floor at `Medium`; `curl \| sh`, `eval`, command substitution escalate on sight. |
| **Command construction** | Works | `Cmd` has no constructor taking a whole command line. Injection is prevented by construction. |
| **Audit ledger** | Works, no real entries yet | `AuditRepo` records actor, tier, command, exit status, duration, redacted excerpt. `Outcome::Unverified` exists because §86 requires confirmation. |
| **Redaction** | Works | `kyvon-policy::redactor` covers password, passwd, secret, token, api_key, apikey, authorization, cookie, private_key, passphrase. Tested. |
| **MCP protocol** | Partial | `kyvon-policy::mcp_server` handles initialize / tools/list / tools/call / resources / prompts, validates envelopes, answers notifications correctly. Tool schemas are typed and role-filtered. **Tool bodies return shaped responses, not live infrastructure data** — the gateway is not wired to `AppState`. |
| **MCP ↔ Claude / Codex** | Not verified | `cargo run -p kyvon-mcp` starts and speaks the protocol. No end-to-end session with either client has been run. Defaults to `McpRole::Observer`. |
| **Approval engine** | Partial | `ApprovalGate` assesses tier, issues requests, expires them; `TokenAuthority` issues single-use, server-scoped, TTL-bounded tokens. **No UI, and nothing gates an MCP write on an approval yet.** |
| **Terminal (PTY)** | Implemented, unproven against a live host | `SshSession::open_terminal` is exposed through real Tauri open/write/resize/close commands. Raw PTY bytes are base64-framed on `kyvon://terminal`; xterm.js handles scrollback, search, selection copy, resize, and honest close/error states. A live desktop session still needs verification. |
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
| **Releases** | **Artifacts build and verify; nothing published** | `v4.1.0-rc.7` produced four installers plus `SHA256SUMS.txt`. All checksums verified locally, and `file` confirms each is genuinely its claimed format rather than a renamed binary. The macOS bundle is a true universal binary (`lipo -archs` → `x86_64 arm64`) and launches. The release is a **draft**: `/releases/latest` ignores drafts and pre-releases, so the download page still reports no release, correctly. |
| **Code signing** | **Missing — blocks public distribution** | `gh secret list` shows no Apple or Windows signing secrets. `codesign -dv` on the built bundle reports `Signature=adhoc`, `TeamIdentifier=not set`, not notarised, so a browser download is quarantined and Gatekeeper refuses it. Windows shows SmartScreen. The download page now explains both rather than leaving a visitor to conclude the file is broken. |
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

Of 33 "definition of done" items: roughly **15 done**, **7 partial**, **11 not
started**.

The blanket "nothing has run against a live server" caveat no longer holds:
connect and host-key verification are now evidenced by a real ed25519 key in
the installed app's store. It still applies to everything downstream of a live
session — telemetry, services, terminal and audited writes have a session to
build on but no recorded run against real hardware.

## Next, in dependency order

1. **Obtain code-signing credentials.** This is the only thing standing between
   verified installers and a public download. Without an Apple Developer ID and
   notarisation, every macOS visitor meets Gatekeeper; without a Windows
   certificate, every Windows visitor meets SmartScreen. The workflow already
   references the secret names, so it is a settings change, not a code change.
2. **Collect one real telemetry sample.** `start_collector` against the
   already-connected host would turn `metric_samples` from 0 into evidence and
   light up the Command Center with measured values. It is the shortest path
   from "connected" to "useful".
3. **Run one audited write** — a service restart through the approval gate —
   so `audit_events` stops being empty and §86's verify-after-write is
   demonstrated rather than only tested.
4. **Call `kyvon-topology` and `kyvon-diagnostics`** — both fully built and
   tested, both still unreachable from any command.
5. **Publish a release.** Blocked on (1) unless the project accepts shipping
   unsigned builds; the download page now documents the workaround either way.
