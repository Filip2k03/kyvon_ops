#!/usr/bin/env bash
# ==============================================================================
# KyvonOPS V4.1 Static Host Deployment Script
# Target Domain: kyvonops.sys.thuyakyaw.com
# Architecture: Zero-Open-Port Cloudflare Tunnel + Nginx Ingress + Systemd Daemon
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOMAIN="kyvonops.sys.thuyakyaw.com"
APP_DIR="/var/www/kyvonops"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
SERVICE_FILE="/etc/systemd/system/kyvonops-web.service"
LOCAL_PORT=8080
BUILD_ON_HOST="${BUILD_ON_HOST:-0}"
REQUIRE_TUNNEL="${REQUIRE_TUNNEL:-1}"

case "${1:-}" in
  -h|--help)
    cat <<'USAGE'
Usage: scripts/deploy-host.sh

Deploy the already-built desktop web bundle to the configured Linux host.
Defaults to BUILD_ON_HOST=0 so the host never installs dependencies. Set
BUILD_ON_HOST=1 only when Bun and the lockfile are available on the host.

Environment: BUILD_ON_HOST, RELEASE_MANIFEST, DOMAIN, APP_DIR, LOCAL_PORT,
REQUIRE_TUNNEL. REQUIRE_TUNNEL=1 (the default) fails closed when cloudflared
is not installed and configured for the target hostname. Set it to 0 only for
an explicitly private/VPN preview that is not presented as public production.
The script requires sudo, rsync, and nginx on the target host.
USAGE
    exit 0
    ;;
  *)
    if [ "$#" -gt 0 ]; then
      echo "ERROR: unknown argument: $1 (use --help)" >&2
      exit 2
    fi
    ;;
esac

DOMAIN="${DOMAIN:-kyvonops.sys.thuyakyaw.com}"
APP_DIR="${APP_DIR:-/var/www/kyvonops}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
SERVICE_FILE="/etc/systemd/system/kyvonops-web.service"
LOCAL_PORT="${LOCAL_PORT:-8080}"

echo "================================================================================"
echo "          KyvonOPS V4.1 Host Deployment — ${DOMAIN}"
echo "================================================================================"

# Step 1: Preflight Environment Checks
echo "==> [1/6] Running Infrastructure Preflight Checks..."
if [ "${BUILD_ON_HOST}" = "1" ]; then
    command -v bun >/dev/null 2>&1 || { echo "ERROR: bun is required when BUILD_ON_HOST=1."; exit 1; }
    command -v git >/dev/null 2>&1 || { echo "ERROR: git is required when BUILD_ON_HOST=1."; exit 1; }
fi

# Check available disk headroom
AVAILABLE_KB=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_KB" -lt 500000 ]; then
    echo "ERROR: Insufficient disk space (<500MB free). Aborting deployment."
    exit 1
fi
echo "    ✓ Disk space headroom safe (${AVAILABLE_KB} KB available)"

# Step 2: Build Web Application
echo "==> [2/6] Building Production Web & Companion Bundles..."
if [ "${BUILD_ON_HOST}" = "1" ]; then
    cd "${ROOT_DIR}/apps/desktop"
    bun install --frozen-lockfile
    bun run build
    cd ../..
else
    test -f "${ROOT_DIR}/apps/desktop/dist/index.html" || {
        echo "ERROR: apps/desktop/dist/index.html is missing. Build locally or set BUILD_ON_HOST=1."
        exit 1
    }
    echo "    Using prebuilt local distribution; no build toolchain required on the host."
fi

# Step 3: Synchronize Web Distribution Artifacts
echo "==> [3/6] Deploying Static Distribution to ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}"
sudo find "${APP_DIR}" -type f \( -name '._*' -o -name '.DS_Store' \) -delete
sudo rsync -av --delete --exclude='._*' --exclude='.DS_Store' "${ROOT_DIR}/apps/desktop/dist/" "${APP_DIR}/"
sudo chown -R www-data:www-data "${APP_DIR}" || true

# Never invent updater metadata. A production deployment may publish an
# already-signed manifest only when RELEASE_MANIFEST points to a verified file.
if [ -n "${RELEASE_MANIFEST:-}" ]; then
    test -s "${RELEASE_MANIFEST}" || { echo "ERROR: RELEASE_MANIFEST is empty or missing."; exit 1; }
    command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required to validate RELEASE_MANIFEST."; exit 1; }
    jq -e '
      (.version | type == "string") and
      (.platforms | type == "object" and length > 0) and
      (all(.platforms[]; (.url | startswith("https://")) and (.signature | type == "string" and length > 0)))
    ' "${RELEASE_MANIFEST}" >/dev/null || {
        echo "ERROR: RELEASE_MANIFEST must contain HTTPS URLs and non-empty signatures for every platform."
        exit 1
    }
    sudo install -d -m 0755 "${APP_DIR}/releases"
    sudo install -m 0644 "${RELEASE_MANIFEST}" "${APP_DIR}/releases/latest.json"
else
    echo "    No signed release manifest supplied; leaving /releases unavailable."
fi

# Step 4: Configure Nginx Ingress & SPA Routing
echo "==> [4/6] Provisioning Nginx Virtual Host for ${DOMAIN}..."
cat <<EOF | sudo tee "${NGINX_CONF}" > /dev/null
# KyvonOPS V4.1 Nginx Server Block for ${DOMAIN}
server {
    listen ${LOCAL_PORT};
    listen [::]:${LOCAL_PORT};
    server_name ${DOMAIN} localhost;

    root ${APP_DIR};
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml font/woff2 image/svg+xml;

    # SPA Client-Side Routing: fallback to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache immutable static assets
    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Releases endpoint (no caching for update detection)
    location /releases/ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }

    # Healthcheck endpoint
    location /healthz {
        access_log off;
        default_type text/plain;
        return 200 "healthy\n";
    }
}
EOF

# Enable Nginx site if directory exists
if [ -d "/etc/nginx/sites-enabled" ]; then
    sudo ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${DOMAIN}"
    sudo nginx -t && sudo systemctl reload nginx || echo "Note: Run 'sudo systemctl reload nginx' when ready."
fi

# Step 5: Configure Zero-Open-Port Cloudflare Tunnel
echo "==> [5/6] Verifying Cloudflare Tunnel Configuration..."
CLOUDFLARE_TUNNEL_CONFIG="/etc/cloudflared/config.yml"
if [ "${REQUIRE_TUNNEL}" = "1" ]; then
    command -v cloudflared >/dev/null 2>&1 || {
        echo "ERROR: cloudflared is required for public deployment but is not installed." >&2
        echo "       Use REQUIRE_TUNNEL=0 only for a private/VPN preview." >&2
        exit 1
    }
    test -s "${CLOUDFLARE_TUNNEL_CONFIG}" || {
        echo "ERROR: ${CLOUDFLARE_TUNNEL_CONFIG} is missing; public tunnel routing is not configured." >&2
        exit 1
    }
    grep -Eq "hostname:[[:space:]]*${DOMAIN}([[:space:]]|$)" "${CLOUDFLARE_TUNNEL_CONFIG}" || {
        echo "ERROR: tunnel config has no ingress hostname for ${DOMAIN}." >&2
        exit 1
    }
    grep -Eq "service:[[:space:]]*https?://(127\\.0\\.0\\.1|localhost):${LOCAL_PORT}([[:space:]]|$)" "${CLOUDFLARE_TUNNEL_CONFIG}" || {
        echo "ERROR: tunnel config does not route ${DOMAIN} to localhost:${LOCAL_PORT}." >&2
        exit 1
    }
    echo "    Found cloudflared and verified ${DOMAIN} -> localhost:${LOCAL_PORT}."
elif [ -f "${CLOUDFLARE_TUNNEL_CONFIG}" ]; then
    echo "    Private preview mode: tunnel config present but not enforced."
else
    echo "    Private preview mode: no cloudflared config; public routing is unavailable."
fi

# Step 6: Post-flight Verification
echo "==> [6/6] Verifying Deployment Integrity..."
echo "    App Root:           ${APP_DIR}"
echo "    Nginx Vhost:        ${NGINX_CONF}"
if [ -n "${RELEASE_MANIFEST:-}" ]; then
    echo "    Updater Endpoint:   https://${DOMAIN}/releases/latest.json"
else
    echo "    Updater Endpoint:   disabled (no signed release manifest supplied)"
fi
echo "    Local Ingress:      http://127.0.0.1:${LOCAL_PORT}"
echo ""
if [ "${REQUIRE_TUNNEL}" = "1" ]; then
    echo "Deployment completed with verified public tunnel routing for ${DOMAIN}."
else
    echo "Private preview deployment completed; public tunnel routing remains disabled."
fi
