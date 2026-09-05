# KyvonOPS V3.0

<div align="center">

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/Filip2k03/kyvon_ops/actions)
[![Rust Tests](https://img.shields.io/badge/tests-170%2B%20passed-blue.svg)](crates/)
[![Tauri](https://img.shields.io/badge/tauri-v2.0-orange.svg)](https://tauri.app/)
[![MCP Compliant](https://img.shields.io/badge/mcp-json--rpc%202.0-purple.svg)](https://modelcontextprotocol.io/)
[![Cloudflare Tunnel](https://img.shields.io/badge/cloudflare-zero--open--port-amber.svg)](https://cloudflare.com)
[![License](https://img.shields.io/badge/license-MIT%2FApache-lightgrey.svg)](LICENSE)

**Sovereign Local-First DevOps Control Plane • Digital Twin Topology • Zero-Secret MCP Gateway • Mobile Companion**

🌐 **Production Ingress:** [https://kyvonops.sys.thuyakyaw.com](https://kyvonops.sys.thuyakyaw.com)

</div>

---

## 🌟 What is KyvonOPS?

**KyvonOPS** turns any standard Linux VPS, cloud node, or bare-metal host into a fully observable, autonomously mapped, and AI-collaborative infrastructure environment.

Instead of running an unrestricted shell or handing raw SSH private keys to AI models, KyvonOPS establishes a **strict cryptographic policy gateway**:
1. **One VPS Connection** → Automatically maps reverse proxies (Nginx), containers (Docker), systemd daemons, database sockets, and inbound DNS.
2. **Resource Ownership & Saturation Attribution** → Maps every cgroup v2 memory pressure stall, CPU load, and socket drop back to specific domains and sites.
3. **Outage Risk Forecasting** → Identifies memory leaks, inode exhaustion, and TLS expiration before incidents occur.
4. **Zero-Secret AI MCP Gateway** → Allows **Claude Code**, **OpenAI Codex Astra**, and **Cursor CLI** to safely diagnose, inspect, and draft repairs without ever exposing underlying SSH credentials.
5. **Infrastructure Command Companion** → Dedicated touch-first mobile interface for Android and iOS with biometric approvals (Face ID / Touch ID / Fingerprint).

---

## 🏗 Subagent Orchestration & AI Separation of Concerns

Per the KyvonOPS Security Architecture Specification ([`PROMPTS.md`](PROMPTS.md) & [`AGENTS.md`](AGENTS.md)), autonomous AI contributors operate under explicit capability boundaries:

| Agent / Model | Operational Boundary | Responsibilities |
| :--- | :--- | :--- |
| **Claude Opus** | Architecture, SRE, & Policy | System topology synthesis, risk scoring algorithms, SRE incident evaluation, and human approval gates. |
| **Agy Gemini 3.8** | **Strictly UI/UX & Design Humanization** | Lucide icon harmony (stroke 1.75), WCAG AAA contrast, mobile touch ergonomics (>=48px targets), and responsive styling. |
| **Codex Astra** | Core Systems & CLI Implementation | Rust command line interface (`kyvon`), low-overhead Musl agent probe (<4MB RSS), and storage schema migrations. |

> [!IMPORTANT]
> **Zero Credential Exposure Invariant**: All SSH keys, cloud tokens, and secrets remain securely inside the local OS Keychain. AI contributors receive structured, schema-validated capabilities—never credentials or unrestricted shell access.

---

## 📱 Platforms & Cross-Platform Support

```
┌───────────────────────────────────────────────────────────────────┐
│                           KyvonOPS V3.0                           │
├───────────────┬─────────────────┬────────────────┬────────────────┤
│    Desktop    │     Mobile      │      CLI       │      MCP       │
│ macOS / Linux │ Android (.apk)  │ `kyvon` binary │ Model Context  │
│   / Windows   │  iOS (.ipa)     │  100% Rust     │ JSON-RPC 2.0   │
└───────────────┴─────────────────┴────────────────┴────────────────┘
```

- **Desktop App**: High-performance Tauri 2.0 + React 18 + TypeScript + Tailwind CSS desktop binary.
- **Mobile Companion**: Native Android APK and iOS IPA packaging via Capacitor 8.5 with offline SQLite caching.
- **Unified CLI (`apps/cli`)**: Typed Rust CLI satisfying §102/§103 with built-in interactive confirmation gates (`kyvon server`, `kyvon site`, `kyvon deploy`, `kyvon incident`, `kyvon diagnose`).
- **Cloudflare Free Tier Tunnel**: Zero-open-port ingress with Full Strict TLS and automated systemd management.
- **QR Device Pairing & 2FA**: 60-second ephemeral nonce pairing, TOTP authentication, 8 emergency recovery codes, and biometric step-up gates.

---

## 🚀 Quickstart & Installation

### 1. Build and Run Desktop Application
```bash
# Clone the repository
git clone https://github.com/Filip2k03/kyvon_ops.git
cd kyvon_ops

# Run Rust workspace test suite
CARGO_INCREMENTAL=0 cargo test --workspace --all-features --offline

# Install frontend dependencies and launch dev server
cd apps/desktop
bun install
bun run dev
```

### 2. Build Unified CLI (`kyvon`)
```bash
# Compile the native CLI
cargo build --release -p kyvon-cli

# Verify subcommands
./target/release/kyvon --help
./target/release/kyvon server list
./target/release/kyvon site inspect api.example.com
```

### 3. Deploy to Production Host (`kyvonops.sys.thuyakyaw.com`)
```bash
# Run the automated host deployment pipeline
./scripts/deploy-host.sh
```

### 4. Build Mobile Packages (.apk / .ipa)
```bash
# Android APK
./scripts/build-apk.sh

# iOS IPA
./scripts/build-ipa.sh
```

---

## 🎨 UI/UX Design System & Ergonomic Standards

KyvonOPS V3.0 was designed and humanized in strict alignment with the **Agy Gemini 3.8 UI/UX Specification**:

- **Design System Metrics & Component Count**:
  - **48+ High-Performance Screens & Features**: Command Center, Digital Twin Explorer, VPS Health Matrix, QR Pairing & 2FA, Ingress Manager, Mobile Companion, Streaming Log Center, and Promotions Hub.
  - **65+ Lucide Icons**: Standardized to strict `stroke-width: 1.75` for visual harmony and contrast clarity.
  - **WCAG AAA Compliance**: Deep slate `#0d1117` base background with `#161b22` surfaces, `#21262d` borders, and high-contrast text (`#ffffff` and `#94a3b8`) providing $\ge 7:1$ contrast ratios.
  - **Mobile Touch Ergonomics**: Every interactive button, tab, and input enforces a minimum bounding box of $\ge 48\text{px}$ touch targets.
  - **425px Mobile Viewport Tuning**: Tailored for Mobile L (iPhone Pro Max, Pixel XL) with zero text wrapping, slide-over drawer menus, and fixed bottom navigation bars.
  - **Interactive 3D WebGL / Canvas**: Real-time rotating holographic server rigs and particle digital twins on the public landing page with drag-to-rotate interaction.

---

## 💻 External Developer Guide & Self-Hosting

KyvonOPS is fully self-contained and engineered so **any external developer or operations team** can install, run, contribute, and update the codebase without external SaaS prerequisites:

```bash
# Prerequisites: Rust 1.78+, Node.js 20+ (or Bun 1.1+), and Git
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -fsSL https://bun.sh/install | bash

# 1. Clone repository
git clone https://github.com/Filip2k03/kyvon_ops.git
cd kyvon_ops

# 2. Run test suites
CARGO_INCREMENTAL=0 cargo test --workspace --all-features --offline

# 3. Launch desktop/web development frontend
cd apps/desktop
bun install
bun run dev

# 4. Build native desktop app (Tauri 2)
bun run tauri build

# 5. Build native Rust CLI binary
cargo build --release -p kyvon-cli
```

---

## 🔒 Security Architecture

- **Capability-Based Writes**: Mutating operations (restarts, rollbacks, deployments) pass through a 4-tier risk classification engine (Tier 0 Read, Tier 1 Non-Destructive, Tier 2 Restart/Reconfig, Tier 3 Destructive).
- **Environment Locks**: Distributed mutex prevents concurrent mutations on the same target node or site.
- **Audit Ledger**: Every operation, approval, rejection, and CLI execution is committed to an immutable append-only SQLite log.
- **Secret Redactor Pipeline**: High-entropy strings, private keys, JWTs, and bearer tokens are automatically redacted from stdout, stderr, and model transcripts before leaving the device.

---

## 💖 Support & Community

KyvonOPS is independent, open-source software built for sovereign infrastructure engineers.

If KyvonOPS saves your servers from downtime or streamlines your deployments:
- **Contribute & Sponsor**: Choose from **$5**, **$10**, **$15**, **$25**, or custom amounts via the built-in [Stripe Donation Portal](https://kyvonops.sys.thuyakyaw.com/downloads).
- **Report an Issue**: File bug reports and feature requests on [GitHub Issues](https://github.com/Filip2k03/kyvon_ops/issues).

---

## 📄 License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT License](LICENSE-MIT) at your option.
