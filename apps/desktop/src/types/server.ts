import { TimestampMs } from './common';

export type AuthMethod = 
  | { type: 'password'; password?: string }
  | { type: 'private_key'; path: string; encrypted: boolean }
  | { type: 'agent' };

export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'verifying_host' 
  | 'authenticating' 
  | 'connected' 
  | 'reconnecting' 
  | 'error';

export type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export interface HostFacts {
  os: string;
  kernel: string;
  hostname: string;
  uptime: number;
}

export interface Capabilities {
  docker: boolean;
  systemd: boolean;
  apt: boolean;
  yum: boolean;
}

export type CloudHint = 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'unknown';

export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  auth: AuthMethod;
  tags: string[];
  createdAt: TimestampMs;
}
