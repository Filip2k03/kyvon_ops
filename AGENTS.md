# Repository Guidelines

KyvonOPS is a local-first infrastructure control plane built around Rust, Tauri 2, React/TypeScript, SQLite, direct SSH, and a policy-controlled MCP gateway. Read `PROMPTS.md` before substantial work; it is the product and security specification. Preserve existing behavior and inspect the relevant module before editing.

## Project Structure

- `apps/desktop/`: Vite/React desktop UI and Tauri native commands.
- `apps/mcp/`: Rust MCP server entry point.
- `crates/kyvon-*`: shared domain, security, telemetry, storage, SSH, topology, diagnostics, and policy libraries.
- `agent/`: lightweight remote collector and bootstrap scripts.
- `database/migrations/`: SQLite schema migrations; add a new migration instead of rewriting applied files.
- `docs/`: integration and handoff documentation; `scripts/`: packaging helpers.

## Build, Test, and Development

Run Rust checks from the repository root:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
```

For the desktop frontend, run `bun install` and then `bun run dev`, `bun run lint`, or `bun run build` from `apps/desktop/`. Build the MCP crate with `cargo build -p kyvon-mcp`. Run the exact checks supported by the current workspace before reporting completion.

## Coding and Naming

Use Rust 2021 conventions, four-space indentation, `snake_case` for Rust symbols, and `PascalCase` for React components and TypeScript types. Keep shared models in the appropriate `kyvon-*` crate or `apps/desktop/src/types`; do not duplicate protocol types. Format Rust with `rustfmt` and frontend code with the repository ESLint configuration.

## Security and Architecture

Use real infrastructure data. Never add fake metrics, placeholder operational success, or an unrestricted shell MCP tool. Route writes through typed, schema-validated operations, risk classification, approval, post-flight verification, and audit. Resolve credentials through the OS keychain or approved secret manager; redact passwords, tokens, private keys, and secret-bearing environment values from logs and model responses. Keep the remote agent static and dependency-light.

Supported AI contributors are limited to **Codex Astra**, **Claude Opus**, and **Agy Gemini 3.8**. All three use the same MCP policy boundary and receive capabilities rather than credentials. Prevent concurrent writes with operation or environment locks.

## Commits and Pull Requests

Use Conventional Commits such as `feat(telemetry): add cgroup memory pressure` or `fix(policy): reject expired approvals`. Pull requests should explain behavior and security impact, link relevant issues, list validation commands and results, and include screenshots for UI changes. Do not claim a feature is complete until its real data path, error handling, security checks, tests, and documentation exist.
