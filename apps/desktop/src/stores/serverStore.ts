import { create } from 'zustand';
import { ServerProfile, ConnectionState } from '../types';

interface ServerState {
  servers: ServerProfile[];
  activeServerId: string | null;
  connectionStates: Record<string, ConnectionState>;
  setServers: (servers: ServerProfile[]) => void;
  setActiveServer: (id: string | null) => void;
  setConnectionState: (id: string, state: ConnectionState) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  activeServerId: null,
  connectionStates: {},
  setServers: (servers) => set({ servers }),
  setActiveServer: (id) => set({ activeServerId: id }),
  setConnectionState: (id, state) => set((prev) => ({
    connectionStates: { ...prev.connectionStates, [id]: state }
  })),
}));