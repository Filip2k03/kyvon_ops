import { TimestampMs } from './common';

/**
 * Hand-maintained mirror of `crates/kyvon-core/src/inventory.rs`.
 *
 * These shapes cross the Tauri IPC boundary as serde JSON, so the field names
 * here must match the Rust field names exactly. `ServerProfile` carries no
 * `#[serde(rename_all)]`, so its keys are snake_case as written in Rust —
 * `alias`, `hostname`, `username`, `created_at` — not the camelCase a
 * TypeScript author would reach for.
 *
 * This file previously declared `name`, `host`, `user` and `createdAt`, none
 * of which the backend ever sends; any screen reading them would have rendered
 * `undefined`. Nothing catches that at compile time, because the boundary is
 * `invoke<T>()` casting untyped JSON — so when editing either side, change
 * both, and check the `#[serde]` attributes rather than assuming a convention.
 */

/** Matches Rust's internally tagged, snake_case AuthMethod enum. */
export type AuthMethod =
  | { type: 'password' }
  | { type: 'agent' }
  | { type: 'private_key'; path: string; encrypted: boolean };

/** Human-readable summary of an `AuthMethod` for display. */
export function describeAuth(auth: AuthMethod): string {
  if (auth.type === 'password') return 'Password (keychain)';
  if (auth.type === 'agent') return 'SSH agent';
  return auth.encrypted ? 'Private key (passphrase in keychain)' : 'Private key';
}

/** `#[serde(rename_all = "snake_case")]` on the Rust enum. */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'verifying_host'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export type CloudHint = 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'hetzner' | 'unknown';

export interface Capabilities {
  docker: boolean;
  systemd: boolean;
  apt: boolean;
  yum: boolean;
}

/** Mirror of `kyvon_core::capability::HostFacts`. `None` until a probe succeeds. */
export interface HostFacts {
  os_id: string;
  os_name: string;
  os_version: string;
  arch: string;
  kernel: string;
  hostname: string;
  package_manager: string;
  cpu_cores: number;
  memory_total_bytes: number;
  uptime_secs: number;
  cloud: CloudHint | null;
  capabilities: Capabilities;
  probed_at: TimestampMs;
}

/** Mirror of `kyvon_core::inventory::ServerProfile`. */
export interface ServerProfile {
  id: string;
  alias: string;
  hostname: string;
  port: number;
  username: string;
  auth: AuthMethod;
  tags: string[];
  /** Null until the first successful probe — never invent facts to fill it. */
  facts: HostFacts | null;
  created_at: TimestampMs;
  updated_at: TimestampMs;
}
