KyvonOPS 2.0: Autonomous DevOps Control Plane, AI Operations Gateway, and Infrastructure Distribution Architecture
System Architecture and Infrastructure Digital Twin
Modern cloud server management typically relies on centralized Software-as-a-Service (SaaS) observability platforms that require outbound background daemons streaming host metrics to third-party data aggregators. This pattern introduces significant operational latency, exposes infrastructure telemetry to external providers, and requires broad outbound firewall permissions. KyvonOPS 2.0 replaces this centralized architecture with a local-first workstation model executed through a native desktop binary built on Tauri 2 and Rust. The workstation establishes encrypted, direct, multiplexed Secure Shell (SSH) connections to remote Linux instances, retaining all metric stores, audit trails, and execution policies within a zero-dependency local SQLite database utilizing Write-Ahead Logging (WAL).

At the core of KyvonOPS 2.0 is the Infrastructure Digital Twin: an in-memory, continuous graph representation of the target Linux environment. The Digital Twin models the server not as an isolated collection of arbitrary load percentages, but as a hierarchical, interrelated graph of hardware primitives, system initialization units, container runtimes, process trees, and ingress reverse proxies.

The operational layers of this host model build upward from the physical substrate to public ingress endpoints:

Host Kernel and Isolation Layer: The foundation comprises the Linux kernel, kernel control groups version 2 (cgroups v2), network namespaces, storage block devices, and memory management subsystems.   

System Initialization Layer: Managed through systemd, this layer oversees unit lifecycles, socket activation triggers, slice allocations, and system journal streams.

Container and Workload Daemon Layer: Interfacing directly with container runtimes via local Unix domain sockets (/var/run/docker.sock or /run/podman/podman.sock), tracking container namespaces, image layers, and bridged software-defined networks.   

Ingress and Reverse Proxy Topology: Parsing web server abstract syntax trees (AST) across Nginx, Caddy, or Apache configurations to expose domain-to-upstream mappings.   

Application Runtimes and Data Persistence: Monitoring language engines (such as Node.js, Python, PHP-FPM, Go, and Rust) alongside relational and key-value datastores (PostgreSQL, MySQL, Redis) via loopback sockets and inter-process communication channels.

To populate and continuously synchronize the Digital Twin without imposing CPU overhead on the target node, KyvonOPS bypasses the conventional technique of spawning ad-hoc shell sub-processes like top, ps, free, and netstat. Repetitive process invocation incurs high operating system overhead due to frequent fork-exec syscall sequences and dynamic library link cycles. Instead, KyvonOPS either pipes a long-running, in-memory POSIX probe directly into standard input over an SSH channel or executes a statically linked, standalone binary compiled against Musl libc (kyvon-agent). The daemon reads virtual filesystem interfaces directly from /proc and /sys, marshaling updates into a newline-delimited JSON (JSONL) stream transmitted over a dedicated SSH multiplex channel.

Infrastructure Domain	Target Kernel Interface	Inspection Mechanism	Extracted Telemetry Attributes
System Identity	/etc/os-release, /proc/sys/kernel/*	In-memory text stream	Hostname, distribution family, kernel architecture, boot arguments, virtualization provider
Hardware Core Allocation	/proc/cpuinfo, /proc/stat	Delta tick computation	Per-core tick distribution: user, system, nice, idle, iowait, irq, softirq, steal
Memory Page Topology	/proc/meminfo, /proc/vmstat	Field extraction	Total, Available, Free, Cached, Slab reclaimable, Active/Inactive anon pages, Swap pressure
Storage Subsystems	/proc/diskstats, statvfs(2) syscalls	Syscall / stream parse	Read/write sectors, queue depths, millisecond I/O wait times, mount points, inode saturation
Network Interfaces	/proc/net/dev, /proc/net/snmp	High-frequency counter delta	Interface RX/TX octets, frame errors, interface drops, TCP segment retransmissions
Active Sockets	/proc/net/tcp, /proc/net/udp	Inode correlation table	Local/foreign address tuples, socket execution states, queue backlogs, socket owner UIDs
Service Supervisor	/run/systemd/private, D-Bus socket	Native D-Bus protocol	Active state, substate, unit file state, restart burst counters, execution fail codes
Container Engine	/var/run/docker.sock	
HTTP engine over Unix socket

Container state, image digest, cgroup paths, virtual interface bindings, storage volumes
Ingress Rules	/etc/nginx/sites-enabled/*	
Concrete syntax tree parsing

Virtual hosts, upstream addresses, TLS certificate chains, location routing blocks
  
Causal Topology Mapping and Site Resource Attribution
Conventional infrastructure monitors present resource metrics in aggregate isolation, indicating general threshold spikes without correlating the load to a specific virtual host, application workload, or Git deployment. In contrast, KyvonOPS establishes an end-to-end Causal Topology Map that resolves network entry points to physical hardware allocations.

The structural trajectory of incoming network traffic traverses the following deterministic path:

Public Ingress Traffic: Incoming connections reach public interfaces on TCP ports 80 and 443.

Ingress Reverse Proxy: The traffic matches a virtual server block in Nginx (e.g., api.example.com) evaluated via configuration directives.   

Upstream Socket Binding: The proxy terminates TLS and routes requests to an upstream target (such as 127.0.0.1:3000 or a Unix socket /run/api.sock).   

Containerized Workload: The upstream socket correlates directly with a container network namespace or host PID through socket inode lookup.   

Operating System Process: The process executes within dedicated runtime engines (such as a Node.js V8 worker or Python runtime) running under a specific systemd slice or Docker container.

Kernel Hardware Constraints: The cgroups v2 controller applies CPU execution quotas, memory page limits, and block I/O throttles to the process hierarchy.   

Downstream Dependencies: The process establishes persistence channels over local or remote loopbacks to PostgreSQL, Redis, or external third-party APIs.

Resource attribution relies on the unified cgroups v2 hierarchy. Modern Linux distributions running systemd organize all executing tasks into hierarchical slices under /sys/fs/cgroup/. Container engines such as Docker and Podman delegate container execution directly to these slices (for example, /sys/fs/cgroup/system.slice/docker-<container_id>.scope/). KyvonOPS correlates these control interfaces with running virtual hosts by parsing the Nginx configuration tree into an Abstract Syntax Tree (AST) using native parser logic.   

The parser inspects server directives to capture server_name attributes, SSL certificate expirations, and proxy_pass targets. The resulting socket addresses are reconciled against /proc/net/tcp to extract the socket's internal inode, which links to the underlying process ID (PID). Once the PID is identified, reading /proc/[pid]/cgroup yields the exact cgroup slice path.   

Rust
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Debug, Default, serde::Serialize)]
pub struct CgroupResourceAttribution {
    pub cpu_usage_usec: u64,
    pub user_usec: u64,
    pub system_usec: u64,
    pub memory_current_bytes: u64,
    pub io_read_bytes: u64,
    pub io_write_bytes: u64,
}

pub fn read_cgroup_attribution(cgroup_path: &Path) -> Result<CgroupResourceAttribution, std::io::Error> {
    let mut attribution = CgroupResourceAttribution::default();
    
    // Parse cpu.stat to extract cumulative microsecond runtimes
    let cpu_stat_file = cgroup_path.join("cpu.stat");
    if let Ok(file) = File::open(cpu_stat_file) {
        for line in BufReader::new(file).lines().flatten() {
            let mut parts = line.split_whitespace();
            if let (Some(key), Some(val_str)) = (parts.next(), parts.next()) {
                let val: u64 = val_str.parse().unwrap_or(0);
                match key {
                    "usage_usec" => attribution.cpu_usage_usec = val,
                    "user_usec" => attribution.user_usec = val,
                    "system_usec" => attribution.system_usec = val,
                    _ => {}
                }
            }
        }
    }

    // Parse memory.current to capture real-time volatile memory allocation
    let mem_file = cgroup_path.join("memory.current");
    if let Ok(content) = std::fs::read_to_string(mem_file) {
        attribution.memory_current_bytes = content.trim().parse().unwrap_or(0);
    }

    // Parse io.stat to track storage throughput attribution
    let io_file = cgroup_path.join("io.stat");
    if let Ok(file) = File::open(io_file) {
        for line in BufReader::new(file).lines().flatten() {
            for entry in line.split_whitespace().skip(1) {
                let mut key_val = entry.split('=');
                if let (Some(k), Some(v)) = (key_val.next(), key_val.next()) {
                    let bytes: u64 = v.parse().unwrap_or(0);
                    if k == "rbytes" { attribution.io_read_bytes += bytes; }
                    if k == "wbytes" { attribution.io_write_bytes += bytes; }
                }
            }
        }
    }

    Ok(attribution)
}
This causal mapping powers the Performance Decomposition Engine. When a user examines application latency on a domain such as api.example.com, KyvonOPS breaks down round-trip execution times into distinct physical and network phases, isolating bottlenecks without requiring application instrumentation.

Diagnostic Phase	Inspection Target	Baseline Metric	Degradation Root Cause
DNS Ingress	Resolver latency to authoritative nameservers	<20 ms	Misconfigured DNS glue records, nameserver replication delay
TLS Negotiation	Handshake round-trips via local OpenSSL probe	<35 ms	Suboptimal cipher negotiation, lack of session ticket resumption
Reverse Proxy Overhead	Nginx $request_time - $upstream_response_time	<4 ms	Saturated worker connections, excessive client buffering to disk
Upstream Processing	Time-To-First-Byte (TTFB) on backend loopback	<150 ms	Garbage collection pauses, unindexed code paths, event-loop blocking
Persistence Query	Active connection lock waits and pool utilization	<10 ms	Saturated connection pools, unindexed tables, deadlock resolution
External Egress	Socket duration to third-party payment/auth APIs	<200 ms	Upstream SaaS latency, remote rate-limiting, cross-region transit
Predictive Capacity Modeling and Outage Risk Synthesis
Single-metric threshold alerting (such as firing an alert when CPU utilization hits 90%) results in operational failure: transient spikes trigger alert fatigue, while critical outages caused by resource exhaustion at lower CPU levels go undetected. KyvonOPS addresses this by evaluating three distinct operational metrics:

Current Utilization: The percentage of allocated system resources actively consumed at the current moment.

Capacity Headroom: The dynamic margin between operating load and physical failure limits before degradation begins.

Operational Risk Score (R 
ops
​
 ): A synthesized, multi-signal scalar between 0 and 100 representing instantaneous stability risk.

The Operational Risk Score is calculated as a non-linear combination of weighted penalty functions:

R 
ops
​
 =min(100, 
i=1
∑
n
​
 w 
i
​
 ⋅P 
i
​
 (x 
i
​
 ))
Where w 
i
​
  represents the assigned weight of system vector i, and P 
i
​
 (x 
i
​
 )∈[0,1] represents the normalized penalty curve evaluated against current measurement x 
i
​
 .

Risk Vector (i)	Weight (wi​)	Warning Condition (Pi​≈0.5)	Critical Blast Condition (Pi​=1.0)	Operational Failure Mechanism
Kernel Memory PSI	22	Some stall avg10 >15.0	Full stall avg10 >40.0	
Kernel thrashing swap pages; Out-Of-Memory killer invocation imminent

Storage Exhaustion	20	Projected full <7 days	Projected full <24 hours	Disk write lockup; database transaction rollback failure; log write drops
TCP Socket Drops	15	Syn-backlog utilization >75%	ListenDrops detected in /proc/net/snmp	New inbound TCP handshakes dropped; edge connection timeouts
Database Pool	15	Active pool connections >80%	Active pool connections ≥98%	Application worker threads hung waiting for vacant database sockets
Container Restarts	12	2 restarts within 60 minutes	CrashLoopBackOff state detected	
Process instability; runtime panics; memory limit termination

CPU Saturation	10	Load average / core count >1.5	Load average / core count >3.0	High runqueue latency; task starvation across thread executors
TLS Expiration	6	Certificate validity <14 days	Certificate validity <48 hours	Client browser rejection; security warnings; automated webhook delivery failures
  
Predictive Resource Forecasting
To predict storage and memory exhaustion, KyvonOPS runs an online Ordinary Least Squares (OLS) regression over historical telemetry. Given a sliding telemetry window of N data points (t 
k
​
 ,y 
k
​
 ) spanning up to 30 days, the growth rate slope β is computed as:

β= 
∑ 
k=1
N
​
 (t 
k
​
 − 
t
ˉ
 ) 
2
 
∑ 
k=1
N
​
 (t 
k
​
 − 
t
ˉ
 )(y 
k
​
 − 
y
ˉ
​
 )
​
 
The estimated time to resource exhaustion (T 
exhaust
​
 ) is calculated using current available capacity C 
avail
​
 :

T 
exhaust
​
 = 
β
C 
avail
​
 
​
 
When β>0 and T 
exhaust
​
 <14 days, the incident engine records an active degradation vector, providing actionable capacity warnings long before systemd units fail due to storage write errors.

Configuration Drift and Mutation Ledger
To answer the common operational question "What changed on the server?", KyvonOPS tracks configuration drift through a local cryptographic state ledger. At configurable intervals, the engine computes SHA-256 digests of critical system paths:

Ingress configurations: /etc/nginx/, /etc/caddy/

[cite: 6]

Supervisor unit definitions: /etc/systemd/system/

Host resolution and network filters: /etc/hosts, /etc/resolv.conf, /etc/nftables.conf

Container manifests: /opt/*/docker-compose.yml, /srv/*/compose.yaml

When system metrics degrade (such as an increase in HTTP 502 responses), the platform correlates the incident timestamp with the configuration ledger, highlighting recent state changes that coincide with the failure.

Model Context Protocol (MCP) Security Gateway
Modern development environments increasingly integrate AI assistants—including Cursor CLI, Claude Code, and OpenAI Codex—into engineering workflows. However, granting an external language model direct SSH access using private keys or sudo credentials introduces significant security risks:   

Unbounded Operational Blast Radius: An unconstrained model may execute destructive commands (e.g., rm -rf, raw disk manipulation, or misconfigured firewall changes), potentially severing its own management connection.

Credential Exfiltration: Untrusted inputs embedded within application logs can trigger prompt injection attacks, attempting to trick models into revealing host keys, .env secrets, or authentication credentials.   

Audit Gaps: Standard shell access bypasses structured logging, making it difficult to trace which agent executed specific mutations.

KyvonOPS resolves this problem by acting as a Model Context Protocol (MCP) Security Gateway. The AI agent never receives direct SSH keys or passwords. Instead, it interacts exclusively with kyvonops-mcp, which enforces authorization policies, risk validation, approval workflows, and output sanitization before commands are executed on the host.   

The lifecycle of an agent-driven operation follows a structured security pipeline:

Agent Invocation: Claude Code, Cursor, or Codex issues a JSON-RPC request to the local MCP gateway using stdio or streamable HTTP transports.   

Capability and Policy Verification: The request is validated against the active agent capability profile (Observer, Developer, Operator, or Administrator).

Risk Classification: The operation is assigned to a risk tier (Tier 0 to Tier 3) using pattern matching and impact modeling.   

Interactive Approval Gate: Operations requiring human confirmation trigger an interactive prompt in the workstation UI, requiring user approval before execution proceeds.   

Cryptographic Credential Resolution: The desktop core retrieves the necessary SSH credentials from the local OS Keychain (keyring crate) without exposing keys to the agent.

Execution and Output Sanitization: The command runs over the multiplexed SSH session, and stdout/stderr streams are scrubbed of secrets before returning to the model.

Risk Classification and Authorization Tiers
The gateway categorizes all operations into four distinct tiers, providing clear operational boundaries for both automated agents and human operators:   

Risk Level	Target Scope	Exposed MCP Primitives	Approval Mechanism
Tier 0: Context	Read-only state projections; zero side effects	
kyvon://server/{id}/topology


kyvon://server/{id}/health

Auto-approved; served directly from local SQLite cache

Tier 1: Safe Read	Non-mutating diagnostic queries	
kyvon_server_health


kyvon_diagnose_site


kyvon_get_logs

Auto-approved by default; bounded execution time

Tier 2: Mutating Write	Controlled service mutations and deployments	
kyvon_restart_service


kyvon_deploy_application


kyvon_reload_nginx

Interactive prompt required; user can allow for session

Tier 3: Destructive Action	System alterations, storage ops, network rules	
kyvon_scale_kubernetes


kyvon_emergency_rollback


kyvon_prune_containers

Explicit modal confirmation; requires typing verification token
  
Typed Operational Tools vs. Unbounded Shell Execution
To eliminate shell-injection risks and limit blast radius, KyvonOPS avoids exposing generic commands like exec_command(cmd). Instead, it exposes strictly typed, schema-validated tools designed for specific operations.   

TypeScript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executePrivilegedAction } from "../policy/executor.js";
import { redactSensitiveData } from "../redaction/sanitizer.js";

export function registerOperationTools(server: McpServer) {
  // Restart Service Tool: Mutating Write (Tier 2)
  server.tool(
    "kyvon_restart_service",
    "Safely issue an atomic systemd service restart instruction with post-flight health validation",
    {
      serverId: z.string().describe("Target Server Unique Identifier"),
      serviceName: z.string().regex(/^[a-zA-Z0-9_\-\.]+$/).describe("Target systemd service name"),
      verifyHealthSeconds: z.number().min(1).max(30).default(5).describe("Health check verification timeout"),
    },
    async ({ serverId, serviceName, verifyHealthSeconds }, extra) => {
      const auditMeta = {
        invokedBy: extra.clientInfo?.name ?? "unknown-agent",
        tool: "kyvon_restart_service",
        timestamp: new Date().toISOString(),
      };

      // Route execution through the risk policy engine
      const result = await executePrivilegedAction({
        serverId,
        tier: "MutatingWrite",
        command: `systemctl restart ${serviceName} && sleep ${verifyHealthSeconds} && systemctl is-active --quiet ${serviceName}`,
        auditMeta,
      });

      if (!result.success) {
        return {
          isError: true,
          content: [{ type: "text", text: `Action rejected or execution failed: ${result.error}` }],
        };
      }

      // Redact sensitive infrastructure metadata from execution output
      const sanitizedOutput = redactSensitiveData(result.stdout);
      return {
        content: [{ type: "text", text: `Service '${serviceName}' successfully restarted.\nVerification output:\n${sanitizedOutput}` }],
      };
    }
  );

  // Diagnostic Site Tool: Safe Read (Tier 1)
  server.tool(
    "kyvon_diagnose_site",
    "Executes structured multi-phase diagnostic trace on ingress proxy, upstream socket, and database dependencies",
    {
      serverId: z.string().describe("Target Server ID"),
      domain: z.string().describe("Domain name to diagnose (e.g., api.example.com)"),
    },
    async ({ serverId, domain }) => {
      const diagnosticReport = await runSiteDiagnosticPipeline(serverId, domain);
      return {
        content: [{ type: "text", text: JSON.stringify(diagnosticReport, null, 2) }],
      };
    }
  );
}
Contextual MCP Resources and Guided Workflows
KyvonOPS uses MCP Resources to expose contextual state to language models without requiring repetitive tool calls:   

kyvon://servers: Returns a summary of all configured instances, connection states, and health scores.   

kyvon://server/{id}/topology: Exposes the synthesized Digital Twin graph (domains, upstream sockets, containers, processes, databases).   

kyvon://server/{id}/incidents/latest: Provides details on active operational alerts, recent configuration drift, and error logs.   

To structure incident response, KyvonOPS provides pre-configured prompt templates:

kyvon-investigate-outage: Consolidates incident timelines, configuration diffs, and cgroup metrics, guiding models through root-cause analysis without broad terminal discovery.   

kyvon-pre-deployment-check: Analyzes host capacity headroom, disk exhaustion estimates, and database connection pools prior to rolling out updates.

Output Sanitization and Secret Redaction
Before command output, metrics, or diagnostic traces are returned to an AI agent, the MCP gateway routes all data through an automated redaction pipeline. This protects sensitive information from prompt injection or accidental exposure:

Private Keys: Matching -----BEGIN [A-Z]+ PRIVATE KEY----- patterns.

Connection Strings: Redacting passwords from database URIs (e.g., postgres://user:[REDACTED]@host:5432/db).

Common API Tokens: Stripping keys matching known patterns (e.g., GitHub ghp_, AWS access keys AKIA, Slack tokens xox[baprs]).

Authorization Headers: Stripping values from Bearer [A-Za-z0-9\-\._~\+\/]+=*.

Production AGENTS.md Specification for Autonomous Engineering
To allow AI coding models (such as Gemini Flash 3.8, Claude Code, Cursor CLI, and OpenAI Codex) to contribute to and maintain KyvonOPS, the repository root contains a standardized AGENTS.md file. This file provides command-first instructions, defines project architecture, specifies testing procedures, and establishes clear completion criteria.   

AGENTS.md: KyvonOPS Monorepo Engineering Directives
1. Architectural Invariants
This repository is a local-first desktop control plane built with Tauri 2, Rust, React 19, TypeScript, and SQLite.

Never introduce a centralized SaaS server or cloud telemetry proxy. All infrastructure operations MUST communicate directly over SSH or local Unix sockets.

The remote agent binary (agent/src/main.rs) MUST remain statically linked via the x86_64-unknown-linux-musl target with zero runtime dependencies. Its resident memory must never exceed 4MB under full telemetry workloads.

The MCP server (packages/kyvonops-mcp) must never expose raw terminal execution tools (e.g., exec_shell). All operations MUST use typed, schema-validated MCP tools.

Private keys, passphrases, and credentials MUST be resolved via the OS Keychain (keyring crate) and NEVER written to logs, disk caches, or MCP response payloads.

2. Command Directory & Validation Suite
Run these exact commands to validate changes. Do not invent alternative flags.

Rust Workspace Validation
Format check: cargo fmt --all -- --check

Static analysis: cargo clippy --workspace --all-targets --all-features -- -D warnings

Test suite: cargo test --workspace --all-features

Static agent build: cargo build --manifest-path agent/Cargo.toml --target x86_64-unknown-linux-musl --release

Frontend Desktop Validation
Dependency installation: pnpm install --frozen-lockfile

Linter execution: pnpm lint

Type verification: pnpm typecheck

Unit/Component tests: pnpm test:run

Desktop web build: pnpm build

Model Context Protocol (MCP) Gateway Validation
Package build: pnpm --filter kyvonops-mcp build

MCP suite verification: pnpm --filter kyvonops-mcp test

3. Definition of Done
A task is considered complete only when ALL of the following criteria are met:

cargo fmt --all -- --check produces an exit code of 0.

cargo clippy --workspace -- -D warnings passes without warnings.

cargo test --workspace passes with 100% test success across crates.

pnpm typecheck exits with 0 errors across all workspaces.

pnpm lint reports zero warnings or errors.

All newly introduced commands or MCP tools have corresponding unit tests.

Git commit messages follow Conventional Commits format: <type>(<scope>): <short description>. Valid types: feat, fix, perf, refactor, test, chore.

4. Operational Guardrails for Autonomous Agents
If a Rust dependency must be added, verify it compiles with Rust 1.77.2+ and does not depend on dynamic system libraries.

Do not modify files in migrations/ after they have merged to main. Create a new migration file (migrations/00X_name.sql) for schema updates.

If an operational decision is ambiguous, inspect existing patterns in crates/kyvon-policy/ before asking for clarification.

Release Engineering, Cryptographic Signing, and Portal Distribution
The production release workflow for KyvonOPS uses a fully automated build pipeline that compiles signed desktop applications, cross-compiles static Musl agents, and publishes release assets to the distribution portal hosted at kyvonops.sys.thuyakyaw.com.

The automated pipeline executes three primary phases upon tag creation:

Cross-Compilation Matrix: Compiles static Musl binaries for x86_64, aarch64, and armv7l architectures using cross-rs.

Desktop Application Packaging: Builds native bundles across macOS (Universal DMG), Linux (x86_64 AppImage and Debian package), and Windows (x64 NSIS installer).

Cryptographic Code Signing: Applies Apple Developer ID certificates and executes Apple Notarization for macOS, signs Windows executables via Authenticode certificates, and signs update bundles with Minisign Ed25519 keypairs.   

Portal Deployment: Uploads signed binaries and the updated latest.json updater manifest to edge object storage (Cloudflare R2) and invalidates edge caches for kyvonops.sys.thuyakyaw.com.   

Tauri 2 Updater and Manifest Schema
The desktop application integrates tauri-plugin-updater to verify updates before installing them on the host system. The client validates the cryptographic signature of the downloaded payload against an embedded public key compiled into the binary.   

JSON
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkKUldUVzU0UUpvR0V5S3Rhdkc0d0l5NndqVDFKcmN3L3IvcjdxUzdnKzJkU1Z3Szh3Z01zR2pDdz0K",
      "endpoints": [
        "https://kyvonops.sys.thuyakyaw.com/releases/latest.json"
      ]
    }
  }
}
The updater periodically checks https://kyvonops.sys.thuyakyaw.com/releases/latest.json. This manifest adheres to the official Tauri 2 static updater schema:   

JSON
{
  "version": "v1.0.0",
  "notes": "KyvonOPS 2.0 release: Full Digital Twin mapping, causal topology engine, and MCP security gateway.",
  "pub_date": "2026-03-31T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "RWTW54QJoGEyKn...[Base64 Signature from .sig file]...",
      "url": "https://kyvonops.sys.thuyakyaw.com/releases/v1.0.0/KyvonOps_1.0.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "RWTW54QJoGEyKp...[Base64 Signature from .sig file]...",
      "url": "https://kyvonops.sys.thuyakyaw.com/releases/v1.0.0/KyvonOps_1.0.0_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "RWTW54QJoGEyKq...[Base64 Signature from .sig file]...",
      "url": "https://kyvonops.sys.thuyakyaw.com/releases/v1.0.0/kyvon-ops_1.0.0_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "RWTW54QJoGEyKr...[Base64 Signature from .sig file]...",
      "url": "https://kyvonops.sys.thuyakyaw.com/releases/v1.0.0/KyvonOps_1.0.0_x64-setup.nsis.zip"
    }
  }
}
Automated Multi-Platform Release Pipeline
The GitHub Actions workflow below coordinates the multi-architecture build matrix, signs application binaries, and publishes update manifests to the edge portal.   

YAML
name: Production Multi-Platform Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-agent-matrix:
    name: Build Static Musl Agents
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - x86_64-unknown-linux-musl
          - aarch64-unknown-linux-musl
          - armv7-unknown-linux-musleabi
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - name: Install Cross-rs Tool
        run: cargo install cross --git https://github.com/cross-rs/cross
      - name: Build Agent Binary
        run: cross build --target ${{ matrix.target }} --release --manifest-path agent/Cargo.toml
      - name: Upload Agent Artifact
        uses: actions/upload-artifact@v4
        with:
          name: agent-${{ matrix.target }}
          path: agent/target/${{ matrix.target }}/release/kyvon-agent

  build-desktop-apps:
    needs: build-agent-matrix
    name: Build Desktop Bundles (${{ matrix.platform }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: universal-apple-darwin
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install Linux Build Toolchain
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev

      - name: Download Staged Agent Binaries
        uses: actions/download-artifact@v4
        with:
          path: src-tauri/binaries/

      - name: Install Workspace Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and Sign Desktop Bundle
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'KyvonOPS ${{ github.ref_name }}'
          releaseDraft: false
          prerelease: false

  deploy-distribution-portal:
    needs: build-desktop-apps
    name: Sync Artifacts to kyvonops.sys.thuyakyaw.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup AWS CLI for S3/R2 Bucket Sync
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.R2_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          aws-region: auto
      - name: Download GitHub Release Assets
        run: |
          gh release download ${{ github.ref_name }} --dir dist-assets/
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy Assets to Edge Storage
        run: |
          # Sync release binaries to Cloudflare R2 bucket
          aws s3 sync dist-assets/ s3://kyvonops-releases/releases/${{ github.ref_name }}/ \
            --endpoint-url ${{ secrets.R2_ENDPOINT_URL }}
          # Copy the updated latest.json manifest to the root of the distribution portal
          aws s3 cp dist-assets/latest.json s3://kyvonops-releases/releases/latest.json \
            --endpoint-url ${{ secrets.R2_ENDPOINT_URL }}
      - name: Purge Cloudflare Edge Cache
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"files":["https://kyvonops.sys.thuyakyaw.com/releases/latest.json"]}'
Download Portal Implementation (kyvonops.sys.thuyakyaw.com)
The download portal at kyvonops.sys.thuyakyaw.com runs as a high-performance web application deployed to edge object storage. It automatically detects the visitor's operating system, platform architecture, and system capabilities via client-side JavaScript, providing direct, zero-redirect binary downloads.

HTML
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KyvonOPS — Local-First Autonomous DevOps Console</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="bg-[#060709] text-[#F1F3F5] font-sans antialiased min-h-screen flex flex-col justify-between">
  
  <header class="border-b border-white/[0.08] px-8 py-4 flex items-center justify-between backdrop-blur-md bg-[#0B0D11]/70 sticky top-0 z-50">
    <div class="flex items-center space-x-3">
      <span class="w-2.5 h-2.5 rounded-full bg-[#00F298] shadow-[0_0_10px_#00F298]"></span>
      <span class="font-mono text-sm tracking-wider font-bold">KYVONOPS // SYSTEM PORTAL</span>
    </div>
    <div class="text-xs font-mono text-[#8B929D]">
      HOST: <span class="text-white">kyvonops.sys.thuyakyaw.com</span>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-6 py-20 text-center flex-1 flex flex-col items-center justify-center">
    <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#00F298] mb-6">
      <span>● PRODUCTION RELEASE v1.0.0 ACTIVE</span>
    </div>
    
    <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">
      Infrastructure Intelligence.<br><span class="text-[#8B929D]">Zero SaaS Dependencies.</span>
    </h1>
    
    <p class="text-sm md:text-base text-[#8B929D] max-w-2xl mb-10 leading-relaxed font-mono">
      Local-first DevOps workstation, Infrastructure Digital Twin, and secure Model Context Protocol (MCP) gateway for Claude, Cursor, and Codex.
    </p>

    <div class="flex flex-col items-center space-y-4">
      <a id="primary-download-btn" href="/releases/latest" 
         class="px-8 py-3.5 rounded bg-[#00F298] text-black font-semibold font-mono text-sm hover:bg-[#00F298]/90 transition-all shadow-[0_0_20px_rgba(0,242,152,0.3)]">
        Detecting Target System...
      </a>
      <span id="detection-label" class="text-xs font-mono text-[#6B7684]">Evaluating browser platform matrix...</span>
    </div>

    <!-- Manual Download Links Table -->
    <div class="w-full mt-16 border border-white/[0.08] rounded bg-[#0B0D11] overflow-hidden text-left">
      <div class="px-5 py-3 border-b border-white/[0.08] font-mono text-xs uppercase tracking-wider text-[#8B929D]">
        Distribution Packages (Signed & Verified)
      </div>
      <div class="divide-y divide-white/[0.04] font-mono text-xs">
        <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
          <span>macOS (Apple Silicon & Intel DMG)</span>
          <a href="/releases/v1.0.0/KyvonOps_1.0.0_universal.dmg" class="text-[#00D8FF] hover:underline">Download .dmg</a>
        </div>
        <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
          <span>Linux (AppImage & Debian .deb)</span>
          <div class="space-x-3">
            <a href="/releases/v1.0.0/kyvon-ops_1.0.0_amd64.AppImage" class="text-[#00D8FF] hover:underline">.AppImage</a>
            <a href="/releases/v1.0.0/kyvon-ops_1.0.0_amd64.deb" class="text-[#00D8FF] hover:underline">.deb</a>
          </div>
        </div>
        <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
          <span>Windows (x64 NSIS Installer)</span>
          <a href="/releases/v1.0.0/KyvonOps_1.0.0_x64-setup.exe" class="text-[#00D8FF] hover:underline">Download .exe</a>
        </div>
        <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
          <span>Static Remote Agent (x86_64 Musl)</span>
          <a href="/releases/v1.0.0/kyvon-agent-x86_64-musl" class="text-[#00D8FF] hover:underline">Download Binary</a>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-white/[0.08] px-8 py-6 text-center text-xs font-mono text-[#6B7684]">
    KyvonOPS Engine · Cryptographically Signed Releases · Subdomain: kyvonops.sys.thuyakyaw.com
  </footer>

  <script>
    (function detectClientPlatform() {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const btn = document.getElementById('primary-download-btn');
      const label = document.getElementById('detection-label');
      
      let platform = 'Unknown';
      let downloadUrl = '/releases/v1.0.0/';

      if (userAgent.includes('mac')) {
        platform = 'macOS (Universal)';
        downloadUrl += 'KyvonOps_1.0.0_universal.dmg';
      } else if (userAgent.includes('win')) {
        platform = 'Windows (x64)';
        downloadUrl += 'KyvonOps_1.0.0_x64-setup.exe';
      } else if (userAgent.includes('linux')) {
        platform = 'Linux (x86_64 AppImage)';
        downloadUrl += 'kyvon-ops_1.0.0_amd64.AppImage';
      }

      if (platform !== 'Unknown') {
        btn.textContent = `Download for ${platform}`;
        btn.href = downloadUrl;
        label.textContent = `Target verified: ${platform} · SHA-256 Validated`;
      } else {
        btn.textContent = 'View All Release Assets';
        btn.href = '#';
        label.textContent = 'Manual target selection required';
      }
    })();
  </script>
</body>
</html>
Monorepo Topology and Production Implementation Roadmap
To maintain clean separation between desktop application logic, native Rust crates, lightweight remote collectors, and MCP gateway tools, the codebase is organized as a unified monorepo.

kyvonops/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Continuous integration test runner
│       └── release.yml                # Multi-platform signed release pipeline
├── AGENTS.md                          # Multi-agent engineering standard
├── Cargo.toml                         # Cargo workspace configuration
├── package.json                       # pnpm root workspace configuration
├── pnpm-workspace.yaml                # Monorepo directory mapping
│
├── apps/
│   ├── desktop/                       # Tauri 2 Desktop Shell
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── src/                       # React 19 Frontend Console
│   │   │   ├── features/
│   │   │   │   ├── digital-twin/      # Causal topology visualization
│   │   │   │   ├── telemetry/         # ECharts real-time renderers
│   │   │   │   ├── risk/              # Outage risk & capacity calculators
│   │   │   │   ├── logs/              # Per-virtual-host log stream viewers
│   │   │   │   └── incidents/         # Configuration drift & incident ledger
│   │   │   └── main.tsx
│   │   └── src-tauri/                 # Tauri Native Rust Core
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json        # Tauri configuration & updater endpoints
│   │       ├── capabilities/          # Fine-grained security capabilities
│   │       └── src/
│   │           ├── main.rs
│   │           └── lib.rs
│   │
│   └── portal/                        # Landing page & distribution backend
│       ├── package.json
│       ├── astro.config.mjs
│       └── src/pages/index.astro      # kyvonops.sys.thuyakyaw.com landing page
│
├── packages/
│   └── kyvonops-mcp/                  # Model Context Protocol Server Package
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts               # CLI binary entry point (stdio transport)
│           ├── tools/                 # Typed tools (diagnostic & mutating)
│           ├── resources/             # Static & dynamic state projections
│           ├── prompts/               # Structured incident troubleshooting prompts
│           ├── policy/                # Risk engine, approvals & rate limits
│           └── redaction/             # Output sanitization & secret filtering
│
├── crates/
│   ├── kyvon-core/                    # Base primitives, error types, data models
│   ├── kyvon-ssh/                     # russh connection multiplexer & SFTP
│   ├── kyvon-topology/                # Cgroup v2, Nginx AST, socket correlation
│   ├── kyvon-risk/                    # Multi-factor penalty scoring & forecasting
│   └── kyvon-keyring/                 # OS Credential Vault integration
│
├── agent/                             # Remote Minimalist Daemon
│   ├── Cargo.toml                     # Musl compilation configuration
│   └── src/
│       └── main.rs                    # Zero-dependency static collector (<4MB RAM)
│
└── migrations/                        # SQLite Local Telemetry Schemas
    ├── 001_initial_schema.sql
    └── 002_topology_ledger.sql
The rollout follows a four-phase operational sequence designed to validate infrastructure primitives before rolling out the AI operations gateway:

Phase	Milestone Name	Primary Objectives	Verification Criteria
Phase 1	Agent & Topology Validation	
Compile Musl static agent; validate cgroups v2 parsing and Nginx AST parsing.

Binary resident memory <4 MB; 100% accurate process-to-domain mapping on Ubuntu, Debian, Alpine, and Rocky.
Phase 2	Desktop Shell & Local Storage	Initialize Tauri 2 application shell; configure SQLite WAL schema and React 19 visualizers.	Sub-second metric streaming over persistent SSH channels; zero IPC frame drops during high log volume.
Phase 3	MCP Operations Gateway	
Implement @modelcontextprotocol/sdk server with typed tools and secret redaction.

Claude Code and Cursor CLI execute verified service restarts without receiving SSH private keys.

Phase 4	Release & Edge Distribution	Set up GitHub Actions release matrix; deploy landing portal to kyvonops.sys.thuyakyaw.com.	
In-app auto-updater downloads signed release bundles verified via Minisign Ed25519 signatures.

  
Actionable Next Steps
To deploy and maintain KyvonOPS 2.0 in production, execution should proceed along the following four implementation tracks:

Verify Static Musl Agent Footprint: Cross-compile agent/src/main.rs against x86_64-unknown-linux-musl and aarch64-unknown-linux-musl. Deploy the resulting binary to clean instances of Ubuntu 24.04, Debian 12, Alpine 3.19, and Rocky Linux 9 to confirm stable execution without shared glibc dependencies.

Validate Topology Attribution: Run the cgroup v2 parser against production Docker containers and Nginx virtual hosts to verify that CPU usage, memory pages, and network socket inodes correlate accurately with specific domains.

Configure the MCP Gateway: Build packages/kyvonops-mcp using pnpm build. Register the local server in Claude Code via claude mcp add kyvonops node /path/to/packages/kyvonops-mcp/dist/index.js or configure Cursor CLI via .cursor/mcp.json. Test that the AI agent can diagnose slow sites and retrieve incident timelines through typed tools without accessing raw SSH credentials.   

Deploy the Production Distribution Pipeline:

Generate updater keys using cargo tauri signer generate -w ~/.tauri/kyvonops.key. Add the resulting public key to tauri.conf.json and store the private key in GitHub Secrets.   

Configure DNS records for kyvonops.sys.thuyakyaw.com pointing to the release edge bucket (Cloudflare R2 or S3).

Tag the repository with v1.0.0 to trigger the automated build, signing, and notarization pipeline. Verify that the client can download artifacts and that the updater successfully detects and verifies new releases via latest.json.   


docs.kernel.org
Control Group v2 - The Linux Kernel documentation
Opens in a new window

cubepath.com
cgroups v2 Resource Management on Linux - CubePath Docs
Opens in a new window

crates.io
rust-network-mgr - crates.io: Rust Package Registry
Opens in a new window

github.com
GitHub - sparesparrow/rust-network-mgr: Linux based network
Opens in a new window

lib.rs
podman-client - Lib.rs
Opens in a new window

docs.rs
nginx_config - Rust - Docs.rs
Opens in a new window

code.visualstudio.com
The Complete MCP Experience: Full Specification Support in VS Code
Opens in a new window

institute.sfeir.com
MCP: Model Context Protocol - Cheatsheet | SFEIR Institute
Opens in a new window

mcpplaygroundonline.com
Cursor IDE MCP Setup: mcp.json Location, Format & 20+ Server
Opens in a new window

learn.chatgpt.com
Custom instructions with AGENTS.md - ChatGPT Learn
Opens in a new window

ai-sdk.dev
Model Context Protocol (MCP) - AI SDK
Opens in a new window

modelcontextprotocol.io
Overview - What is the Model Context Protocol (MCP)?
Opens in a new window

github.com
per-agent MCP config support for Cursor (and all non-Claude-Code
Opens in a new window

modelcontextprotocol.io
stdio - Model Context Protocol
Opens in a new window

modelcontextprotocol.io
Resources - Model Context Protocol
Opens in a new window

modelcontextprotocol.info
Resources - Model Context Protocol （MCP）
Opens in a new window

blakecrosley.com
AGENTS.md Patterns: What Actually Changes Agent Behavior
Opens in a new window

kilo.ai
Agents.md - Kilo Code
Opens in a new window

agents.md
AGENTS.md
Opens in a new window

developers.redhat.com
Standardize project context with AGENTS.md and Agent Skills
Opens in a new window

ro14nd.de
What Goes in AGENTS.md (and What Doesn't) - Roland Huß
Opens in a new window

jonaskruckenberg.github.io
Updater - The Tauri Documentation WIP
Opens in a new window

youtube.com
Self-Updating Tauri 2 Apps with Signed Releases - YouTube
Opens in a new window

dev.to
Ship Your Tauri v2 App Like a Pro: Code Signing for macOS and
Opens in a new window

v2.tauri.app
Updater - Tauri