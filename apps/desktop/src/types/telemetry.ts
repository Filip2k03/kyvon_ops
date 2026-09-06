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

/** Mirror of `FilesystemInfo`. Sizes are bytes; `df -PB1` already scaled them. */
export interface FilesystemInfo {
  mount_point: string;
  device: string;
  /** Empty when `/proc/mounts` did not name the type. */
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  /** 0 when `df -i` was unavailable — inode headroom is then unknown, not full. */
  inodes_total: number;
  inodes_used: number;
}

/** Pseudo-filesystems (tmpfs, overlay, …) are already dropped by the backend. */
export interface DiskSample {
  filesystems: FilesystemInfo[];
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  user: string;
  cpu_pct: number;
  mem_pct: number;
  rss_bytes: number;
  /** `ps` STAT column; the first letter is R, S, D, Z or T. */
  state: string;
  /** Full command line, already passed through secret redaction. */
  command: string;
  uptime_secs: number;
}

export interface ProcessSample {
  /** The top consumers only — see `total` for how many the host really has. */
  processes: ProcessInfo[];
  total: number;
}

export interface ServiceInfo {
  unit: string;
  load_state: string;
  active_state: string;
  sub_state: string;
  description: string;
  /** `enabled`, `disabled`, `static`, `masked`; null when not queried. */
  enabled: string | null;
  active_since_ms: TimestampMs | null;
  restarts: number | null;
}

export interface ServiceSample {
  services: ServiceInfo[];
}

/** `#[serde(rename_all = "snake_case")]` on `Exposure`. */
export type Exposure = 'loopback' | 'interface' | 'all_interfaces';

export interface PortInfo {
  port: number;
  /** `tcp`, `tcp6`, `udp`, `udp6`. */
  protocol: string;
  address: string;
  /** Null when the login could not see the owning process — absent, not guessed. */
  process: string | null;
  pid: number | null;
  exposure: Exposure;
}

export interface PortSample {
  ports: PortInfo[];
}

/**
 * `#[serde(tag = "type", content = "data", rename_all = "snake_case")]`.
 *
 * Every variant the backend emits is modelled concretely so a screen reading
 * `frame.data` is typed end to end; `hello` stays opaque because the desktop
 * only ever inspects it in Rust.
 */
export type Payload =
  | { type: 'cpu'; data: CpuSample }
  | { type: 'memory'; data: MemorySample }
  | { type: 'network'; data: NetworkSample }
  | { type: 'disk'; data: DiskSample }
  | { type: 'processes'; data: ProcessSample }
  | { type: 'services'; data: ServiceSample }
  | { type: 'ports'; data: PortSample }
  | { type: 'error'; data: AgentError }
  | { type: 'hello'; data: unknown };

/**
 * `version` is serialised as `v`, and the payload is `#[serde(flatten)]`ed —
 * so a frame on the wire is `{ v, ts, type, data }`, not a nested `payload`.
 */
export type Frame = { v: number; ts: TimestampMs } & Payload;
