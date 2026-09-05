import { invoke } from '@tauri-apps/api/core';
import { ServerProfile } from '../types';

export const TauriApi = {
  getServers: () => invoke<ServerProfile[]>('get_servers'),
  addServer: (server: Partial<ServerProfile>) => invoke<string>('add_server', { server }),
  connect: (id: string) => invoke<void>('connect', { id }),
  disconnect: (id: string) => invoke<void>('disconnect', { id }),
  terminalWrite: (id: string, data: string) => invoke<void>('terminal_write', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) => invoke<void>('terminal_resize', { id, cols, rows }),
};