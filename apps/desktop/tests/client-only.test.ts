import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('V4.1 client-only public surface', () => {
  test('navigation does not expose demo workspaces or simulated mobile builds', () => {
    const sidebar = read('src/components/layout/Sidebar.tsx');
    const routes = read('src/DesktopApp.tsx');
    expect(sidebar).not.toContain('Client Workspaces');
    expect(sidebar).not.toContain('Mobile (.apk / .ipa)');
    expect(routes).not.toContain('ClientWorkspaceManager');
    expect(routes).not.toContain("path=\"/mobile\"");
  });

  test('digital twin is sourced from the local inventory instead of fixture servers', () => {
    const twin = read('src/features/twin/DigitalTwinExplorer.tsx');
    expect(twin).toContain('Backend.listServers');
    expect(twin).toContain('Connect a VPS to build its digital twin');
    expect(twin).not.toContain('prod-fra-01');
    expect(twin).not.toContain('staging-lon-02');
  });
});
