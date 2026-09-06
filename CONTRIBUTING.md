# Contributing to KyvonOPS V4.1

Thank you for your interest in contributing to **KyvonOPS**. KyvonOPS is a local-first infrastructure control plane for DevOps engineers, sysadmins, and AI-assisted operations. Read `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md` before changing behavior.

---

## 🏛 Monorepo Architecture

```text
├── apps/
│   ├── desktop/          # Tauri 2 + React 18 + TypeScript + Tailwind UI
│   ├── cli/              # Native Rust unified CLI (`kyvon`) satisfying §102/§103
│   └── mcp/              # Policy-controlled Model Context Protocol server
├── crates/
│   ├── kyvon-core/       # Core domain types, errors, and shared abstractions
│   ├── kyvon-security/   # Cryptographic key custody, redactor, and audit
│   ├── kyvon-topology/   # Digital twin graph synthesis and resource attribution
│   ├── kyvon-diagnostics/# Outage risk scoring and capacity saturation engine
│   ├── kyvon-telemetry/  # Cgroups v2, PSI memory pressure, and socket readers
│   ├── kyvon-ssh/        # Direct SSH multiplexing and connection pool
│   ├── kyvon-storage/    # Local SQLite store with WAL mode
│   └── kyvon-policy/     # 4-tier risk gate and human approval engine
├── agent/                # Lightweight Musl static telemetry probe (<4MB RSS)
├── database/migrations/  # Append-only SQLite migrations
├── scripts/              # Build & deployment helpers (APK, IPA, host deploy)
└── docs/                 # Product specifications, handoffs, and protocols
```

---

## 🛠 Local Development Environment Setup

### 1. Prerequisites
- **Rust Toolchain**: 1.78+ (`rustup default stable`)
- **JavaScript Runtime**: Bun 1.1+ (or Node.js 20+)
- **Build Tools**:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux (Debian/Ubuntu): `sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev`
  - Windows: Visual Studio C++ Build Tools

### 2. Fork and Clone
```bash
git clone https://github.com/<your-username>/kyvon_ops.git
cd kyvon_ops
git checkout -b feat/your-feature-name
```

### 3. Verify Local Build
Run the workspace test suite:
```bash
# Set CARGO_INCREMENTAL=0 on memory-constrained systems
CARGO_INCREMENTAL=0 cargo test --workspace --all-features --offline
```

Start the frontend development server:
```bash
cd apps/desktop
bun install
bun run dev
```

---

## 🎨 UI/UX Design Standards (Agy Gemini 3.8 Specification)

All user interface contributions must comply with the design invariants:
1. **Lucide Icons**: Every icon must specify `strokeWidth={1.75}` for visual weight consistency across the application.
2. **WCAG AAA Contrast**: Use `#ffffff` for primary text and `#94a3b8` for secondary text against `#0d1117` / `#161b22` surfaces ($\ge 7:1$ contrast ratio).
3. **Touch Targets**: Mobile buttons, toggles, tabs, and list items must have a minimum interactive bounding box of $\ge 48\text{px}$.
4. **425px Mobile Viewport**: Verify that cards and tables do not break or cause horizontal window scrolling at a viewport width of `425px` (Mobile L).

---

## 🔒 Security & Policy Invariants

1. **No Raw Credential Exposure**: Never expose private keys, passwords, or authentication tokens to AI model transcripts or logs. Passwords and passphrases reside in the OS Keychain.
2. **Capability Gates**: All mutating write operations must pass through the `kyvon-policy` approval engine.
3. **No Fake Telemetry**: Never hardcode placeholder or synthetic metrics. If data has not been measured yet, render through `NoDataState` with `Loaded<T>` distinction.

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat(telemetry): add cgroup memory pressure calculation`
- `fix(policy): reject expired approval requests`
- `style(mobile): tune padding for 425px screens`
- `docs(readme): add external developer quickstart`

---

## 🚀 Pull Request Checklist

Before submitting a pull request:
- [ ] Run `cargo fmt --all -- --check` (0 formatting differences)
- [ ] Run `cargo clippy --workspace --all-targets --all-features -- -D warnings` (0 warnings)
- [ ] Run `cargo test --workspace --all-features` (All tests pass)
- [ ] Run `cd apps/desktop && bun run build` (0 TypeScript / bundling errors)
- [ ] Verify changes on both Desktop and Mobile (425px) viewports
