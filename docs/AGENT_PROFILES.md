# Project-local agent profiles

Source of truth: `docs/agents/<id>/agent.md`.

Install into the Antigravity workspace with:

```sh
chmod +x scripts/kyvon-control.sh
./scripts/kyvon-control.sh install-agents
```

That copies profiles into `.agents/agents/` (override with `-t DIR`). The control
script uses `cp`, not heredocs. Cursor is not a supported client.

## Profiles

| Id | Role |
| --- | --- |
| `agy-claude-codex-bridge` | Orchestrator: exclusive file ownership, evidence gates, no credential egress |
| `codex-astra` | Rust / Tauri / React implementation; type parity; no fake metrics |
| `claude-opus` | Security: keychain, typed MCP, approval, audit, redaction |
| `agy-gemini-3-8` | QA: live SSH/PTY smoke, honest empty states, launch-gate evidence |

All profiles read `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md`. Writes go through
the same policy boundary as the UI. Models receive capabilities, never SSH keys.
