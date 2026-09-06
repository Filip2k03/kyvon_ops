# Contributor issue backlog

These are prepared issue bodies. They are not opened automatically.

## Good first issues

1. **Improve Linux installation documentation** (`documentation`, `good-first-issue`)
   - Document AppImage permissions, DEB installation, checksum verification, and the current stable-release limitation.
2. **Add keyboard-shortcut documentation** (`documentation`, `ui`)
   - Document Command Palette access and focus behavior from implemented routes.
3. **Add an architecture diagram to the README** (`documentation`)
   - Use only components verified in `docs/V4.1_ARCHITECTURE.md`.
4. **Improve CLI examples** (`documentation`, `cli`)
   - Run each example against `--help` and keep unsupported commands out.
5. **Add empty-state copy review** (`ui`, `good-first-issue`)
   - Check disconnected, unavailable, loading, and failed states for actionable recovery.

## Ready for contributors

6. Add measured SSH connection diagnostics (`ssh`, `ui`).
7. Add systemd service inspection coverage (`ssh`, `telemetry`).
8. Add Docker discovery from the existing typed telemetry path (`telemetry`).
9. Add audit filtering and bounded pagination (`security`, `ui`).
10. Add a policy simulation view that never executes an operation (`security`, `mcp`).
11. Add a measured server-latency view (`telemetry`, `ui`).
12. Document MCP capability schemas and approval boundaries (`mcp`, `documentation`).
13. Add installation smoke tests for the Linux AppImage path (`release`, `qa`).
14. Add signed updater metadata after release keys are provisioned (`release`, `security`).
15. Add a contributor development-container guide (`documentation`, `good-first-issue`).

Each issue must include exact acceptance criteria and a validation command before
it is opened publicly.
