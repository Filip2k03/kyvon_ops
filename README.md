# KyvonOPS V3.0

A local-first infrastructure operations project for developers, independent operators, and teams. The target architecture combines a Tauri desktop application, Rust domain libraries, local SQLite storage, direct SSH, and a policy-controlled MCP gateway.

**Status: development preview.** A successful frontend build is not proof that native installation, SSH operations, mobile pairing, or deployment are production-ready. Check release notes and verified artifacts before installing on a production workstation.

## Website and application

The public website provides product information, getting-started guidance, and links to [GitHub releases](https://github.com/Filip2k03/kyvon_ops/releases). It does not expose the infrastructure workspace or ask for SSH/cloud credentials. Browser requests for app-only routes redirect to the public home page.

The installed Tauri application loads the operational workspace separately. Each user should connect their own servers from their own machine. No maintainer account, shared server inventory, or mandatory hosted KyvonOPS control plane belongs in that flow. See [the website/application boundary](docs/PUBLIC_WEBSITE.md).

For the controlled VPN-based remote deployment and installation verification sequence, use the [deployment test plan](docs/DEPLOYMENT_TEST_PLAN.md). It keeps operator VPN and SSH credentials outside this repository.

## Installation and availability

Use only artifacts actually published in a release. Review its operating-system requirements, checksums, signing information, and known limitations. The website does not fabricate installer URLs or imply that a package exists for every platform.

V3.0 targets macOS, Windows, and Linux desktop users. Android and iOS companion functionality is under development; packaging scripts alone do not establish a working mobile product. Native builds, clean installation, credential custody, updates, and end-to-end operations must be verified before a stable release.

## Development

Prerequisites: Rust matching `Cargo.toml`, Bun, and the native toolchain required by Tauri for your operating system.

```sh
git clone https://github.com/Filip2k03/kyvon_ops.git
cd kyvon_ops
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
cargo build -p kyvon-mcp
```

Build and test the public frontend:

```sh
cd apps/desktop
bun install --frozen-lockfile
bun test tests/public-website.test.tsx
bun run build
```

The build emits static files into `apps/desktop/dist`. `bun run dev` starts an optional local frontend development server; stop it when finished. A public deployment should serve the built static files, not a workstation development process.

`bun run lint` is declared but requires the repository's ESLint dependency/configuration to be completed. Native desktop builds require separate validation; the Rust workspace checks do not by themselves establish that the Tauri shell builds or runs.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/desktop/src/features/landing/PublicWebsite.tsx` | Public product, release, and setup pages |
| `apps/desktop/src/DesktopApp.tsx` | Installed application routes |
| `apps/desktop/src-tauri/` | Native desktop commands and state |
| `apps/mcp/` | MCP stdio executable |
| `apps/cli/` | Rust CLI |
| `crates/` | Models, storage, SSH, telemetry, diagnostics, topology, security, policy |
| `database/migrations/` | SQLite migrations |
| `agent/` | Remote probe work; inspect implementation before assuming a static binary exists |
| `scripts/` | Packaging helpers |

## Security contract

- Infrastructure credentials belong in the current user's OS credential store; the public website receives none.
- MCP tools must be typed, target-scoped, policy-checked, and audited. Missing backends must return unavailable states, never fabricated success.
- Writes require the appropriate approval and verification. AI clients receive capabilities, not raw credentials.
- Supported AI clients are Codex Astra, Claude Opus, and Agy Gemini 3.8.
- Do not ship personal database files, credentials, server profiles, or private keys. Each installed user starts with a separate local workspace.

## Contributing and release work

Read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and the [V3.0 specification](PROMPTS.md) before changing behavior. Use Conventional Commits, preserve unrelated edits, and include tests for new operational boundaries. Document unavailable functionality and exact validation results.

Release publication requires verified native artifacts, signing and update checks, real backend behavior, and a tested hosting destination. Source changes and frontend tests do not establish those gates. Donations and promotional material must use verified destinations and truthful feature claims; no test checkout should be presented as a real payment flow.
