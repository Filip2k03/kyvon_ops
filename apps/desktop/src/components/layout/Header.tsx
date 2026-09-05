import React, { useMemo } from 'react';
import { useServerStore } from '../../stores/serverStore';
import { useUiStore } from '../../stores/uiStore';
import { Menu, Search, Wifi, Shield } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export const Header: React.FC = () => {
  const { activeServerId, connectionStates } = useServerStore();
  const { toggleSidebar, toggleMobileDrawer, setCommandPaletteOpen } = useUiStore();
  const state = activeServerId ? connectionStates[activeServerId] || 'connected' : 'connected';

  // Detect OS for shortcut hint (macOS: ⌘K, Windows/Linux: Ctrl+K)
  const isMac = useMemo(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      return window.navigator.userAgent.toLowerCase().includes('mac');
    }
    return true;
  }, []);

  const handleMenuClick = () => {
    if (window.innerWidth < 768) {
      toggleMobileDrawer();
    } else {
      toggleSidebar();
    }
  };

  return (
    <header 
      data-tauri-drag-region 
      className="h-14 bg-surface/90 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-4 shrink-0 select-none z-40"
    >
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <button 
          onClick={handleMenuClick} 
          className="text-secondary hover:text-white p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-elevated transition-colors flex items-center justify-center"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {/*
            Falling back to a hostname when nothing is selected would put an
            invented host in the chrome of every screen (§108). "No host
            selected" is the honest fallback, and the indicator only reads
            connected when a session actually is.
          */}
          <span className="font-semibold text-xs sm:text-sm text-white flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-[200px]">
            <Wifi
              className={`w-3.5 h-3.5 shrink-0 ${
                activeServerId && state === 'connected' ? 'text-emerald-400' : 'text-secondary'
              }`}
            />
            <span className="truncate">{activeServerId ?? 'No host selected'}</span>
          </span>
          <StatusBadge status={state === 'connected' ? 'healthy' : state === 'error' ? 'critical' : 'warning'} />
          <span className="text-[11px] font-mono text-secondary hidden md:inline bg-elevated px-2 py-0.5 rounded border border-border/60">
            SSH Multiplex
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <div className="hidden lg:flex items-center text-xs font-mono text-secondary bg-elevated/80 px-2.5 py-1 rounded border border-border">
          <Shield className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
          <span>Local SQLite WAL • Zero SaaS</span>
        </div>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center text-xs text-secondary bg-elevated hover:bg-elevated/80 border border-border rounded-lg px-2.5 sm:px-3 py-1.5 hover:border-secondary transition-all shadow-sm min-h-[40px]"
          aria-label="Open Command Palette"
        >
          <Search className="w-3.5 h-3.5 mr-1.5 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">Palette...</span>
          <span className="sm:hidden text-[11px]">Search</span>
          <kbd className="hidden sm:inline ml-2 font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border border-border text-white">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>
    </header>
  );
};