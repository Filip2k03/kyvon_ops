import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { PublicWebsite } from '../src/features/landing/PublicWebsite';

function render(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><PublicWebsite /></MemoryRouter>);
}

describe('public website boundary', () => {
  test('browser entry renders public navigation instead of the operational shell', () => {
    const html = renderToStaticMarkup(<MemoryRouter><App /></MemoryRouter>);
    expect(html).toContain('Public navigation');
    expect(html).toContain('Development preview');
    expect(html).not.toContain('CommandPalette');
    expect(html).not.toContain('href="/servers"');
    expect(html).not.toContain('href="/terminal"');
    expect(html).not.toContain('<canvas');
  });

  test('downloads lead to published releases without simulated artifacts or payment sessions', () => {
    const html = render('/downloads');
    // The canonical releases list is reachable in every state, including
    // before the live lookup resolves and when it fails.
    expect(html).toContain('https://github.com/Filip2k03/kyvon_ops/releases');
    expect(html).toContain('Availability is not verified');
    expect(html).not.toContain('cs_test');
    expect(html).not.toContain('Downloading');
    expect(html).not.toContain('<input');
  });

  test('no download is offered until a real release supplies one', () => {
    // Download links, filenames, sizes and signature claims come only from the
    // GitHub releases API at view time. Statically rendered markup must carry
    // none of them, or the page would be promising installers that may not
    // exist — the same fabrication the app forbids for metrics.
    const html = render('/downloads');
    for (const artifact of ['.dmg', '.msi', '.AppImage', '.deb', '.apk', '.exe']) {
      expect(html).not.toContain(artifact);
    }
    expect(html).not.toContain('browser_download_url');
    expect(html).not.toContain('A signature is published');
    expect(html).toContain('Checking published releases');
  });

  test.each(['/servers', '/terminal', '/pairing', '/cloudflare', '/gemini', '/promotions'])('does not render operational controls at %s', path => {
    const html = render(path);
    expect(html).toContain('Public navigation');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Add Server');
    expect(html).not.toContain('Generate QR');
  });

  test('onboarding describes a separate workspace and user-owned SSH identity', () => {
    const html = render('/getting-started');
    expect(html).toContain('separate local workspace');
    expect(html).toContain('your own server address and SSH identity');
    expect(html).not.toContain('127.0.0.1');
  });

  test('app preview is explicitly illustrative and never collects infrastructure credentials', () => {
    const html = render('/preview');
    expect(html).toContain('Illustrative interface preview');
    expect(html).toContain('no server connection or live metrics');
    expect(html).toContain('Server inventory');
    expect(html).toContain('AI approvals');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<iframe');
  });
});
