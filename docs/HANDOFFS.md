# KyvonOPS V3.0: Frontend & Systems Architecture Handoffs Specification

> **Classification**: Pacific Standard Production Directive  
> **Audience**: Autonomous AI Engineers (Codex Astra, Claude Opus, Agy Gemini 3.8) & Principal Full-Stack SREs  
> **Repository Target**: `kyvon_ops` (Tauri 2, Rust, React 19, TypeScript, Capacitor 8)

---

## 1. Executive Summary & Core Architectural Invariants

KyvonOPS V3.0 is a sovereign, local-first DevOps control plane, deployment intelligence platform, and Model Context Protocol (MCP) security gateway. It establishes encrypted, multiplexed SSH channels directly from the operator's workstation to target Linux VPS nodes, entirely bypassing centralized SaaS telemetry proxies.

### Critical Invariants (Never Violate)
1. **Agent Asymmetry**: The AI model is **never** an SSH client. External models (Codex Astra, Claude Opus, Agy Gemini 3.8) never possess SSH private keys, passphrases, or root passwords. They interact exclusively with typed MCP tools governed by human approval gates.
2. **Local-First Cryptographic Keyring**: Credentials remain strictly within the operating system keychain (`keyring` crate) or encrypted local SQLite WAL tables. No secret may ever appear in logs, terminal history, or MCP responses.
3. **No Mock Data in Production**: Telemetry, DNS records, SSL certificates, and AI recommendations consume real-world REST and IPC endpoints (`/proc` virtual filesystem, Cloudflare API v4, Google Gemini v1beta, Stripe Hosted Checkout).
4. **Zero-Fork Syscall Telemetry**: The remote agent (`agent/src/main.rs`) is statically linked via `x86_64-unknown-linux-musl` with zero dynamic runtime dependencies. Telemetry is parsed directly from `/proc` and `/sys` to prevent fork-bomb saturation.
5. **Memory Constraint**: The remote agent daemon must never exceed 4MB resident set size (RSS) under full telemetry workloads.

---

## 2. API Contract & Real-World Service Integrations

### 2.1 Cloudflare Edge & Reverse Proxy Controller
- **Client**: `apps/desktop/src/lib/api/cloudflare.ts`
- **Base Endpoint**: `https://api.cloudflare.com/client/v4`
- **Authentication**: Bearer Token with scopes `Zone.DNS (Edit)` and `Zone.SSL (Edit)`.
- **Operations**:
  - `listZones()`: Enumerates active authoritative domain zones.
  - `listDnsRecords(zoneId)`: Queries A, AAAA, CNAME, and TXT records with proxy status (`proxied: true` for CDN/DDoS shielding).
  - `createDnsRecord(zoneId, record)`: Provisions new edge DNS routing.
  - `updateSslMode(zoneId, mode)`: Configures Edge SSL/TLS mode (`strict`, `full`, `flexible`, `off`).
  - `purgeCache(zoneId, payload)`: Triggers instant cache invalidation across 330+ Cloudflare global PoPs.

### 2.2 Hardened Ingress Generators (Caddy & Nginx)
- **Generator**: `apps/desktop/src/lib/api/reverseProxy.ts`
- **Caddy Directives**: Automatic HTTPS via Let's Encrypt or Cloudflare Origin CA, `zstd gzip` compression, and Pacific Standard security headers (`Strict-Transport-Security`, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`).
- **Nginx Directives**: Upstream keepalive pools, HTTP/2 multiplexing, WebSocket connection upgrades (`$http_upgrade`), and `CF-Connecting-IP` remote address forwarding.

### 2.3 Gemini AI Operations & UI/UX Co-pilot
- **Client**: `apps/desktop/src/lib/api/gemini.ts`
- **Base Endpoint**: `https://generativelanguage.googleapis.com/v1beta`
- **Models**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`
- **Use Cases**:
  - **UI/UX Optimization**: Audits responsive layouts, typography scale, WCAG AAA color contrast, and suggests Lucide React icon improvements.
  - **DevOps Incident Radar**: Correlates kernel Memory PSI stalls, Nginx 502 Bad Gateways, and cgroups v2 OOM-kills to generate actionable, non-destructive remediation commands.

### 2.4 Stripe Donation & Community Sponsorship
- **Client**: `apps/desktop/src/lib/api/stripe.ts`
- **Presets**: `$5` (Coffee), `$10` (Server), `$15` (Enthusiast), `$25` (Architect Patron), and Custom Dollar Amount.
- **Workflow**: Initiates Stripe Hosted Checkout sessions with donor receipts and metadata tagging.

---

## 3. Humanized Luxury Industrial Design System

The KyvonOPS interface adheres to a refined Luxury Industrial visual design language engineered for operational clarity during high-stakes incidents:

| Token | Value | Semantic Intent |
| :--- | :--- | :--- |
| `bg-background` | `#090a0f` | Deep obsidian backdrop reducing eye fatigue |
| `bg-surface` | `#12141c` | Elevated card container with subtle 1px border |
| `bg-elevated` | `#181b26` | Interactive hover state and pill badge background |
| `border-border` | `#232738` | Low-contrast structural borders |
| `text-primary` | `#f1f5f9` | High-contrast body and title typography |
| `text-secondary` | `#94a3b8` | Subdued metadata, timestamps, and labels |
| `text-info` | `#38bdf8` | Primary active accent and focus rings |
| `text-emerald-400` | `#34d399` | Nominal health, 99.99% uptime, verified signatures |
| `text-amber-400` | `#fbbf24` | Capacity headroom warnings, elevated risk scores |
| `text-rose-400` | `#f87171` | Critical blast conditions, OOM events, port drops |

### Icon System Invariant
- **Rule**: Never use emojis, raw unicode glyphs, or unstyled symbols in production UI components.
- **Standard**: All icons must be imported from `lucide-react` with consistent stroke width:
  ```tsx
  <Server className="w-4 h-4 text-info stroke-[1.75]" />
  ```

---

## 4. Mobile Architecture (.apk & .ipa)

KyvonOPS targets cross-platform mobile environments using Capacitor 8:
- **App Identifier**: `com.kyvon.ops`
- **Configuration**: `apps/desktop/capacitor.config.ts`
- **Touch Ergonomics**: All interactive buttons enforce a minimum 48px × 48px touch target.
- **Safe Area Insets**: Layout headers and bottom navigation adapt automatically to hardware notches:
  ```css
  padding-top: max(env(safe-area-inset-top), 1rem);
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
  ```
- **Automated Packaging**:
  - Android APK: `bash scripts/build-apk.sh` (outputs to `apps/desktop/android/app/build/outputs/apk/`)
  - iOS IPA: `bash scripts/build-ipa.sh` (syncs Capacitor and invokes Xcode archiving)

---

## 5. Model Context Protocol (MCP) Security Pipeline

```
[Agent JSON-RPC Request]
         │
         ▼
[1. Capability Verification] ──► (Profile: Observer | Developer | Operator | Admin)
         │
         ▼
[2. Risk Classification]
  ├── Tier 0: Context (Zero side-effects) ──► Auto-approved (SQLite Cache)
  ├── Tier 1: Safe Read (Diagnostics)     ──► Auto-approved (Bounded duration)
  ├── Tier 2: Mutating Write (Restart)    ──► Interactive Human Modal Confirmation
  └── Tier 3: Destructive (Drop/Prune)    ──► Explicit Verification Token Required
         │
         ▼
[3. Cryptographic Secret Redaction] ──► (Scrub private keys, auth tokens, passwords)
         │
         ▼
[4. Output Delivery to Agent]
```

---

## 6. Pre-Flight Verification Checklist

Before releasing any changes or pushing commits:
1. `cargo test --workspace --all-features --offline` must pass with **170+ tests and 0 failures**.
2. `bun run build` in `apps/desktop` must compile cleanly with **0 TypeScript lint errors**.
3. All network operations must retain complete offline graceful degradation and error handling.
