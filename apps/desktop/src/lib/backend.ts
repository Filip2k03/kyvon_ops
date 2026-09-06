/**
 * The single boundary between the UI and a real KyvonOPS backend.
 *
 * The same `dist/` bundle is served three ways — as the Tauri desktop shell,
 * as the Capacitor mobile app, and as a plain web page on Cloudflare Pages —
 * but only the desktop shell has SSH, the OS keychain and the local SQLite
 * store behind it. A browser tab has no backend at all and never will: it
 * cannot hold a private key or open port 22.
 *
 * So every screen has to distinguish three outcomes, and PROMPTS.md §108
 * forbids collapsing them into invented data:
 *
 *   ok           — the backend answered; this is real
 *   unavailable  — there is no backend here; say so, do not guess
 *   failed       — a backend exists but the call did not work
 *
 * `Loaded<T>` makes that distinction unavoidable at the type level, because
 * the failure mode this file exists to prevent — a screen rendering plausible
 * numbers it made up — is exactly what happens when "no data" is allowed to
 * look like an empty success.
 */

import type { ServerProfile } from '../types';

export type Loaded<T> =
  | { state: 'ok'; data: T }
  | { state: 'unavailable'; reason: string; detail: string }
  | { state: 'failed'; reason: string; detail: string };

/** True only inside the Tauri shell, where the Rust commands exist. */
export function hasBackend(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** How this bundle is being served, for display in the UI. */
export function runtimeName(): 'desktop' | 'browser' {
  return hasBackend() ? 'desktop' : 'browser';
}

const NO_BACKEND: Omit<Extract<Loaded<never>, { state: 'unavailable' }>, 'state'> = {
  reason: 'No KyvonOPS backend is attached to this session',
  detail:
    'This page is running as a web build, which has no SSH transport, no OS keychain and no local database. ' +
    'Infrastructure data is only available in the desktop application, which connects to your hosts directly from your workstation. ' +
    'Nothing is shown here rather than showing figures that were not measured.',
};

/**
 * Call a Tauri command, mapping every outcome into `Loaded`.
 *
 * `@tauri-apps/api` is imported dynamically so the web build never evaluates
 * it: pulling the IPC module into a plain browser tab throws on load.
 */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<Loaded<T>> {
  if (!hasBackend()) {
    return { state: 'unavailable', ...NO_BACKEND };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return { state: 'ok', data: await invoke<T>(command, args) };
  } catch (error) {
    // §118: name the operation and what to try, never "Unknown error".
    return {
      state: 'failed',
      reason: `The backend rejected \`${command}\``,
      detail: `${error instanceof Error ? error.message : String(error)}. ` +
        'Check that the desktop backend is running and that this build registers the command.',
    };
  }
}

/**
 * Command names as registered in `apps/desktop/src-tauri/src/lib.rs`.
 *
 * These are matched by string at runtime, so a rename on either side fails
 * silently at the IPC boundary rather than at compile time. Keeping them in
 * one list is what makes a mismatch reviewable.
 */
export const Backend = {
  listServers: () => call<ServerProfile[]>('list_servers'),
  addServer: (server: Partial<ServerProfile>) => call<string>('add_server', { server }),
  deleteServer: (id: string) => call<void>('delete_server', { id }),
  connect: (id: string) => call<void>('connect', { id }),
  disconnect: (id: string) => call<void>('disconnect', { id }),
  resolveHostKey: (promptId: string, trust: boolean) => call<void>('resolve_host_key', { promptId, trust }),
  writeTerminal: (id: string, data: string) => call<void>('write_terminal', { id, data }),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    call<void>('resize_terminal', { id, cols, rows }),
  probeCapabilities: (id: string) => call<unknown>('probe_capabilities', { id }),
};
