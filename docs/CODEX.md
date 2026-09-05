# KyvonOPS 2.0: Codex Autonomous Engineering Directives

> **Directive Reference**: `KYVON-CODEX-2026-PACIFIC`  
> **Applicability**: Codex Astra, Claude Opus, Agy Gemini 3.8

---

## 1. Operating Rules for AI Agents

When modifying, extending, or maintaining this codebase, Codex and autonomous agents must strictly abide by these directives:

### 1.1 Inviolable Rules
1. **Never Invent Centralized SaaS Telemetry**: All data streams must remain peer-to-peer over SSH or local SQLite.
2. **Never Return Plaintext Secrets**: Always route outputs through `kyvon-policy/src/redactor.rs`.
3. **Never Expose Unbounded Shell Execution**: Never expose tools like `exec_sh(command: string)`. Only expose typed, schema-validated MCP tools (e.g. `kyvon_restart_service`, `kyvon_diagnose_site`).
4. **Preserve Musl Static Linking**: `agent/src/main.rs` must compile cleanly with `--target x86_64-unknown-linux-musl` with zero dynamic libc linkages.
5. **No Broken Imports or Unused Variables**: Always verify `bun run build` in `apps/desktop` before concluding your turn.

---

## 2. Directory Map & Responsibility Matrix

```
kyvon_ops/
├── agent/                         # Lightweight Musl POSIX telemetry probe
│   ├── src/main.rs                # In-memory virtual filesystem reader (/proc, /sys)
│   └── bootstrap.sh               # Stdin memory pipe for agentless deployment
├── apps/
│   ├── desktop/                   # Tauri 2 + React 19 + TypeScript + Capacitor 8
│   │   ├── capacitor.config.ts    # Mobile app bundle config (com.kyvon.ops)
│   │   ├── src/features/          # Feature domains (Cloudflare, Gemini, Mobile, etc.)
│   │   ├── src/lib/api/           # Real API clients (Cloudflare v4, Gemini, Stripe)
│   │   └── src-tauri/             # Rust desktop backend and OS keychain bridge
│   └── mcp/                       # Stdio Model Context Protocol gateway
├── crates/
│   ├── kyvon-core/                # Shared domain primitives and types
│   ├── kyvon-diagnostics/         # Outage risk engine, capacity forecasting, latency waterfall
│   ├── kyvon-policy/              # Human approval gates, token authority, secret redactor
│   ├── kyvon-security/            # Ed25519 signatures, OS Keychain credential storage
│   ├── kyvon-ssh/                 # Russh multiplexed connection pools
│   ├── kyvon-storage/             # Local SQLite with Write-Ahead Logging (WAL)
│   ├── kyvon-telemetry/           # Ingest and rolling aggregation pipeline
│   └── kyvon-topology/            # Causal graph builder, Nginx AST parser, Docker mapping
├── docs/
│   ├── HANDOFFS.md                # Pacific Standard Frontend & Systems Architecture Handoffs
│   └── CODEX.md                   # Codex Autonomous Engineering Directives
└── scripts/
    ├── build-apk.sh               # Android APK packaging pipeline
    └── build-ipa.sh               # iOS IPA packaging pipeline
```

---

## 3. High-Priority Engineering Playbooks

### Playbook A: Adding a New Real-World API Integration
1. Define TypeScript interfaces in `apps/desktop/src/lib/api/types.ts`.
2. Implement client class in `apps/desktop/src/lib/api/<service>.ts` using native `fetch` with strict error handling.
3. Expose the user interface under `apps/desktop/src/features/<service>/` using `lucide-react` icons.
4. Mount the route in `apps/desktop/src/App.tsx` and register the navigation item in `apps/desktop/src/components/layout/Sidebar.tsx`.
5. Verify build with `bun run build`.

### Playbook B: Adding a New Typed MCP Tool
1. Define tool input schema and risk tier in `crates/kyvon-policy/src/tools.rs`.
2. Implement execution logic in `apps/mcp/src/main.rs`.
3. Ensure human approval gating is evaluated before any Tier 2 (Mutating Write) or Tier 3 (Destructive) action.
4. Verify tests with `cargo test --workspace --all-features --offline`.

### Playbook C: Incident Response & SRE Triage
1. Classify incident severity (P0-P3).
2. Query `/proc` telemetry via `kyvon-telemetry` without spawning subshells.
3. Generate root cause analysis using `GeminiOperations` or `VpsDiagnostics`.
4. Implement minimal viable fix through non-destructive systemctl or docker commands.
5. Record timeline and actions in blameless postmortem format.
