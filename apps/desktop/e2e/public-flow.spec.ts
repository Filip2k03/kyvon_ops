import { expect, test } from '@playwright/test';

/**
 * The journey a public developer actually takes: understand the product, find
 * the download, learn what state the release is in, and reach the source.
 *
 * The assertions deliberately check *truthfulness* as well as presence. This
 * project's recurring defect has been UI that reports what it has not
 * verified, and a download page is the worst place for it: an installer
 * button that leads nowhere costs a stranger their trust on first contact.
 */

test.describe('public website', () => {
  test('a visitor lands on the product, not the operator console', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: /public navigation/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The console is for the installed app. A browser has no SSH transport,
    // so shipping its controls here would promise something impossible.
    await expect(page.getByRole('button', { name: /add server/i })).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
  });

  test('every primary navigation link resolves', async ({ page }) => {
    await page.goto('/');
    for (const name of [/app preview/i, /getting started/i, /downloads/i]) {
      const link = page.getByRole('link', { name }).first();
      await expect(link).toBeVisible();
      await link.click();
      // A route that fell through to the catch-all would land back on "/".
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.goto('/');
    }
  });

  test('downloads state what is actually available and never invent an installer', async ({ page }) => {
    await page.goto('/downloads');

    // The canonical releases list is reachable regardless of what the API says.
    const releases = page.getByRole('link', { name: /browse all releases/i });
    await expect(releases).toHaveAttribute(
      'href',
      'https://github.com/Filip2k03/kyvon_ops/releases',
    );

    // Resolve to one of the four legitimate states, then assert the page is
    // honest about that state.
    const noRelease = page.getByRole('heading', { name: /no release published yet/i });
    const failed = page.getByRole('heading', { name: /could not check for releases/i });
    const downloadButton = page.getByRole('link', { name: /^download$/i }).first();

    await expect
      .poll(
        async () =>
          (await noRelease.count()) + (await failed.count()) + (await downloadButton.count()),
        { message: 'downloads must resolve to a definite state', timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    if (await noRelease.count()) {
      // Nothing to install, so it must say so and offer the real alternative.
      await expect(page.getByText(/build it yourself/i)).toBeVisible();
      await expect(page.getByText(/bun run tauri build/i)).toBeVisible();
      await expect(downloadButton).toHaveCount(0);
    }
  });

  test('no raw API error is ever shown to a visitor', async ({ page }) => {
    // V4.1 §8: a 404 from GitHub means "no release", not "the app is broken".
    await page.route('**/api.github.com/**', (route) =>
      route.fulfill({ status: 404, body: '{"message":"Not Found"}' }),
    );
    await page.goto('/downloads');

    await expect(page.getByRole('heading', { name: /no release published yet/i })).toBeVisible();
    for (const leak of ['404', 'Not Found', 'undefined', 'NaN', 'TypeError']) {
      await expect(page.locator('body')).not.toContainText(leak);
    }
  });

  test('a rate limit is distinguished from an absent release', async ({ page }) => {
    await page.route('**/api.github.com/**', (route) =>
      route.fulfill({ status: 403, body: '{"message":"rate limit exceeded"}' }),
    );
    await page.goto('/downloads');

    // Different cause, different message — collapsing both into one would tell
    // a visitor the project has no releases when it may well have.
    await expect(page.getByRole('heading', { name: /could not check for releases/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open releases on github/i })).toBeVisible();
  });

  test('a real release renders its variants with verification status', async ({ page }) => {
    await page.route('**/api.github.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag_name: 'v4.1.0',
          name: 'KyvonOPS 4.1.0',
          html_url: 'https://github.com/Filip2k03/kyvon_ops/releases/tag/v4.1.0',
          published_at: '2026-09-06T00:00:00Z',
          prerelease: false,
          body: null,
          assets: [
            {
              name: 'KyvonOPS_4.1.0_universal.dmg',
              browser_download_url: 'https://example.invalid/KyvonOPS_4.1.0_universal.dmg',
              size: 12_582_912,
              download_count: 3,
            },
            {
              name: 'KyvonOPS_4.1.0_universal.dmg.sig',
              browser_download_url: 'https://example.invalid/sig',
              size: 96,
              download_count: 0,
            },
            {
              name: 'kyvon-ops_4.1.0_amd64.deb',
              browser_download_url: 'https://example.invalid/kyvon-ops_4.1.0_amd64.deb',
              size: 9_437_184,
              download_count: 1,
            },
          ],
        }),
      }),
    );
    await page.goto('/downloads');

    await expect(page.getByText('v4.1.0')).toBeVisible();

    // The signature file is evidence, not a download: two assets plus a .sig
    // must yield two variants.
    await expect(page.getByRole('link', { name: /^download$/i })).toHaveCount(1);

    // macOS is selected first here, and its build is signed.
    await expect(page.getByText(/a signature is published/i)).toBeVisible();

    await page.getByRole('tab', { name: /linux/i }).click();
    // The .deb has no signature, and the page must say so rather than imply
    // that every download can be verified.
    await expect(page.getByText(/no signature published/i)).toBeVisible();
  });
});
