# KYVONOPS V3.0

## Full-Stack DevOps Intelligence, Mobile Operations, Secure MCP & AI Agent Platform

You are the principal software architect and implementation agent for **KyvonOPS V3.0**.

Build this as a production-grade infrastructure operations platform for:

* DevOps engineers
* Software engineers
* Freelancers
* System administrators
* Technical founders
* Development teams
* Small infrastructure teams

KyvonOPS must combine:

1. Desktop DevOps application
2. Android application
3. iOS application
4. Local-first infrastructure management
5. VPS/cloud server discovery
6. Deployment intelligence
7. Nginx intelligence
8. Docker intelligence
9. Kubernetes intelligence
10. Application/site resource attribution
11. Logs and diagnostics
12. Capacity/outage-risk analysis
13. Cloudflare integration
14. Secure QR-based device pairing
15. Strong authentication and 2FA
16. MCP server
17. AI-agent integration
18. Codex integration
19. Claude Code integration
20. Gemini CLI/agent integration
21. Cursor CLI integration
22. Secure credential custody
23. Audit and approval workflows

Do not build a fake dashboard.

Every metric must originate from real infrastructure data.

Every button must perform a real operation or clearly state that the feature is unavailable.

Do not use placeholder telemetry.

Do not hard-code fake VPS information.

Do not expose SSH passwords/private keys to AI agents.

Do not create an unrestricted generic shell-execution MCP tool.

---

# 1. PRODUCT ARCHITECTURE

Build:

```text
                         KYVONOPS V3.0
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
     Desktop               Mobile                CLI
     Tauri 2              Android/iOS          Terminal
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                       KyvonOPS Core
                              │
             ┌────────────────┼────────────────┐
             │                │                │
            SSH             Agent             MCP
             │                │                │
             └────────────────┼────────────────┘
                              │
                       Policy Engine
                              │
                    Credential Resolver
                              │
                              ▼
                 VPS / Cloud Infrastructure
```

AI agents:

```text
Codex
Claude Code
Gemini CLI / Agent
Cursor CLI
        │
        ▼
   KyvonOPS MCP
        │
        ▼
 Authorization
        │
        ▼
 Policy / Risk Engine
        │
        ▼
 SSH / Agent
        │
        ▼
 VPS
```

---

# 2. MONOREPO

Use a monorepo.

Recommended:

```text
kyvonops/
├── apps/
│   ├── desktop/
│   ├── mobile/
│   ├── cli/
│   └── mcp/
│
├── crates/
│   ├── kyvon-core/
│   ├── kyvon-ssh/
│   ├── kyvon-agent/
│   ├── kyvon-telemetry/
│   ├── kyvon-topology/
│   ├── kyvon-diagnostics/
│   ├── kyvon-security/
│   ├── kyvon-policy/
│   ├── kyvon-audit/
│   ├── kyvon-deployment/
│   ├── kyvon-storage/
│   └── kyvon-events/
│
├── agent/
│   ├── collectors/
│   ├── discovery/
│   ├── health/
│   ├── network/
│   ├── docker/
│   ├── kubernetes/
│   ├── nginx/
│   └── systemd/
│
├── packages/
│   ├── shared-types/
│   ├── protocol/
│   ├── ui/
│   ├── charts/
│   └── security/
│
├── integrations/
│   ├── cloudflare/
│   ├── github/
│   ├── gitlab/
│   ├── docker/
│   ├── kubernetes/
│   ├── nginx/
│   ├── postgres/
│   ├── mysql/
│   └── redis/
│
├── mcp/
│   ├── tools/
│   ├── resources/
│   ├── prompts/
│   ├── policies/
│   ├── approvals/
│   ├── redaction/
│   └── auth/
│
├── mobile/
│   ├── android/
│   └── ios/
│
├── database/
├── migrations/
├── tests/
├── benchmarks/
├── scripts/
├── docs/
└── README.md
```

---

# 3. TECHNOLOGY STACK

## Desktop

Use:

* Tauri 2
* Rust
* Tokio
* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand
* SQLite
* SQLx
* xterm.js
* Monaco Editor
* ECharts

Desktop must remain local-first.

No mandatory KyvonOPS cloud backend.

---

# 4. MOBILE

Build one cross-platform mobile application using:

* React Native
* Expo
* TypeScript
* Expo Router
* NativeWind
* Secure storage
* Biometric authentication
* Push notifications
* Deep linking
* QR scanning

Target:

```text
Android
Android 10+

iOS
iOS 16+
```

Keep the architecture capable of native modules when required.

Mobile must not store SSH private keys or raw passwords in ordinary application storage.

---

# 5. MOBILE PURPOSE

The mobile application is not simply a smaller desktop dashboard.

It is an:

# Infrastructure Command Companion

Mobile should prioritize:

```text
Health
Incidents
Alerts
Servers
Sites
Deployments
Logs
Security
Approvals
Emergency operations
```

Desktop provides deep administration.

Mobile provides:

```text
Observe
Investigate
Approve
Respond
```

---

# 6. MOBILE HOME

Build:

```text
KYVONOPS

Infrastructure Health

Overall
92 / 100

Servers
12
Healthy 10
Warning 1
Critical 1

Sites
84
Healthy 81
Warning 2
Down 1

Deployments
26

Incidents
2
```

Show:

```text
CPU
RAM
Disk
Network
Capacity
Availability
```

Do not overload the mobile screen.

Use cards with drill-down navigation.

---

# 7. MOBILE SERVER VIEW

Example:

```text
production-01

● HEALTHY

CPU
62%

RAM
71%

Disk
68%

Load
2.31

Network
8.2 MB/s

Uptime
47d

Capacity
82%
```

Tabs:

```text
Overview
Apps
Containers
Processes
Services
Logs
Network
Security
Deployments
```

---

# 8. MOBILE VPS INVENTORY

Automatically show:

```text
OS
Kernel
CPU
RAM
Disk
Swap
Network
IPv4
IPv6
Hostname
Provider
Region
Uptime
Architecture
Virtualization
```

Then:

```text
Detected Software

Nginx
Docker
Kubernetes
PostgreSQL
Redis
Node
Python
PHP
systemd
```

---

# 9. MOBILE APPLICATION DISCOVERY

Show:

```text
Applications

api.example.com
website.example.com
admin.example.com
worker
billing
```

Each application:

```text
Status
CPU
RAM
Network
Latency
Errors
Deployment
Container
Process
Database
Dependencies
```

---

# 10. MOBILE SITE DETAIL

For:

```text
api.example.com
```

show:

```text
HTTP
✓

TLS
✓

DNS
✓

Nginx
✓

Backend
⚠

Database
⚠
```

Metrics:

```text
Requests/min
Latency
p50
p95
p99
4xx
5xx
timeout
connections
```

---

# 11. MOBILE LOG CENTER

Support:

```text
Nginx access
Nginx error
Docker logs
systemd journal
Kubernetes logs
application logs
SSH logs
security logs
```

Provide:

```text
Search
Filter
Time range
Severity
Site
Container
Service
```

Never load millions of log lines into mobile memory.

Use streaming/pagination.

---

# 12. MOBILE INCIDENTS

Create:

```text
Incidents

🔴 API outage
Production
Started 4m ago

🟡 Disk pressure
Client B
Started 2h ago
```

Incident detail:

```text
Impact
High

Affected
api.example.com

Root cause
Database connection saturation

Evidence
DB connections +42%
API latency +380%
Errors +7%
```

---

# 13. MOBILE APPROVAL CENTER

Critical feature.

When AI or desktop proposes an operation:

```text
APPROVAL REQUIRED

Restart nginx

Server
production-01

Reason
Invalid configuration reload recovery

Risk
LOW

Expected impact
Minimal

Requested by
Claude Code

[Approve]
[Reject]
```

For critical operations:

```text
[Approve with biometric]
```

Require:

```text Face ID
Touch ID
Android Biometrics
device PIN fallback where appropriate
```

---

# 14. SECURE QR DEVICE PAIRING

Implement QR pairing.

Desktop:

```text
Settings
→ Devices
→ Pair Mobile Device
```

Generate a short-lived pairing QR.

QR must contain only a pairing bootstrap payload.

Never encode:

```text
SSH password
SSH private key
Cloudflare API token
database password
raw secret
```

QR payload should contain:

```text
protocol_version
device_pairing_id
server_endpoint
short_lived_nonce
expiration
signature
```

Example conceptual payload:

```json
{
  "v": 3,
  "pairing_id": "pair_xxxxx",
  "endpoint": "local-or-approved-endpoint",
  "nonce": "xxxxx",
  "expires_at": 0000000000,
  "signature": "xxxxx"
}
```

The QR expires quickly.

Target:

```text
60-120 seconds
```

Allow manual cancellation.

---

# 15. MOBILE PAIRING FLOW

```text
Desktop
 ↓
Generate pairing request
 ↓
QR
 ↓
Mobile scans
 ↓
Validate signature
 ↓
Validate expiration
 ↓
User confirms device name
 ↓
Biometric enrollment
 ↓
Secure key exchange
 ↓
Desktop confirms
 ↓
Device paired
```

Display:

```text
MacBook Pro
Paired
Last seen: now
```

---

# 16. DEVICE IDENTITY

Each mobile device receives a cryptographic identity.

Do not identify devices only by:

```text
device name
```

Use:

```text
device_id
public key
key fingerprint
created_at
last_seen
platform
app_version
```

Private device key remains in secure platform storage.

---

# 17. MOBILE AUTHENTICATION

Implement:

```text
Password/passwordless account layer where applicable
+
TOTP
+
WebAuthn/passkeys
+
biometrics
+
device-bound keys
```

Never implement your own cryptography.

Use established libraries and platform APIs.

---

# 18. TWO-FACTOR AUTHENTICATION

Support:

```text
TOTP
Authenticator apps
Passkeys/WebAuthn
Recovery codes
Biometric device approval
```

Recovery codes:

* generated securely
* shown once
* hashed at rest
* revocable
* auditable

Never log them.

---

# 19. STEP-UP AUTHENTICATION

Normal operation:

```text
View server
```

No additional approval.

Sensitive:

```text
restart production service
```

Require:

```text biometric / local authorization
```

Critical:

```text firewall change
credential rotation
database destructive operation
server deletion
```

Require:

```text biometric
+
explicit confirmation
+
risk explanation
```

---

# 20. MOBILE OFFLINE MODE

Mobile should cache:

```text
server inventory
last known health
last incidents
last deployments
```

Clearly mark:

```text
Last synchronized
3m ago
```

Never pretend cached metrics are live.

---

# 21. PUSH NOTIFICATIONS

Support:

```text
server down
site down
deployment failed
certificate expiring
disk critical
RAM pressure
OOM
container crash
Kubernetes pod crash
security event
AI approval request
```

Notification:

```text
KyvonOPS

🔴 Production API is unhealthy

Error rate:
8.2%

Open incident
```

Do not expose secrets in notifications.

---

# 22. CLOUDflare INTEGRATION

Build Cloudflare integration as an optional edge layer.

Support:

```text
DNS
Zones
DNS records
Proxy status
SSL/TLS
Origin health
Cache
WAF status
Rate limiting
Workers
Pages
Tunnel where applicable
Analytics
```

Do not require Cloudflare for local SSH management.

---

# 23. CLOUDFLARE FREE PLAN COMPATIBILITY

Design deployment so the application can operate with free-tier Cloudflare-compatible components where available.

Use:

```text
Cloudflare DNS
Cloudflare proxy
Cloudflare Pages where appropriate
Cloudflare Workers where appropriate
Cloudflare Tunnel where appropriate
```

Do not assume every Cloudflare feature exists on every plan.

Detect availability and clearly display:

```text
Available
Unavailable on current plan
Requires upgrade
Not configured
```

Never silently require a paid feature.

---

# 24. SAFE CLOUDFLARE TOKEN MANAGEMENT

Prefer scoped API tokens.

Never ask for the global Cloudflare API key when a scoped token can perform the task.

Store the token in:

```text
OS keychain
```

or a supported external secrets manager.

Never:

```text
print token
send token to AI
store token in SQLite plaintext
commit token to Git
put token into QR
```

---

# 25. CLOUDFLARE DEPLOYMENT MODEL

Support:

```text
Developer
 ↓
Git
 ↓
Build
 ↓
KyvonOPS
 ↓
Cloudflare / VPS
 ↓
Health check
```

Deployment target:

```text
VPS
Docker
Kubernetes
Cloudflare Pages
Cloudflare Workers
```

The UI must clearly identify the target.

---

# 26. FREE HOSTING DEPLOYMENT MODE

Create:

# Free/Low-Cost Deployment Advisor

User selects:

```text
Project
```

KyvonOPS detects:

```text
Framework
Runtime
Build command
Output directory
Environment variables
Database requirement
Persistent storage requirement
Expected traffic
```

Then recommends:

```text
Static frontend
→ Cloudflare Pages

Edge/API
→ Cloudflare Workers if compatible

Traditional backend
→ VPS

Docker workload
→ VPS/Docker

Kubernetes workload
→ Kubernetes
```

Never force a serverless platform on workloads requiring:

```text
persistent filesystem
long-running processes
WebSockets unsupported by target
special system dependencies
GPU
privileged networking
```

---

# 27. DEPLOYMENT PREFLIGHT

Before deployment:

```text
Runtime detected
✓

Build
✓

Environment
✓

Git clean
✓

Secrets configured
✓

DNS
✓

SSL
✓

Target reachable
✓

Disk capacity
✓

Memory capacity
✓
```

Then:

```text
Deployment readiness
94 / 100
```

---

# 28. DEPLOYMENT LOAD ANALYSIS

Before deployment estimate:

```text
Current VPS

CPU
62%

RAM
71%

Disk
68%
```

Application expected:

```text
CPU
+18%

RAM
+1.2GB

Disk
+8GB
```

Projected:

```text
CPU
80%

RAM
78%

Disk
71%
```

Then:

```text
Deployment capacity
SAFE
```

If projected CPU becomes:

```text
97%
```

show:

```text
DO NOT DEPLOY

Projected CPU saturation:
97%

Likely risk:
HIGH
```

---

# 29. SITE RESOURCE OWNERSHIP

Every site should map:

```text
Domain
 ↓
DNS
 ↓
Cloudflare
 ↓
Nginx
 ↓
Upstream
 ↓
Container/Pod
 ↓
Process
 ↓
CPU/RAM
 ↓
Database
 ↓
External dependencies
```

Show resource contribution.

---

# 30. SERVER CAPACITY ENGINE

Calculate separately:

```text
CPU utilization
RAM utilization
Disk utilization
Disk I/O pressure
Network saturation
Load average
Connection pressure
Database pressure
Application latency
Error rate
Container instability
Kubernetes instability
```

Produce:

```text
Resource utilization
Capacity headroom
Operational risk
```

Do not equate:

```text
CPU 95%
```

with:

```text
95% probability of outage
```

These are different concepts.

---

# 31. OUTAGE RISK

Create:

```text
Operational Risk
```

Levels:

```text
0-20
Healthy

21-40
Low

41-60
Moderate

61-80
High

81-95
Critical

96-100
Severe
```

Make thresholds configurable.

Explain the score.

Example:

```text
Risk: 76

Contributors:

RAM pressure        +18
DB connections      +17
Disk I/O             +9
HTTP latency        +14
Container restarts    +8
CPU pressure         +10
```

---

# 32. FORECASTING

Use historical telemetry.

Show:

```text
Current
62%

+1h
65%

+6h
70%

+24h
78%

+7d
88%
```

Calculate confidence.

Example:

```text
Forecast confidence
78%
```

Never present uncertain forecasts as guaranteed events.

---

# 33. SERVER DIGITAL TWIN

Create an internal graph model:

```text
Server
├── Resources
├── Interfaces
├── Ports
├── Services
├── Processes
├── Containers
├── Kubernetes
├── Sites
├── Databases
├── Certificates
├── Deployments
└── Dependencies
```

This graph powers:

```text
Search
Diagnostics
Incident analysis
Resource attribution
AI context
```

---

# 34. DEPENDENCY GRAPH

Example:

```text
Cloudflare
    ↓
Nginx
    ↓
Frontend
    ↓
API
 ┌──┴──────┐
 ↓         ↓
Redis   PostgreSQL
 ↓
Worker
 ↓
External API
```

When a dependency fails:

```text
Blast radius:
API
Checkout
Worker
Customer portal
```

---

# 35. DOCKER

Support:

```text
containers
images
networks
volumes
compose
resource limits
restarts
healthchecks
logs
ports
environment metadata
```

Never expose environment variables containing secrets to AI or UI unless explicitly authorized.

Redact:

```text
PASSWORD
TOKEN
SECRET
API_KEY
PRIVATE_KEY
AUTHORIZATION
```

---

# 36. KUBERNETES

Support discovery of:

```text
clusters
nodes
namespaces
deployments
statefulsets
daemonsets
pods
services
ingress
configmaps
secrets metadata
persistent volumes
events
```

Never automatically return Kubernetes Secret contents.

Display:

```text
Secret
● Present
```

not:

```text
password=...
```

---

# 37. NGINX

Detect:

```text
server blocks
upstreams
listen ports
TLS
certificates
access logs
error logs
worker status
connection status
```

Build:

```text
Domain → Server Block → Upstream → Application
```

---

# 38. DATABASE MONITORING

PostgreSQL:

```text
connections
locks
slow queries
database size
table size
cache hit ratio
transactions
replication
```

MySQL:

```text
connections
threads
queries
slow queries
locks
buffer pool
replication
```

Redis:

```text
memory
clients
commands/sec
evictions
hit rate
persistence
```

Never expose database credentials to AI.

---

# 39. MCP ARCHITECTURE

Build:

```text
mcp/
├── server
├── auth
├── policy
├── tools
├── resources
├── prompts
├── approvals
├── redaction
├── audit
└── transport
```

Support appropriate MCP transports for local and remote deployments.

Prefer local transport for local desktop integrations where possible.

---

# 40. MCP READ TOOLS

Implement:

```text
kyvon_server_list
kyvon_server_get
kyvon_server_health
kyvon_server_metrics
kyvon_server_capacity
kyvon_server_inventory

kyvon_site_list
kyvon_site_get
kyvon_site_health
kyvon_site_metrics
kyvon_site_logs

kyvon_process_list
kyvon_service_list

kyvon_nginx_status
kyvon_nginx_sites

kyvon_docker_list
kyvon_docker_inspect

kyvon_kubernetes_status
kyvon_kubernetes_pods

kyvon_database_status

kyvon_security_status

kyvon_incident_list
kyvon_change_list

kyvon_deployment_list
kyvon_deployment_get

kyvon_topology
```

---

# 41. MCP DIAGNOSTIC TOOLS

Implement:

```text
kyvon_diagnose_server
kyvon_diagnose_site
kyvon_diagnose_cpu
kyvon_diagnose_memory
kyvon_diagnose_disk
kyvon_diagnose_network
kyvon_diagnose_database
kyvon_diagnose_container
kyvon_diagnose_kubernetes
kyvon_diagnose_deployment
kyvon_diagnose_incident
```

Each should return:

```text
observations
evidence
possible_causes
confidence
recommended_actions
risk
```

---

# 42. MCP WRITE TOOLS

Use typed tools:

```text
kyvon_restart_service
kyvon_restart_container
kyvon_reload_nginx
kyvon_deploy
kyvon_rollback
kyvon_scale_workload
kyvon_enable_maintenance
kyvon_disable_maintenance
```

Do NOT expose unrestricted:

```text
execute_shell(command)
```

as the normal AI interface.

---

# 43. HUMAN APPROVAL ENGINE

Operations:

```text
READ
LOW RISK
MEDIUM RISK
HIGH RISK
CRITICAL
```

Example:

```text
restart nginx
LOW

restart application
MEDIUM

production deployment
HIGH

firewall modification
HIGH

database destructive action
CRITICAL
```

Require approval according to policy.

---

# 44. AI AGENT IDENTITY

Every MCP client receives an identity:

```text
agent_id
agent_name
client
version
workspace
user
permissions
```

Examples:

```text
codex-production-agent
claude-production-agent
gemini-dev-agent
cursor-development-agent
```

---

# 45. AI CAPABILITY PROFILES

Implement:

```text
observer
developer
operator
administrator
emergency
```

Example:

```text
observer
READ ONLY

developer
READ + staging operations

operator
READ + production operational actions

administrator
full controlled operations
```

---

# 46. SERVER-SCOPED AUTHORIZATION

Permissions must support:

```text
agent
user
server
environment
application
operation
time
```

Example:

```text
Claude Code

Allowed:
staging-01

Denied:
production-01
```

Another:

```text
Codex

Allowed:
production deployment

Denied:
firewall changes
credential rotation
database deletion
```

---

# 47. SECRET CUSTODY

Credentials remain inside KyvonOPS.

Architecture:

```text
AI
 ↓
MCP
 ↓
Policy
 ↓
Operation
 ↓
Credential Resolver
 ↓
OS Keychain / Secret Manager
 ↓
SSH
 ↓
VPS
```

The AI never receives:

```text
password
private key
token
API key
database password
Cloudflare secret
```

---

# 48. SSH

Support:

```text
password authentication
private-key authentication
SSH agent
known_hosts
custom ports
ProxyJump
bastion hosts
IPv4
IPv6
```

Passwords should be stored only in secure OS credential storage.

Private keys should be referenced rather than copied whenever practical.

---

# 49. COMMAND EXECUTION SECURITY

Every operation:

```text
Intent
 ↓
Validate
 ↓
Resolve target
 ↓
Calculate risk
 ↓
Show action
 ↓
Require approval if needed
 ↓
Execute
 ↓
Verify
 ↓
Record audit
```

Never silently perform destructive operations.

---

# 50. SECRET REDACTION

All outputs must pass through a redaction layer.

Patterns:

```text
password
passwd
token
secret
api_key
apikey
authorization
bearer
private_key
BEGIN PRIVATE KEY
BEGIN RSA PRIVATE KEY
cookie
```

Return:

```text
[REDACTED]
```

where appropriate.

---

# 51. MCP RESOURCES

Provide resources:

```text
kyvon://servers
kyvon://server/{id}
kyvon://server/{id}/health
kyvon://server/{id}/topology
kyvon://server/{id}/sites
kyvon://server/{id}/deployments
kyvon://server/{id}/incidents
kyvon://server/{id}/security
```

---

# 52. MCP PROMPTS

Implement:

```text
kyvon-investigate-outage
kyvon-investigate-slow-site
kyvon-review-deployment
kyvon-check-server-health
kyvon-security-audit
kyvon-pre-deployment-check
kyvon-post-deployment-check
kyvon-find-resource-bottleneck
kyvon-review-nginx
kyvon-review-docker
kyvon-review-kubernetes
```

---

# 53. CODEX

Create first-class Codex integration documentation and configuration.

Codex should be able to:

```text
inspect infrastructure
inspect deployment
read logs
diagnose problems
perform authorized operations
verify deployment
```

Never expose secrets.

---

# 54. CLAUDE CODE

Create Claude Code MCP integration.

Claude should be able to:

```text
inspect
diagnose
propose
request approval
execute authorized operation
verify
```

Provide configuration documentation and automated setup.

---

# 55. GEMINI CLI / AGENT

Create an adapter/documentation layer for Gemini CLI/agent-compatible MCP usage.

Do not tightly couple the core KyvonOPS architecture to one AI vendor.

All AI clients should communicate through:

```text
MCP
```

and receive the same policy-controlled capabilities.

---

# 56. CURSOR CLI

Support Cursor MCP configuration.

Allow:

```text
project scope
user scope
server scope
tool permissions
```

Document safe installation.

---

# 57. MULTI-AGENT CONTROL

Create:

```text
Agent Registry
```

Example:

```text
Codex
● Connected

Claude
● Connected

Gemini
● Connected

Cursor
● Connected
```

Show:

```text
Last request
Last operation
Permissions
Current task
```

---

# 58. AGENT COLLISION PREVENTION

Two agents must not blindly modify the same infrastructure.

Implement operation locking.

Example:

```text
production-01
LOCKED

Agent:
Claude Code

Operation:
deployment

Started:
20:42

Other write operations:
blocked
```

Read operations may continue where safe.

---

# 59. DEPLOYMENT LOCK

Prevent:

```text
Codex deploy
+
Claude rollback
+
Cursor restart
```

from happening simultaneously.

Use:

```text
environment lock
application lock
operation lock
```

---

# 60. CHANGE JOURNAL

Track:

```text
human changes
desktop changes
mobile changes
CLI changes
Codex changes
Claude changes
Gemini changes
Cursor changes
```

Unified timeline:

```text
20:41
Claude deployed api v1.8.3

20:42
Health degradation detected

20:43
Mobile approval requested

20:44
Rollback approved

20:45
Rollback completed
```

---

# 61. AUDIT LOG

Record:

```text
timestamp
actor
actor_type
client
server
environment
tool
operation
parameters_safe
risk
approval
result
duration
verification
```

Never record secrets.

---

# 62. EMERGENCY MODE

Mobile feature:

# Emergency Mode

Show only:

```text
Servers
Incidents
Sites
Logs
Approvals
Critical Actions
```

Large status indicators.

Allow:

```text
restart service
restart container
rollback deployment
enable maintenance mode
```

according to permissions.

Require biometric confirmation.

---

# 63. MAINTENANCE MODE

Allow application-level maintenance:

```text
Enable maintenance
```

Then:

```text
Cloudflare/Nginx
 ↓
Maintenance response
```

Only if the target supports the operation.

Show exact impact before execution.

---

# 64. BACKUP SAFETY

Before dangerous operations, evaluate:

```text
backup age
backup availability
restore verification
```

If a destructive operation has no recent verified backup:

```text
BLOCKED

No verified recovery point available.
```

Allow explicit administrator override with strong audit.

---

# 65. "WHY IS SERVER SLOW?"

AI workflow:

```text
CPU
 ↓
RAM
 ↓
Swap
 ↓
Disk I/O
 ↓
Network
 ↓
Processes
 ↓
Containers
 ↓
Databases
 ↓
Sites
 ↓
Logs
 ↓
Deployments
 ↓
Changes
```

Return evidence-based diagnosis.

---

# 66. "WHY IS WEBSITE DOWN?"

Workflow:

```text
DNS
 ↓
Cloudflare
 ↓
TLS
 ↓
Nginx
 ↓
Port
 ↓
Upstream
 ↓
Container
 ↓
Process
 ↓
Database
```

Return:

```text
Failure point
Evidence
Confidence
Blast radius
Recommended action
```

---

# 67. "WHAT CHANGED?"

Compare:

```text
configuration
deployment
processes
containers
packages
network
DNS
Cloudflare
certificates
resources
```

Return meaningful changes only.

---

# 68. FREELANCER CLIENT MODE

Support:

```text
Client A
Client B
Client C
```

Each workspace:

```text
Servers
Sites
Deployments
Incidents
Backups
SSL
Reports
```

Roles:

```text
Owner
Admin
Developer
Operator
Viewer
Auditor
```

---

# 69. CLIENT REPORTS

Generate:

```text
Monthly Infrastructure Report
```

Include:

```text
Uptime
Incidents
Deployments
Average CPU
Average RAM
Disk usage
SSL status
Backup status
Security findings
Recommendations
```

Never expose credentials.

---

# 70. MOBILE CLIENT WORKSPACES

Mobile should support:

```text
workspace switcher
client switcher
server switcher
environment switcher
```

Make accidental cross-client actions difficult.

---

# 71. UI/UX

Visual direction:

```text
Luxury
Technical
Minimal
Dense but readable
Professional
Dark-first
```

Avoid:

```text
gaming UI
excessive neon
fake 3D
huge gradients
unnecessary animation
```

Use subtle motion.

Desktop:

```text
sidebar
command center
dense tables
charts
topology
terminal
```

Mobile:

```text
bottom navigation
cards
swipeable sections
large status
compact charts
quick actions
```

---

# 72. MOBILE NAVIGATION

Use:

```text
Home
Servers
Incidents
Deployments
More
```

More:

```text
Sites
Logs
Security
Agents
Devices
Settings
```

---

# 73. GLOBAL SEARCH

Search across:

```text
servers
domains
containers
pods
processes
deployments
Git commits
incidents
logs
certificates
```

---

# 74. COMMAND PALETTE

Desktop:

```text
Cmd/Ctrl + K
```

Examples:

```text
connect production
show top CPU
diagnose api.example.com
show nginx errors
show docker
show Kubernetes
deploy staging
rollback production
show incidents
check SSL
```

---

# 75. PERFORMANCE

Desktop should remain responsive with:

```text
100+ servers
10,000+ containers
millions of historical metric points
large logs
```

Use:

```text
virtualized tables
pagination
streaming
background tasks
incremental updates
bounded caches
time-series aggregation
```

Mobile should aggressively limit memory use.

---

# 76. LOCAL DATABASE

Use SQLite for:

```text
servers
profiles
devices
agents
permissions
metrics
events
incidents
deployments
audit
snapshots
configuration history
```

Secrets are references only.

---

# 77. ENCRYPTED LOCAL DATABASE

Use encryption where appropriate for sensitive local data.

At minimum:

```text
OS keychain
```

for secrets.

Use authenticated encryption and established libraries.

Never invent cryptographic algorithms.

---

# 78. TELEMETRY MODEL

Collect:

```text
CPU
memory
swap
disk
filesystem
disk I/O
network
load
processes
services
ports
containers
pods
database
HTTP
TLS
DNS
```

Use a common normalized schema.

---

# 79. EVENT MODEL

Events:

```text
server.health_changed
server.capacity_warning
site.down
site.recovered
site.slow
deployment.started
deployment.completed
deployment.failed
container.crashed
container.restarted
pod.crashed
disk.low
memory.pressure
certificate.expiring
security.finding
configuration.changed
```

---

# 80. ALERT ENGINE

Rules:

```text
threshold
anomaly
rate-of-change
duration
dependency failure
forecast
```

Example:

```text
CPU > 90% for 5 minutes
```

not:

```text
CPU > 90% for 1 second
```

unless explicitly configured.

---

# 81. OBSERVABILITY

Provide:

```text
Metrics
Logs
Events
Traces where available
```

Connect:

```text
deployment
→ metrics
→ logs
→ incident
```

---

# 82. SECURITY MODEL

Use:

```text
least privilege
default deny
explicit scopes
short-lived tokens
secure storage
biometrics
MFA
audit
redaction
operation approval
```

---

# 83. SUPPLY CHAIN

Secure the build:

```text
dependency lockfiles
SBOM
dependency scanning
secret scanning
signed releases
checksums
reproducible build goals
```

---

# 84. KYVON AGENT INSTALLATION

Provide safe installation.

Do not use:

```text
curl | bash
```

blindly.

Flow:

```text
Discover OS
 ↓
Check architecture
 ↓
Download artifact
 ↓
Verify checksum/signature
 ↓
Upload
 ↓
Install
 ↓
Configure least privilege
 ↓
Start service
 ↓
Health check
```

---

# 85. AGENT UPDATE

Support:

```text
current version
available version
compatibility
signature verification
rollback
```

Never automatically install an unverified binary.

---

# 86. HEALTH VERIFICATION

After every write:

```text
execute
 ↓
verify
 ↓
compare expected state
```

Example:

```text
restart nginx
 ↓
systemctl is-active nginx
 ↓
nginx health check
 ↓
HTTP health check
```

---

# 87. DEPLOYMENT VERIFICATION

After deployment:

```text
process health
container health
HTTP
TLS
logs
error rate
latency
database
```

Wait for stabilization before declaring success.

---

# 88. AUTOMATIC ROLLBACK

If deployment violates configured health criteria:

```text
Deployment failed
 ↓
Freeze further writes
 ↓
Collect diagnostics
 ↓
Propose rollback
 ↓
Require approval according to policy
 ↓
Rollback
 ↓
Verify
```

---

# 89. CLOUDflare DNS SAFETY

Before changing DNS:

```text
show current record
show proposed record
show TTL
show proxy state
show expected impact
```

Require approval for production changes.

---

# 90. DOMAIN HEALTH

For each domain:

```text
DNS
TLS
HTTP
redirect
headers
latency
Cloudflare
origin
```

Show:

```text
example.com

DNS ✓
TLS ✓
HTTP ✓
Origin ✓
Cloudflare ✓
```

---

# 91. CERTIFICATE MANAGEMENT

Detect:

```text
Let's Encrypt
Cloudflare Origin certificates
custom certificates
```

Show:

```text
expires in 42 days
```

Alert:

```text
30d
14d
7d
3d
1d
```

Make thresholds configurable.

---

# 92. NETWORK DIAGNOSTICS

Implement:

```text
DNS latency
TCP connectivity
TLS handshake
HTTP latency
packet loss where safely measurable
route diagnostics where supported
port availability
```

Do not run intrusive network scans by default.

---

# 93. SECURITY SCANNING

Safe passive checks:

```text
open ports
SSH configuration
root login
password authentication
firewall
TLS
outdated packages
unexpected services
suspicious listeners
```

Avoid aggressive exploitation.

---

# 94. PACKAGE MANAGEMENT

Detect:

```text
apt
dnf
yum
apk
pacman
```

Show:

```text
updates available
security updates
reboot required
```

Never automatically upgrade production unless explicitly authorized.

---

# 95. SERVER REBOOT SAFETY

Before reboot:

```text
active deployments
critical services
maintenance mode
connected users
pending operations
```

Then:

```text
Risk
HIGH
```

Require approval.

---

# 96. TESTING

Implement:

```text
Rust unit tests
TypeScript unit tests
integration tests
Playwright
mobile tests
MCP protocol tests
security tests
permission tests
redaction tests
deployment tests
```

Critical security tests:

```text
AI cannot retrieve private key
AI cannot retrieve password
AI cannot bypass approval
viewer cannot deploy
staging permission cannot modify production
expired QR cannot pair
replayed QR cannot pair
expired operation token cannot execute
```

---

# 97. MOBILE SECURITY TESTS

Test:

```text
root/jailbreak detection where appropriate
secure storage
screenshot policy where appropriate
biometric step-up
QR replay
QR expiration
device revocation
lost device
session expiry
push notification secret leakage
```

Do not claim jailbreak/root detection is perfect.

---

# 98. DEVICE REVOCATION

Desktop:

```text
Devices

iPhone
● Active

Android
● Active

MacBook
● Active
```

Actions:

```text
Revoke
Rename
View sessions
View last seen
```

Revocation should immediately invalidate future access tokens/session credentials.

---

# 99. LOST DEVICE MODE

If phone is lost:

```text
Revoke device
```

This must invalidate:

```text
device session
operation capability
push approval capability
MCP approval capability
```

---

# 100. AGENT APPROVAL SECURITY

Never allow:

```text
AI → notification → automatic approval
```

Approval must be tied to:

```text
device identity
user identity
specific operation
specific target
short expiration
```

---

# 101. MCP INSTALLATION

Provide scripts/documentation for:

```text
Codex
Claude Code
Gemini CLI
Cursor CLI
```

But never automatically modify user configuration without explicit authorization.

Provide:

```text
install
status
doctor
remove
```

commands.

---

# 102. KYVONOPS CLI

Create:

```text
kyvon
```

Commands:

```text
kyvon server list
kyvon server health
kyvon server inspect
kyvon site list
kyvon site inspect
kyvon deploy
kyvon rollback
kyvon incident list
kyvon diagnose
kyvon mcp install
kyvon mcp doctor
kyvon agent install
kyvon agent status
kyvon device list
kyvon device revoke
```

---

# 103. CLI SAFETY

Before destructive operation:

```text
Target
Action
Risk
Expected impact
```

Then:

```text
Confirm? [y/N]
```

Support non-interactive mode only with explicit authorization mechanisms.

---

# 104. AI AGENT CONTEXT PACK

Create an automatically generated infrastructure context:

```text
Server summary
Application summary
Current incidents
Recent deployments
Current resource pressure
Relevant logs
Dependencies
Security findings
Recent changes
```

Only provide the minimum information needed.

Do not dump entire infrastructure into every model request.

---

# 105. CONTEXT FILTERING

For:

```text
Why is api.example.com slow?
```

send:

```text
api site
nginx
upstream
container
process
database
recent deployment
relevant logs
```

Do not send unrelated:

```text
client-B infrastructure
other servers
secrets
unrelated logs
```

---

# 106. AI COST CONTROL

Cache:

```text
inventory
topology
stable configuration
```

Do not repeatedly send identical context.

Use summarized telemetry for AI.

---

# 107. AI CONFIDENCE

Every diagnosis should provide:

```text
confidence:
0-100
```

Example:

```text
Likely cause:
PostgreSQL connection saturation

Confidence:
87%
```

---

# 108. AI MUST NOT FABRICATE

If data is unavailable:

```text
I cannot verify this because PostgreSQL metrics are unavailable.
```

Never invent:

```text
CPU
logs
deployment state
server status
```

---

# 109. MOBILE AI OPERATIONS

Mobile may show:

```text
Ask KyvonOPS
```

Example:

```text
Why is production unhealthy?
```

Return concise evidence.

For actions:

```text
Recommended:
restart API workers

[Review operation]
```

Never execute directly from a conversational response without the normal policy pipeline.

---

# 110. QR APPROVAL

For sensitive desktop-to-mobile approval:

```text
Desktop generates approval request
 ↓
QR/deep link
 ↓
Mobile validates request
 ↓
User authenticates
 ↓
User approves
 ↓
Signed approval returned
 ↓
Desktop verifies signature
 ↓
Operation executes
```

Do not use QR as a bearer secret.

---

# 111. MOBILE DEEP LINK

Support a secure deep-link format.

Do not place credentials inside links.

Example conceptual:

```text
kyvonops://approve/<short-lived-request-id>
```

The actual authorization is resolved securely after the app validates the request.

---

# 112. CLOUD DEPLOYMENT

Provide optional deployment templates for:

```text
Cloudflare
VPS
Docker
Kubernetes
```

Do not require a KyvonOPS-hosted backend.

---

# 113. OPTIONAL KYVONOPS RELAY

Architect a future optional relay:

```text
Desktop
 ↕
Relay
 ↕
Mobile
```

Relay must never require plaintext credentials.

Use:

```text
end-to-end authenticated channels
device keys
short-lived tokens
encrypted payloads
```

The relay should be optional.

---

# 114. LOCAL-FIRST PRIORITY

If desktop and VPS can communicate directly:

```text
Desktop
 ↓
SSH
 ↓
VPS
```

prefer this.

Cloud relay is only for:

```text
mobile access
NAT traversal
notifications
remote approvals
team collaboration
```

---

# 115. NO MANDATORY BACKEND

KyvonOPS should still function:

```text
without Kyvon cloud
without subscription
without central server
```

for local desktop VPS management.

---

# 116. CLOUD BACKEND ONLY WHEN NEEDED

Optional cloud services may provide:

```text
push notifications
device relay
team sharing
central policy
fleet management
remote access
```

Keep these modular.

---

# 117. OBSERVABILITY OF KYVONOPS ITSELF

KyvonOPS must monitor itself.

Track:

```text
MCP latency
SSH latency
agent latency
database performance
memory
CPU
failed operations
authentication failures
```

---

# 118. ERROR HANDLING

Never show:

```text
Unknown error
```

when actionable information exists.

Show:

```text
Connection refused
Target: production-01
Port: 22

Possible causes:
• SSH service stopped
• firewall
• network route
• wrong port

Recommended:
Test connectivity
```

---

# 119. RECOVERY

Every operation should know:

```text
Can rollback?
How?
What verification?
```

Example:

```text
Nginx config change

Backup:
✓

Validation:
nginx -t

Rollback:
restore previous config

Verification:
HTTP health check
```

---

# 120. PLUGIN ARCHITECTURE

Plugins:

```text
nginx
docker
kubernetes
postgres
mysql
redis
node
python
php
django
laravel
nextjs
wordpress
odoo
cloudflare
github
gitlab
```

Each plugin exposes:

```text
detect
discover
metrics
health
logs
diagnostics
operations
```

---

# 121. PLUGIN SECURITY

Plugins cannot automatically:

```text
read all secrets
execute arbitrary commands
modify firewall
modify credentials
```

Plugins receive explicit capabilities.

---

# 122. FINAL UX

The central screen should answer five questions immediately:

```text
1. Is my infrastructure healthy?

2. What is consuming resources?

3. Which applications are affected?

4. What changed?

5. What should I do next?
```

---

# 123. V3.0 MOBILE SCREEN SET

Implement at minimum:

```text
Splash
Onboarding
Sign in
2FA
Device pairing
Home
Servers
Server detail
Applications
Site detail
Containers
Kubernetes
Deployments
Deployment detail
Incidents
Incident detail
Logs
Security
Approvals
Agent registry
Devices
Settings
Notifications
Profile
```

---

# 124. V3.0 DESKTOP SCREEN SET

Implement:

```text
Command Center
Servers
Server Detail
Topology
Applications
Sites
Deployments
Docker
Kubernetes
Processes
Services
Network
Storage
Databases
Logs
Security
Certificates
Diagnostics
Incidents
Changes
Backups
Runbooks
Clients
Reports
Agents
MCP
AI Operations
Devices
Settings
```

---

# 125. IMPLEMENTATION ORDER

Do not attempt everything simultaneously.

Phase 1:

```text
Monorepo
Tauri
React
Rust
SQLite
SSH
Server profiles
```

Phase 2:

```text
Discovery
Telemetry
Processes
Services
Nginx
Docker
```

Phase 3:

```text
Sites
Application mapping
Resource attribution
Topology
Logs
```

Phase 4:

```text
Deployments
Rollback
Health checks
Capacity
Forecasting
```

Phase 5:

```text
Kubernetes
Databases
Cloudflare
Security
```

Phase 6:

```text
Android
iOS
QR pairing
Device identity
Biometrics
2FA
Push
```

Phase 7:

```text
MCP
Policy
Approval
Audit
Credential custody
```

Phase 8:

```text
Codex
Claude
Gemini
Cursor
multi-agent controls
```

Phase 9:

```text
Freelancer workspaces
Reports
Plugins
advanced diagnostics
```

---

# 126. QUALITY GATE

Do not declare V3.0 complete until:

```text
Desktop builds
✓

Android builds
✓

iOS builds
✓

SSH works
✓

Agent works
✓

Nginx discovery works
✓

Docker discovery works
✓

Kubernetes discovery works
✓

Site mapping works
✓

Resource attribution works
✓

Deployment works
✓

Rollback works
✓

Cloudflare integration works
✓

QR pairing works
✓

2FA works
✓

Biometrics work
✓

Device revocation works
✓

MCP works
✓

Codex integration tested
✓

Claude integration tested
✓

Gemini integration tested
✓

Cursor integration tested
✓

Secrets never reach AI
✓

Audit works
✓

Approval system works
✓

No unrestricted AI shell
✓

No fake metrics
✓

No placeholder production controls
✓
```

---

# 127. DEVELOPER OPERATING RULE

When implementing:

1. Inspect existing code first.
2. Preserve working functionality.
3. Do not rewrite stable modules unnecessarily.
4. Identify architecture conflicts before changing them.
5. Build shared types before duplicating models.
6. Add tests with every critical feature.
7. Run formatting and linting.
8. Run unit tests.
9. Run integration tests.
10. Run security tests.
11. Build desktop.
12. Build Android.
13. Build iOS where the environment supports it.
14. Test MCP integration.
15. Test all authorization boundaries.

Never mark a feature complete because the UI renders.

A feature is complete only when:

```text
UI
+
backend/native implementation
+
real data
+
error handling
+
security
+
tests
+
documentation
```

all exist.

---

# 128. FINAL DEFINITION

KyvonOPS V3.0 is not:

```text
SSH client
```

It is:

```text
                    KYVONOPS

       Infrastructure Intelligence Layer
                    │
       ┌────────────┼─────────────┐
       │            │             │
    Desktop       Mobile         CLI
       │            │             │
       └────────────┼─────────────┘
                    │
             Infrastructure
                    │
       ┌────────────┼─────────────┐
       │            │             │
      VPS        Docker        K8s
       │            │             │
     Nginx       Apps          Pods
       │            │             │
       └────────────┼─────────────┘
                    │
              Observability
                    │
             Diagnostics
                    │
              Deployment
                    │
               Security
                    │
                   MCP
                    │
       ┌────────────┼─────────────┐
       │            │             │
     Codex        Claude        Gemini
       │            │             │
       └────────────┼─────────────┘
                    │
                 Cursor
```

The defining security boundary is:

```text
AI
 ↓
MCP
 ↓
Policy
 ↓
Approval
 ↓
KyvonOPS
 ↓
Credential Resolver
 ↓
SSH / Agent
 ↓
Infrastructure
```

The AI gets **capabilities**, not credentials.

The human gets **visibility and control**.

KyvonOPS gets **custody, policy, verification and audit**.

Build V3.0 around that principle.

