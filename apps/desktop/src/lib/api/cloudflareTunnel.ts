// Cloudflare Tunnel & Free Plan Deployment Engine
// Enables zero-open-port ingress via Cloudflare Free Tier

export interface CloudflareTunnelConfig {
  tunnelId: string;
  tunnelName: string;
  accountTag: string;
  domain: string;
  localService: string; // e.g. "http://127.0.0.1:3000" or "http://localhost:80"
}

export class CloudflareTunnelGenerator {
  /**
   * Generates the cloudflared config.yml file
   */
  static generateConfigYaml(config: CloudflareTunnelConfig): string {
    return `# ====================================================================
# KyvonOPS V3.0 Cloudflare Free Plan Tunnel Configuration
# Tunnel: ${config.tunnelName} (${config.tunnelId})
# Zero open inbound ports required on the host
# ====================================================================

tunnel: ${config.tunnelId}
credentials-file: /etc/cloudflared/${config.tunnelId}.json

ingress:
  # Ingress route for public domain
  - hostname: ${config.domain}
    service: ${config.localService}
    originRequest:
      connectTimeout: 10s
      noTLSVerify: true
      keepAliveTimeout: 90s
      http2Origin: true

  # Fallback 404 rule for unmatched traffic
  - service: http_status:404
`;
  }

  /**
   * Generates the Linux systemd service unit for cloudflared
   */
  static generateSystemdService(): string {
    return `[Unit]
Description=Cloudflare Tunnel Agent (KyvonOPS Managed)
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=0
Type=notify
ExecStart=/usr/local/bin/cloudflared --config /etc/cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=5s
KillMode=mixed

# Hardening
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/etc/cloudflared
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
`;
  }

  /**
   * Generates a zero-downtime bash deployment script to execute on the VPS over SSH
   */
  static generateDeploymentScript(config: CloudflareTunnelConfig, tunnelToken: string): string {
    return `#!/usr/bin/env bash
# KyvonOPS V3.0: Cloudflare Free Tier Tunnel Ingress Auto-Installer
set -euo pipefail

echo "==> [1/4] Installing cloudflared binary..."
if ! command -v cloudflared &> /dev/null; then
  ARCH=$(uname -m)
  case $ARCH in
    x86_64)  PKG="cloudflared-linux-amd64.deb" ;;
    aarch64) PKG="cloudflared-linux-arm64.deb" ;;
    *) echo "Unsupported architecture: $ARCH" && exit 1 ;;
  esac
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
  rm -f /tmp/cloudflared.deb
fi

echo "==> [2/4] Registering service with Cloudflare Edge..."
mkdir -p /etc/cloudflared
cloudflared service install "${tunnelToken}"

echo "==> [3/4] Enabling and starting cloudflared systemd unit..."
systemctl daemon-reload
systemctl enable --now cloudflared

echo "==> [4/4] Cloudflare Tunnel successfully activated!"
echo "    Domain: https://${config.domain} -> ${config.localService}"
systemctl status cloudflared --no-pager
`;
  }
}
