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
malformed checksum. `scripts/install.sh` is currently a source-workspace helper,
not a replacement for a signed desktop installer.

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
desktop build, SQLite storage, policy tests, and SSH smoke scripts. Published
signed installers, checksum enforcement in a native installer, the first-run
wizard, and the public hostname remain release-gate work and must not be shown as
available until verified.
