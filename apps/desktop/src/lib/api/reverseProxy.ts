import { ReverseProxyRoute } from './types';

export class ReverseProxyGenerator {
  /**
   * Generates a modern, hardened Caddyfile block
   */
  static generateCaddyfile(route: ReverseProxyRoute): string {
    const lines: string[] = [];
    lines.push(`${route.domain} {`);

    // Compression
    if (route.enableGzip) {
      lines.push('    encode zstd gzip');
    }

    // Security Headers (Pacific Standard hardened profile)
    lines.push('    header {');
    lines.push('        # Security Hardening');
    lines.push('        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"');
    lines.push('        X-Content-Type-Options "nosniff"');
    lines.push('        X-Frame-Options "DENY"');
    lines.push('        Referrer-Policy "strict-origin-when-cross-origin"');
    lines.push('        Permissions-Policy "camera=(), microphone=(), geolocation=()"');
    lines.push('        -Server');
    if (route.customHeaders) {
      for (const [key, value] of Object.entries(route.customHeaders)) {
        lines.push(`        ${key} "${value}"`);
      }
    }
    lines.push('    }');

    // Reverse Proxy Directive
    lines.push(`    reverse_proxy ${route.upstreamUrl} {`);
    lines.push('        header_up Host {upstream_hostport}');
    lines.push('        header_up X-Real-IP {remote_host}');
    lines.push('        header_up X-Forwarded-For {remote_host}');
    lines.push('        header_up X-Forwarded-Proto {scheme}');
    lines.push('        header_up CF-Connecting-IP {http.reverse_proxy.header.CF-Connecting-IP}');

    if (route.enableWebsockets) {
      lines.push('        # WebSocket Support');
      lines.push('        header_up Upgrade {>Upgrade}');
      lines.push('        header_up Connection {>Connection}');
    }

    lines.push('        transport http {');
    lines.push('            keepalive 30s');
    lines.push('            dial_timeout 5s');
    lines.push('            response_header_timeout 60s');
    lines.push('        }');
    lines.push('    }');

    // Custom TLS / Cloudflare Origin CA
    if (route.sslMode === 'cloudflare_origin' && route.certPath && route.keyPath) {
      lines.push(`    tls ${route.certPath} ${route.keyPath}`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generates a hardened Nginx virtual server block
   */
  static generateNginxConfig(route: ReverseProxyRoute): string {
    const upstreamName = route.domain.replace(/[^a-zA-Z0-9]/g, '_') + '_upstream';
    const lines: string[] = [];

    lines.push(`# ====================================================================`);
    lines.push(`# KyvonOPS Managed Ingress: ${route.domain}`);
    lines.push(`# ====================================================================`);
    lines.push(`upstream ${upstreamName} {`);
    lines.push(`    server ${route.upstreamUrl};`);
    lines.push(`    keepalive 32;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`server {`);
    lines.push(`    listen 80;`);
    lines.push(`    listen [::]:80;`);
    lines.push(`    server_name ${route.domain};`);
    lines.push(`    # Force HTTPS redirect`);
    lines.push(`    return 301 https://$host$request_uri;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`server {`);
    lines.push(`    listen 443 ssl http2;`);
    lines.push(`    listen [::]:443 ssl http2;`);
    lines.push(`    server_name ${route.domain};`);
    lines.push(``);

    if (route.sslMode === 'cloudflare_origin' && route.certPath && route.keyPath) {
      lines.push(`    # Cloudflare Origin CA Certificate`);
      lines.push(`    ssl_certificate ${route.certPath};`);
      lines.push(`    ssl_certificate_key ${route.keyPath};`);
    } else {
      lines.push(`    # Managed SSL Certificate (Let's Encrypt / Certbot)`);
      lines.push(`    ssl_certificate /etc/letsencrypt/live/${route.domain}/fullchain.pem;`);
      lines.push(`    ssl_certificate_key /etc/letsencrypt/live/${route.domain}/privkey.pem;`);
    }

    lines.push(`    ssl_protocols TLSv1.2 TLSv1.3;`);
    lines.push(`    ssl_ciphers HIGH:!aNULL:!MD5;`);
    lines.push(`    ssl_prefer_server_ciphers on;`);
    lines.push(`    ssl_session_cache shared:SSL:10m;`);
    lines.push(`    ssl_session_timeout 1d;`);
    lines.push(``);
    lines.push(`    # Hardened Security Headers`);
    lines.push(`    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`);
    lines.push(`    add_header X-Frame-Options "DENY" always;`);
    lines.push(`    add_header X-Content-Type-Options "nosniff" always;`);
    lines.push(`    add_header Referrer-Policy "strict-origin-when-cross-origin" always;`);
    lines.push(``);

    if (route.enableGzip) {
      lines.push(`    gzip on;`);
      lines.push(`    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;`);
      lines.push(`    gzip_min_length 1024;`);
    }

    lines.push(`    location / {`);
    lines.push(`        proxy_pass http://${upstreamName};`);
    lines.push(`        proxy_http_version 1.1;`);

    if (route.enableWebsockets) {
      lines.push(`        proxy_set_header Upgrade $http_upgrade;`);
      lines.push(`        proxy_set_header Connection "upgrade";`);
    } else {
      lines.push(`        proxy_set_header Connection "";`);
    }

    lines.push(`        proxy_set_header Host $host;`);
    lines.push(`        proxy_set_header X-Real-IP $remote_addr;`);
    lines.push(`        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
    lines.push(`        proxy_set_header X-Forwarded-Proto $scheme;`);
    lines.push(`        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;`);
    lines.push(`        proxy_read_timeout 90s;`);
    lines.push(`        proxy_connect_timeout 5s;`);
    lines.push(`    }`);
    lines.push(`}`);

    return lines.join('\n');
  }
}
