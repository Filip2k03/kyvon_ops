import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the public website.
 *
 * These run against the built bundle served locally, not against production:
 * a test that depends on the live site fails when Cloudflare is slow and
 * passes when a regression is merely not deployed yet, so it measures the
 * wrong thing. `bun run build` first — the config serves `dist/`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // 390px is the width V4.1 §24 calls out; the public site has to stay
    // usable there, not merely avoid crashing.
    //
    // This runs Chromium at a phone viewport rather than WebKit, so it covers
    // layout and interaction but *not* Safari-specific rendering — which does
    // eventually matter, because the iOS companion wraps this same bundle.
    // Adding WebKit is `bunx playwright install webkit`; it is left out here
    // only to keep the default checkout small.
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'bunx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
