import { create } from 'zustand';

interface TerminalState {
  activeSessions: string[];
  addSession: (id: string) => void;
  removeSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  activeSessions: [],
  addSession: (id) => set((state) => ({ activeSessions: [...new Set([...state.activeSessions, id])] })),
  removeSession: (id) => set((state) => ({ activeSessions: state.activeSessions.filter(s => s !== id) })),
}));