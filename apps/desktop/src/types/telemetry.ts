export interface CpuSample { usage: number; cores: number; }
export interface MemorySample { total: number; used: number; free: number; }
export interface NetworkSample { rx: number; tx: number; }
export interface DiskSample { mount: string; total: number; used: number; }
export interface ProcessSample { pid: number; name: string; cpu: number; mem: number; }
export interface ServiceSample { name: string; status: string; }

export type Payload = 
  | { type: 'hello'; data: { version: string } }
  | { type: 'cpu'; data: CpuSample }
  | { type: 'memory'; data: MemorySample }
  | { type: 'network'; data: NetworkSample }
  | { type: 'disk'; data: DiskSample[] }
  | { type: 'processes'; data: ProcessSample[] }
  | { type: 'services'; data: ServiceSample[] }
  | { type: 'error'; data: { message: string } };

export interface Frame {
  serverId: string;
  timestamp: number;
  payload: Payload;
}