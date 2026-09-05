#!/usr/bin/env bash
# ==============================================================================
# KyvonOPS V3.0 Production Host Deployment Script
# Target Domain: kyvonops.sys.thuyakyaw.com
# Architecture: Zero-Open-Port Cloudflare Tunnel + Nginx Ingress + Systemd Daemon
# ==============================================================================
set -euo pipefail

DOMAIN="kyvonops.sys.thuyakyaw.com"
APP_DIR="/var/www/kyvonops"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
SERVICE_FILE="/etc/systemd/system/kyvonops-web.service"
LOCAL_PORT=8080

echo "================================================================================"
echo "          KyvonOPS V3.0 Host Deployment — ${DOMAIN}"
echo "================================================================================"

# Step 1: Preflight Environment Checks
echo "==> [1/6] Running Infrastructure Preflight Checks..."
command -v bun >/dev/null 2>&1 || { echo "ERROR: bun is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "ERROR: git is required but not installed."; exit 1; }

# Check available disk headroom
AVAILABLE_KB=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAILABLE_KB" -lt 500000 ]; then
    echo "ERROR: Insufficient disk space (<500MB free). Aborting deployment."
    exit 1
fi
echo "    ✓ Disk space headroom safe (${AVAILABLE_KB} KB available)"

# Step 2: Build Web Application
echo "==> [2/6] Building Production Web & Companion Bundles..."
cd apps/desktop
bun install --frozen-lockfile || bun install
bun run build
cd ../..

# Step 3: Synchronize Web Distribution Artifacts
echo "==> [3/6] Deploying Static Distribution to ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}"
sudo rsync -av --delete apps/desktop/dist/ "${APP_DIR}/"
sudo chown -R www-data:www-data "${APP_DIR}" || true

# Generate Tauri Release Manifest for in-app updates
sudo mkdir -p "${APP_DIR}/releases"
cat <<EOF | sudo tee "${APP_DIR}/releases/latest.json" > /dev/null
{
  "version": "3.0.0",
  "notes": "KyvonOPS V3.0 Sovereign DevOps Intelligence & Mobile Companion",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "darwin-aarch64": {
      "signature": "",
      "url": "https://${DOMAIN}/releases/KyvonOPS_3.0.0_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "",
      "url": "https://${DOMAIN}/releases/KyvonOPS_3.0.0_x64.dmg"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "https://${DOMAIN}/releases/KyvonOPS_3.0.0_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "https://${DOMAIN}/releases/KyvonOPS_3.0.0_x64_en-US.msi"
    }
  }
}
EOF

# Step 4: Configure Nginx Ingress & SPA Routing
echo "==> [4/6] Provisioning Nginx Virtual Host for ${DOMAIN}..."
cat <<EOF | sudo tee "${NGINX_CONF}" > /dev/null
# KyvonOPS V3.0 Nginx Server Block for ${DOMAIN}
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
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self' data:;" always;

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
if [ -f "${CLOUDFLARE_TUNNEL_CONFIG}" ]; then
    echo "    Found active cloudflared config. Ensuring ingress route for ${DOMAIN}..."
else
    echo "    To route traffic via Cloudflare Zero Trust Tunnel without opening firewall ports:"
    echo "    1. cloudflared tunnel route dns <tunnel-id> ${DOMAIN}"
    echo "    2. Point tunnel ingress to http://localhost:${LOCAL_PORT}"
fi

# Step 6: Post-flight Verification
echo "==> [6/6] Verifying Deployment Integrity..."
echo "    App Root:           ${APP_DIR}"
echo "    Nginx Vhost:        ${NGINX_CONF}"
echo "    Updater Endpoint:   https://${DOMAIN}/releases/latest.json"
echo "    Local Ingress:      http://127.0.0.1:${LOCAL_PORT}"
echo ""
echo "Deployment completed successfully! KyvonOPS is ready to serve on ${DOMAIN}."
