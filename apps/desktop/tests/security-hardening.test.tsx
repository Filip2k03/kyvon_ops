import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('V4.1 production security hygiene', () => {
  test('pairing UI does not ship demo TOTP, LAN Vite, or pairing theater', () => {
    const src = read('src/features/security/DevicePairingCenter.tsx');
    expect(src).not.toContain('JBSWY3DPEHPK3PXP');
    expect(src).not.toContain('192.168.100.70');
    expect(src).not.toContain('Generate QR');
    expect(src).toContain('Not available in this build');
  });

  test('Cloudflare UI does not persist tokens or ship a placeholder tunnel JWT', () => {
    const src = read('src/features/cloudflare/CloudflareManager.tsx');
    expect(src).not.toMatch(/localStorage\.setItem\(\s*['"]cf_api_token['"]/);
    expect(src).not.toContain('eyJhIjoiY2xvdWRmbGFyZSIsInQiOiJmcmVlX3BsYW5fdHVubmVsIn0=');
    expect(src).toContain('Token held in this window only');
  });

  test('Gemini UI does not persist API keys to localStorage', () => {
    const src = read('src/features/gemini/GeminiOperations.tsx');
    expect(src).not.toMatch(/localStorage\.setItem\(\s*['"]gemini_api_key['"]/);
    expect(src).toContain('not written to disk');
  });

  test('Pages headers enforce HTTPS-era defaults and omit wildcard CORS', () => {
    const headers = read('public/_headers');
    expect(headers).toContain('Strict-Transport-Security');
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).not.toContain('Access-Control-Allow-Origin: *');
  });

  test('Tauri CSP does not allow unsafe-eval or plaintext WebSocket', () => {
    const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as {
      build: { devUrl: string };
      app: { security: { csp: string } };
    };
    expect(conf.build.devUrl).toContain('localhost');
    const { csp } = conf.app.security;
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toMatch(/\bhttps:/);
    expect(csp).toMatch(/\bwss:/);
    expect(csp).not.toMatch(/(^|[\s;])ws:/);
    expect(csp).toContain('http://ipc.localhost');
    expect(csp.replaceAll('http://ipc.localhost', '')).not.toContain('http:');
  });
});
