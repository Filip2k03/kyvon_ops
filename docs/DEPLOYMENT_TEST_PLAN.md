# Deployment Test Plan

This plan verifies a KyvonOPS public deployment through the operator-managed VPN and SSH path documented outside this repository. Do not copy VPN keys, SSH private keys, passwords, tunnel tokens, or server inventories into KyvonOPS.

## 1. Local release gate

Run from the repository root:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
./scripts/install.sh --frontend
cd apps/desktop
bun run build
bun test tests/public-website.test.tsx
```

The public bundle must contain only landing, preview, setup, and release links. The installed desktop bundle is the only surface that may open SSH or read the local workspace.

## 2. VPN and remote preflight

Connect to the approved VPN using the operator runbook in `../vpn`. Verify the expected SSH host key out of band, then run the repository smoke test against the designated host:

```sh
SSH_HOST=<test-host> SSH_USER=<operator-user> SSH_KEY=<key-path> ./scripts/live-ssh-smoke.sh
```

Do not use production hosts for the first installation test. Confirm free disk space, available port `8080`, and a working Nginx/systemd toolchain before deployment.

Verify the interactive prerequisite separately before testing the desktop terminal:

```sh
SSH_HOST=<test-host> SSH_USER=<operator-user> SSH_KEY=<key-path> ./scripts/live-pty-smoke.sh
```

## 3. Static deployment test

Build and package the exact artifact before deployment:

```sh
(cd apps/desktop && bun run build)
./scripts/package-web-release.sh
```

Keep the generated `.tar.gz` and `.sha256` together with the source commit. The
checksum is provenance for the bundle copied to the origin; it is not a release
signature.

Provide `RELEASE_MANIFEST` only when it contains signed artifacts with HTTPS URLs. Then run `scripts/deploy-host.sh` from any directory on the approved host; it resolves the repository root from its own path. Without that variable, the script deliberately deploys static assets but leaves the updater endpoint disabled. Use `scripts/deploy-host.sh --help` to review supported environment overrides.

Verify:

```sh
curl --fail --silent --show-error https://<verified-domain>/healthz
curl --fail --silent --show-error https://<verified-domain>/ | grep -F 'KyvonOPS'
```

Check browser deep links, security headers, Cloudflare routing, and logs. Record the commit, artifact checksums, host, and UTC timestamp.

## 4. Rollback

Keep the previous static bundle and Nginx configuration until the health check, deep-link check, and clean-install test pass. On failure, restore the previous bundle, reload Nginx, and document the failing gate before retrying.
