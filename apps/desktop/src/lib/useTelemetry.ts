import { useEffect, useState } from 'react';
import { onCollectorStopped, onTelemetry } from './events';
import type {
  CpuSample,
  DiskSample,
  MemorySample,
  NetworkSample,
  PortSample,
  ProcessSample,
  ServiceSample,
} from '../types/telemetry';

/**
 * The latest measured sample per signal, for one server.
 *
 * Every field starts `null` and only becomes a number when a frame carrying
 * that signal actually arrives. That is the whole point: a screen cannot show
 * 0% CPU before the second reading exists, because a rate needs two readings
 * and the backend deliberately emits nothing until it has them.
 *
 * `stoppedReason` is set when the collector dies, so a panel can say why it
 * stopped updating instead of quietly freezing on a stale number.
 */
export interface LiveTelemetry {
  cpu: CpuSample | null;
  memory: MemorySample | null;
  network: NetworkSample | null;
  /** Slow-cadence signals: processes every 3 ticks, services every 15, disk and ports every 30. */
  processes: ProcessSample | null;
  services: ServiceSample | null;
  disk: DiskSample | null;
  ports: PortSample | null;
  /**
   * The most recent parse failure per collector (`"disk"`, `"processes"`, …).
   * A screen for that signal shows the message instead of an empty table, so a
   * host whose `df` output the parser cannot read is reported as such.
   */
  errors: Record<string, string>;
  /** Timestamp of the most recent frame, so the UI can age its own display. */
  lastFrameAt: number | null;
  stoppedReason: string | null;
}

const EMPTY: LiveTelemetry = {
  cpu: null,
  memory: null,
  network: null,
  processes: null,
  services: null,
  disk: null,
  ports: null,
  errors: {},
  lastFrameAt: null,
  stoppedReason: null,
};

/**
 * Subscribe to the telemetry stream for one server.
 *
 * Pass `null` to subscribe to nothing — used when no server is selected, so a
 * caller does not have to conditionally break the rules of hooks.
 */
export function useTelemetry(serverId: string | null): LiveTelemetry {
  const [live, setLive] = useState<LiveTelemetry>(EMPTY);

  useEffect(() => {
    if (!serverId) {
      setLive(EMPTY);
      return;
    }

    // Reset on server change: showing the previous host's numbers under a new
    // name would misattribute a real measurement, which is its own kind of lie.
    setLive(EMPTY);

    let active = true;
    const unlisteners: Array<() => void> = [];

    void onTelemetry((event) => {
      if (!active || event.server_id !== serverId) return;
      const { frame } = event;
      setLive((prev) => {
        const next: LiveTelemetry = { ...prev, lastFrameAt: frame.ts, stoppedReason: null };
        switch (frame.type) {
          case 'cpu':
            next.cpu = frame.data;
            break;
          case 'memory':
            next.memory = frame.data;
            break;
          case 'network':
            next.network = frame.data;
            break;
          case 'processes':
            next.processes = frame.data;
            next.errors = without(prev.errors, 'processes');
            break;
          case 'services':
            next.services = frame.data;
            next.errors = without(prev.errors, 'services');
            break;
          case 'disk':
            next.disk = frame.data;
            next.errors = without(prev.errors, 'disk');
            break;
          case 'ports':
            next.ports = frame.data;
            next.errors = without(prev.errors, 'ports');
            break;
          case 'error':
            next.errors = { ...prev.errors, [frame.data.collector]: frame.data.message };
            break;
          case 'hello':
            break;
        }
        return next;
      });
    }).then((un) => (active ? unlisteners.push(un) : un()));

    void onCollectorStopped((event) => {
      if (!active || event.server_id !== serverId) return;
      setLive((prev) => ({
        ...prev,
        stoppedReason: event.message ?? 'The telemetry collector stopped.',
      }));
    }).then((un) => (active ? unlisteners.push(un) : un()));

    return () => {
      active = false;
      unlisteners.forEach((un) => un());
    };
  }, [serverId]);

  return live;
}

/** A successful sample clears the previous failure for the same collector. */
function without(errors: Record<string, string>, key: string): Record<string, string> {
  if (!(key in errors)) return errors;
  const rest = { ...errors };
  delete rest[key];
  return rest;
}

/** Format a byte count for display. Returns null for null, never "0 B". */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
