# Project-local agent profiles

The intended Antigravity workspace is `.agents/agents/`. The current execution
environment permits reading that directory but denies writes, so the profiles
below are the source text to install there when the workspace permission allows
it. Do not install them in the global Gemini configuration for this repository.

## Supported profiles

- `agy-claude-codex-bridge`: coordinates the three supported clients, assigns
  exclusive file ownership, and requires evidence-based handoffs.
- `codex-astra`: implementation and release-readiness checks with focused tests.
- `claude-opus`: security, architecture, MCP, SSH, and documentation review.
- `agy-gemini-3-8`: QA, integration, deployment smoke tests, and failure review.

All profiles must read `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md`; preserve
unrelated worktree changes; use the MCP policy boundary; keep credentials out of
agent context and logs; and report commands, evidence, and blockers. Cursor is
not a supported client for this project.
