# V4.1 Installation Flow

The public installation path is intentionally short:

```text
kyvonops.sys.thuyakyaw.com
        ↓
     Download
        ↓
 macOS · Windows · Linux
        ↓
  signed artifact + checksum
        ↓
      install
        ↓
      launch
        ↓
  first-run wizard
        ↓
    connect VPS
        ↓
 verify SSH fingerprint
        ↓
    local dashboard
```

The website must show only platform artifacts that exist in a published GitHub
release. Each release should include a versioned installer, a detached signature
where supported, and a checksum manifest. The installer must verify the selected
artifact before writing it; it must fail closed on a missing, mismatched, or
malformed checksum. `scripts/install.sh --check` / `--frontend` is a
source-workspace helper. `scripts/install.sh --desktop` downloads a GitHub
Release AppImage only after SHA-256 verification and fails closed when those
assets are missing. It never pipes remote content into a shell.

## Shared security boundary

Every client converges on the same local policy and authorization model:

```text
desktop · web preview · mobile · MCP · voice · AI
                       ↓
          identity + target + capability
                       ↓
          policy + approval + audit record
                       ↓
              typed connector operation
                       ↓
                verified result / failure
```

Browser pages remain informational. Native commands, CLI operations, MCP tools,
voice intents, and AI proposals must use typed schemas, target scoping,
capability checks, confirmation for writes, timeouts, redaction, and audit
events. No client receives raw SSH credentials, and no voice or model output may
become an unrestricted shell command.

## Current verification

The repository currently verifies the public website, source setup helper,
`--desktop` fail-closed behaviour when no AppImage+checksum pair exists,
desktop frontend build, SQLite storage, policy tests, and SSH smoke scripts.
Published signed installers and a packaged desktop SshSession proof remain
release-gate work.
