import React, { useMemo } from 'react';
import { useServerStore } from '../../stores/serverStore';
import { useUiStore } from '../../stores/uiStore';
import { Menu, Search, Wifi, Shield } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export const Header: React.FC = () => {
  const { activeServerId, connectionStates } = useServerStore();
  const { toggleSidebar, setCommandPaletteOpen } = useUiStore();
  const state = activeServerId ? connectionStates[activeServerId] || 'connected' : 'connected';

  // Detect OS for shortcut hint (macOS: ⌘K, Windows/Linux: Ctrl+K)
  const isMac = useMemo(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      return window.navigator.userAgent.toLowerCase().includes('mac');
    }
    return true;
  }, []);

  return (
    <header 
      data-tauri-drag-region 
      className="h-14 bg-surface/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4 shrink-0 select-none z-40"
    >
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} className="text-secondary hover:text-white p-1 rounded hover:bg-elevated transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <span className="font-semibold text-sm text-white flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            {activeServerId || 'production-01'}
          </span>
          <StatusBadge status={state === 'connected' ? 'healthy' : state === 'error' ? 'critical' : 'warning'} />
          <span className="text-[11px] font-mono text-secondary hidden sm:inline bg-elevated px-2 py-0.5 rounded border border-border/60">
            SSH Direct Multiplex
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="hidden md:flex items-center text-xs font-mono text-secondary bg-elevated/80 px-2.5 py-1 rounded border border-border">
          <Shield className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
          <span>Local SQLite WAL • Zero SaaS</span>
        </div>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center text-xs text-secondary bg-elevated hover:bg-elevated/80 border border-border rounded-lg px-3 py-1.5 hover:border-secondary transition-all shadow-sm"
        >
          <Search className="w-3.5 h-3.5 mr-2" />
          <span className="hidden sm:inline">Universal Palette...</span>
          <span className="sm:hidden">Search...</span>
          <kbd className="ml-3 font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border border-border text-white">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>
    </header>
  );
};