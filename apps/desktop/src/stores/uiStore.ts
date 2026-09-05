import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  commandPaletteOpen: boolean;
  theme: 'dark';
  toggleSidebar: () => void;
  setMobileDrawerOpen: (open: boolean) => void;
  toggleMobileDrawer: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  commandPaletteOpen: false,
  theme: 'dark',
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  toggleMobileDrawer: () => set((state) => ({ mobileDrawerOpen: !state.mobileDrawerOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));