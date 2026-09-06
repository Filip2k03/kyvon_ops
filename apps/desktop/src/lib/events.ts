import type { UnlistenFn } from '@tauri-apps/api/event';
import type { Frame } from '../types/telemetry';
import { hasBackend } from './backend';

/**
 * Subscriptions to the backend's event channels.
 *
 * `KyvonEvent::channel()` routes traffic to separate Tauri channels
 * — `kyvon://telemetry`, `kyvon://terminal`, `kyvon://logs`, `kyvon://core` —
 * specifically so a busy terminal cannot starve the dashboard's listener and
 * a screen can unsubscribe from one without the other. Listening to a single
 * name (this file used to listen on `kyvon-event`, which nothing emits) both
 * missed every event and threw that isolation away.
 *
 * Each subscribe returns a no-op unlisten in the web build, so a component's
 * cleanup path is the same either way.
 */

const NOOP: UnlistenFn = () => {};

async function subscribe<T>(channel: string, onEvent: (payload: T) => void): Promise<UnlistenFn> {
  if (!hasBackend()) return NOOP;
  const { listen } = await import('@tauri-apps/api/event');
  return listen<T>(channel, (e) => onEvent(e.payload));
}

/** A telemetry frame, tagged with the server it came from. */
export interface TelemetryEvent {
  server_id: string;
  frame: Frame;
}

export const onTelemetry = (fn: (e: TelemetryEvent) => void) =>
  subscribe<TelemetryEvent>('kyvon://telemetry', fn);

/** Connection state changes, host-key results and other domain events. */
export const onCoreEvent = <T,>(fn: (e: T) => void) => subscribe<T>('kyvon://core', fn);

/**
 * A collector stopping. Carries why when the backend could determine it, so a
 * panel can say what happened instead of silently ceasing to update.
 */
export interface CollectorStopped {
  server_id: string;
  message: string | null;
}

export const onCollectorStopped = (fn: (e: CollectorStopped) => void) =>
  subscribe<CollectorStopped>('kyvon-collector-stopped', fn);

/** The backend asking whether to trust a host key. */
export const onHostKeyPrompt = <T,>(fn: (e: T) => void) =>
  subscribe<T>('kyvon-host-key-prompt', fn);

/** Raw PTY output or a terminal process exiting. */
export type TerminalEvent =
  | { event: 'terminal_output'; session_id: string; dataB64: string }
  | { event: 'terminal_closed'; session_id: string; exit_status: number | null };

export const onTerminalEvent = (fn: (e: TerminalEvent) => void) =>
  subscribe<TerminalEvent>('kyvon://terminal', fn);
