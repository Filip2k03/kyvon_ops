# Installing KyvonOPS

**Status: there is no published release yet.** The only way to run KyvonOPS
today is to build it from source. This page says how, and is explicit about
which steps are verified and which are not — a setup guide that overstates
what works wastes more of your time than one that admits a gap.

Verified against commit `1c0122b` on 2026-09-06.

## What KyvonOPS is

A local-first control plane for Linux servers you already have SSH access to.
It runs on your workstation, connects directly to your hosts, and keeps
credentials in your operating system's keychain. There is no KyvonOPS account,
no hosted backend, and nothing to sign up for.

The public website is documentation and downloads only. It has no SSH
transport and cannot manage infrastructure — a browser tab structurally
cannot open port 22 or read your keychain.

## Requirements

| | |
| --- | --- |
| **Rust** | 1.82 or newer (`rustup` recommended) |
| **Bun** | latest — the frontend uses `bun`, not `npm` |
| **A Linux host** | with SSH access you already have |

Platform toolchains for the desktop shell (Tauri 2):

- **macOS** — Xcode Command Line Tools (`xcode-select --install`)
- **Windows** — Microsoft C++ Build Tools and WebView2 (present on Windows 11)
- **Linux** — `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libglib2.0-dev libdbus-1-dev`

`libdbus-1-dev` is not optional on Linux: the `keyring` crate uses the Secret
Service to store credentials, and the build fails without it. This is the
exact dependency that kept CI red until it was found.

Building the desktop shell pulls a large dependency tree. **Budget ~8 GB of
free disk**; the build fails partway through with confusing errors if it runs
out, and a cache under `target/` grows across builds.

## Build and run

```sh
git clone https://github.com/Filip2k03/kyvon_ops.git
cd kyvon_ops

# Verify the core before building the shell — fast, and it fails clearly.
cargo test --workspace --all-features        # 198 tests

cd apps/desktop
bun install
bun run tauri dev                            # development
bun run tauri build                          # installer for your platform
```

**Not yet verified:** no one has run `tauri build` in this repository and
confirmed it produces a working installer, and the desktop window has not been
opened. The Rust backend compiles and CI is green, but "compiles" is not
"runs". If you build it and it works — or does not — that is genuinely useful
information for the project.

### Verified as working

```sh
cargo test --workspace --all-features                              # 198 pass
cargo clippy --workspace --all-targets --all-features -- -D warnings
cd apps/desktop && bun run build && bun test                       # 26 pass
cd apps/desktop && bunx playwright test                            # 12 pass
```

CI runs all of these on every push.

## The MCP gateway

Runs standalone and needs no desktop app:

```sh
cargo run -p kyvon-mcp
```

It speaks MCP over stdio and reads the same local database the desktop writes,
so it reports an empty inventory until you have added a server. It starts as
an **observer** — read-only — because no trusted identity has been established
for a process anything on the machine can spawn.

Point a client at it by absolute path to the built binary
(`target/debug/kyvon-mcp`). Set `KYVON_DB` to use a database elsewhere.

## Uninstalling

Building from source leaves nothing installed system-wide. Remove the clone.

Two things live outside it:

- **The local database** — `~/Library/Application Support/com.kyvon.ops/kyvon.db`
  on macOS, `~/.local/share/com.kyvon.ops/` on Linux, `%APPDATA%\com.kyvon.ops\`
  on Windows. Inventory and audit history; contains no secrets.
- **Keychain entries** under the service `com.kyvon.ops` — the actual
  passwords and key passphrases. Delete these through your OS credential
  manager; removing the database does not remove them.

## Troubleshooting

**`libdbus-1-dev` / `glib-2.0` not found (Linux)** — install the platform
packages listed above. The failure appears during a build script, before any
project code compiles, which makes it look unrelated.

**`No space left on device`** — the Tauri dependency tree is large.
`cargo clean` frees the whole build cache; `rm -rf target/debug/incremental`
frees a smaller amount without a full rebuild.

**MCP tools all report "no infrastructure backend attached"** — the gateway
could not open the database. It prints the reason on stderr at startup.

**A tool reports "needs a live connection to the host"** — that tool is not
implemented for this gateway, which reads recorded data only. It is telling
the truth rather than guessing.

## Next

- [Connect your first server](first-server.md)
- [Repository truth table](../engineering/repository-truth.md) — what is
  actually implemented, with evidence
