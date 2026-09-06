# Deployment Test Plan

This plan verifies a KyvonOPS public deployment through the operator-managed VPN and SSH path documented outside this repository. Do not copy VPN keys, SSH private keys, passwords, tunnel tokens, or server inventories into KyvonOPS.

## 1. Local release gate

Run from the repository root:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features
cd apps/desktop
bun install --frozen-lockfile
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

## 3. Static deployment test

Provide `RELEASE_MANIFEST` only when it contains signed artifacts with HTTPS URLs. Then run `scripts/deploy-host.sh` on the approved host. Without that variable, the script deliberately deploys static assets but leaves the updater endpoint disabled.

Verify:

```sh
curl --fail --silent --show-error https://<verified-domain>/healthz
curl --fail --silent --show-error https://<verified-domain>/ | grep -F 'KyvonOPS'
```

Check browser deep links, security headers, Cloudflare routing, and logs. Record the commit, artifact checksums, host, and UTC timestamp.

## 4. Rollback

Keep the previous static bundle and Nginx configuration until the health check, deep-link check, and clean-install test pass. On failure, restore the previous bundle, reload Nginx, and document the failing gate before retrying.
