# Public website and installed application

The public website is a product and release-information site. It does not provide a hosted control plane, account login, terminal, pairing endpoint, or access to the project owner's servers.

## Runtime boundary

`apps/desktop/src/App.tsx` selects the public website in a browser. Inside Tauri it lazily loads `DesktopApp.tsx`, which owns infrastructure routes and the application shell. This is a presentation boundary; authorization must also be enforced by native commands and MCP policy.

Public routes are `/`, `/downloads`, and `/getting-started`. `/landing` and unknown paths, including operational deep links, redirect to `/`. The public entry does not import operational screens eagerly. Hosting must serve `index.html` for browser routes; the existing Pages `_redirects` file provides that fallback.

## Installation for other users

Each supported installed release must create its own local persistent database, use the current user's OS credential store, and start with an empty inventory. Onboarding must collect the user's server address and SSH authentication method and require host-key verification. Never ship the maintainer's database, tokens, server profiles, absolute home paths, or private keys.

The website links to GitHub releases instead of constructing installer URLs. Release publication must verify native builds, signing, checksums, update verification, clean installation, and upgrades before advertising availability. Until those checks pass, V3.0 is labeled a development preview. Mobile pairing and native deployment capabilities must not be claimed as available merely because screens render.

## Verification

From `apps/desktop`:

```sh
bun test tests/public-website.test.tsx
bun run build
```

The route tests exercise public pages, operational deep links, installation guidance, and the absence of fake checkout/download controls. They do not validate native installation or replace browser layout testing. No local development server is required by these checks.
