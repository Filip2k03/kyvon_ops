# README evidence capture plan

Screenshots must come from a real desktop build with a disposable local
workspace or an explicitly owned test VPS. Never use production credentials,
private keys, real public IPs, tokens, or fabricated metrics.

| File | State to capture | Required redaction |
| --- | --- | --- |
| `assets/readme/hero.png` | Command Center with one connected test VPS and measured telemetry | Host/IP, usernames, domains |
| `assets/readme/onboarding.png` | Add Server form before submission | All entered values |
| `assets/readme/system-info.png` | VPS system-information screen after SSH connection | Host identity and paths |
| `assets/readme/terminal.png` | Real connected PTY with harmless read-only command | Hostname, account, command output secrets |
| `assets/readme/ai-policy.png` | A proposal shown before approval | Server names and request IDs |
| `assets/readme/audit.png` | Audit entries from a disposable test action | Actor/device identifiers |
| `assets/readme/downloads.png` | Downloads screen showing RC/stable state accurately | None; keep release state visible |

Capture at 1440×900 and a 425px viewport. Keep screenshots static and readable;
do not create a fake dashboard just for marketing. A 45–60 second demo should
show launch → connect → measured health → proposal → approval gate → audit.
