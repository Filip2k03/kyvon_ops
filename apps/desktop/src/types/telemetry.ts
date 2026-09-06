import { TimestampMs } from './common';

/**
 * Hand-maintained mirror of `crates/kyvon-core/src/telemetry.rs`.
 *
 * Field names are snake_case because that is how the Rust structs are written
 * and none of them carries `#[serde(rename_all)]`. This file previously
 * declared invented shapes — `CpuSample { usage, cores: number }` against a
 * Rust type with eleven fields and `cores: Vec<f32>` — so any panel reading
 * them would have rendered `undefined`. See `types/server.ts` for the same
 * hazard and why nothing catches it at compile time.
 */

/**
 * All percentages are of total CPU time across the interval since the previous
 * sample, so the first sample of a stream never arrives: a rate needs two
 * readings. `cores` is per-core busy percentage, indexed by core number.
 */
export interface CpuSample {
  total: number;
  user: number;
  system: number;
  iowait: number;
  steal: number;
  idle: number;
  nice: number;
  irq: number;
  cores: number[];
  /** 1, 5 and 15 minute load averages. */
  load: [number, number, number];
  ctx_switches: number | null;
  procs_running: number | null;
  procs_blocked: number | null;
}

export interface MemorySample {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  free_bytes: number;
  cached_bytes: number;
  buffers_bytes: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
  /** Null on kernels without /proc/pressure — not zero, which would claim a measurement. */
  pressure_some_avg60: number | null;
}

export interface NetworkInterface {
  name: string;
  /** Rates over the sample interval, not cumulative counters. */
  rx_bytes_per_sec: number;
  tx_bytes_per_sec: number;
  rx_packets_per_sec: number;
  tx_packets_per_sec: number;
  rx_errors: number;
  tx_errors: number;
  rx_dropped: number;
  tx_dropped: number;
}

export interface NetworkSample {
  interfaces: NetworkInterface[];
}

export interface AgentError {
  collector: string;
  message: string;
}

/**
 * `#[serde(tag = "type", content = "data", rename_all = "snake_case")]`.
 *
 * Only the variants the desktop collector currently produces are modelled as
 * concrete shapes; the rest are declared so an exhaustive switch stays honest
 * about receiving them.
 */
export type Payload =
  | { type: 'cpu'; data: CpuSample }
  | { type: 'memory'; data: MemorySample }
  | { type: 'network'; data: NetworkSample }
  | { type: 'error'; data: AgentError }
  | { type: 'hello'; data: unknown }
  | { type: 'disk'; data: unknown }
  | { type: 'processes'; data: unknown }
  | { type: 'services'; data: unknown };

/**
 * `version` is serialised as `v`, and the payload is `#[serde(flatten)]`ed —
 * so a frame on the wire is `{ v, ts, type, data }`, not a nested `payload`.
 */
export type Frame = { v: number; ts: TimestampMs } & Payload;
