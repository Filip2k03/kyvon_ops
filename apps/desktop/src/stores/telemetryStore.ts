import { create } from 'zustand';
import { CpuSample, MemorySample, NetworkSample, DiskSample, ProcessSample, ServiceSample } from '../types';

interface ServerTelemetry {
  cpu?: CpuSample;
  memory?: MemorySample;
  network?: NetworkSample;
  disks: DiskSample[];
  processes: ProcessSample[];
  services: ServiceSample[];
}

interface TelemetryState {
  data: Record<string, ServerTelemetry>;
  updateCpu: (serverId: string, sample: CpuSample) => void;
  updateMemory: (serverId: string, sample: MemorySample) => void;
  updateNetwork: (serverId: string, sample: NetworkSample) => void;
  updateDisks: (serverId: string, samples: DiskSample[]) => void;
  updateProcesses: (serverId: string, samples: ProcessSample[]) => void;
  updateServices: (serverId: string, samples: ServiceSample[]) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  data: {},
  updateCpu: (id, sample) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], cpu: sample } } })),
  updateMemory: (id, sample) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], memory: sample } } })),
  updateNetwork: (id, sample) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], network: sample } } })),
  updateDisks: (id, samples) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], disks: samples } } })),
  updateProcesses: (id, samples) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], processes: samples } } })),
  updateServices: (id, samples) => set((state) => ({ data: { ...state.data, [id]: { ...state.data[id], services: samples } } })),
}));