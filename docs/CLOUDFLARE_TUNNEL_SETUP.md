# Cloudflare Tunnel Setup

Use this runbook on the approved VPN test host after the static deployment passes. Keep the tunnel token in the server’s protected environment or secret manager; never commit it or paste it into frontend code.

**Current evidence (V4.1 review):** the host currently serves Nginx on
`127.0.0.1:8080`, but `cloudflared` and `/etc/cloudflared/config.yml` were not
present during the latest inspection. The tunnel is therefore not configured
or verified. The deployment script now fails closed by default when this
condition is detected; use `REQUIRE_TUNNEL=0` only for a private VPN preview.

## Install and configure

Install `cloudflared` using Cloudflare’s signed package for the server distribution. Authenticate with the project’s Cloudflare account, then create or select a tunnel:

```sh
cloudflared tunnel login
cloudflared tunnel create kyvonops-web
```

Create `/etc/cloudflared/config.yml` with the tunnel UUID and a protected credentials file:

```yaml
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: kyvonops.sys.thuyakyaw.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Protect both files:

```sh
chown root:root /etc/cloudflared/config.yml /etc/cloudflared/<tunnel-uuid>.json
chmod 600 /etc/cloudflared/config.yml /etc/cloudflared/<tunnel-uuid>.json
```

## Route and verify

```sh
cloudflared tunnel route dns kyvonops-web kyvonops.sys.thuyakyaw.com
cloudflared tunnel ingress validate
cloudflared service install
systemctl enable --now cloudflared
systemctl is-active --quiet cloudflared
curl --fail --silent --show-error https://kyvonops.sys.thuyakyaw.com/healthz
```

The final request must return `healthy`. Verify `/`, `/preview`, and `/getting-started` in a browser. The public site must not expose `/servers`, `/terminal`, or any desktop-only control surface.

## Rollback

If verification fails, stop the service and remove only the DNS route for this hostname:

```sh
systemctl disable --now cloudflared
cloudflared tunnel route dns delete kyvonops-web kyvonops.sys.thuyakyaw.com
```

Keep the local Nginx service intact so the deployment can be retested without rebuilding the bundle.
