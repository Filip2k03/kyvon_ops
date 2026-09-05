import { ConnectionState } from './server';
import { Frame } from './telemetry';

export type KyvonEvent =
  | { event: 'connection_state'; serverId: string; state: ConnectionState }
  | { event: 'host_key_prompt'; serverId: string; fingerprint: string }
  | { event: 'probe'; serverId: string; data: any }
  | { event: 'telemetry'; frame: Frame }
  | { event: 'terminal_output'; serverId: string; data: string }
  | { event: 'terminal_closed'; serverId: string }
  | { event: 'log_line'; serverId: string; line: string }
  | { event: 'log_closed'; serverId: string }
  | { event: 'fault'; serverId: string; message: string }
  | { event: 'audited'; serverId: string; action: string };
