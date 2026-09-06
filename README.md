# KyvonOPS V4.1

A local-first infrastructure operations project for developers, independent operators, and teams. The target architecture combines a Tauri desktop application, Rust domain libraries, local SQLite storage, direct SSH, and a policy-controlled MCP gateway.

**Status: development preview.** A successful frontend build is not proof that native installation, SSH operations, mobile pairing, or deployment are production-ready. Check release notes and verified artifacts before installing on a production workstation.

The current `v4.1.0-rc.7` GitHub prerelease contains CI-built Windows, universal
macOS, and Linux installers plus `SHA256SUMS.txt`. It is a draft, unsigned
validation release; it is not the stable download channel.

## Website and application

The public website provides product information, getting-started guidance, and links to [GitHub releases](https://github.com/Filip2k03/kyvon_ops/releases). It does not expose the infrastructure workspace or ask for SSH/cloud credentials. Browser requests for app-only routes redirect to the public home page.

The installed Tauri application loads the operational workspace separately. Each user should connect their own servers from their own machine. No maintainer account, shared server inventory, or mandatory hosted KyvonOPS control plane belongs in that flow. See [the website/application boundary](docs/PUBLIC_WEBSITE.md).

After the local deployment passes, follow the [Cloudflare Tunnel setup](docs/CLOUDFLARE_TUNNEL_SETUP.md) to expose only the public static site.

For the controlled VPN-based remote deployment and installation verification sequence, use the [deployment test plan](docs/DEPLOYMENT_TEST_PLAN.md). It keeps operator VPN and SSH credentials outside this repository.

The V4.1 evidence matrix and release gate are maintained in [production readiness](docs/V4.1_PRODUCTION_READINESS.md) and [release gate](docs/V4.1_RELEASE_GATE.md). They record verified checks and explicit blockers; they do not substitute for deployment evidence.

The public website is `https://kyvonops.sys.thuyakyaw.com/`. It serves the static product site over HTTPS. It is not a hosted SSH control plane.

See [V4.1 security](docs/V4.1_SECURITY.md) for the implemented boundary (keychain, host keys, MCP capabilities, redaction). Pairing, hosted MFA, and a public API are not part of this build.

Monetization is isolated to optional public/download sponsor placements; the operational control plane remains ad-free. See the [V4.1 monetization boundary](docs/MONETIZATION.md).

For the final evidence-based review, see the [launch checklist](docs/V4.1_FINAL_LAUNCH_CHECKLIST.md) and [release report](docs/V4.1_FINAL_RELEASE_REPORT.md).

The system boundaries and shared control-gate model are described in the [V4.1 architecture](docs/V4.1_ARCHITECTURE.md).

Platform-specific desktop setup is documented in [V4.1 desktop installation](docs/V4.1_DESKTOP_INSTALLATION.md).

## Installation and availability

Use only artifacts actually published in a release. Review its operating-system requirements, checksums, signing information, and known limitations. The website does not fabricate installer URLs or imply that a package exists for every platform.

V4.1 targets macOS, Windows, and Linux desktop users. Android and iOS companion functionality is under development; packaging scripts alone do not establish a working mobile product. Native builds, clean installation, credential custody, updates, and end-to-end operations must be verified before a stable release.

## Development

Prerequisites: Rust matching `Cargo.toml`, Bun, and the native toolchain required by Tauri for your operating system.

Check the local toolchain without changing the machine, or install the locked
frontend dependencies with the repository helper:

```sh
./scripts/install.sh --check
./scripts/install.sh --frontend
```

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

Read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and the [product specification](PROMPTS.md) before changing behavior. Use Conventional Commits, preserve unrelated edits, and include tests for new operational boundaries. Document unavailable functionality and exact validation results.

Release publication requires verified native artifacts, signing and update checks, real backend behavior, and a tested hosting destination. Source changes and frontend tests do not establish those gates. Donations and promotional material must use verified destinations and truthful feature claims; no test checkout should be presented as a real payment flow.
