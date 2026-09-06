import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';

const COMMANDS: Array<{ id: string; label: string; hint: string; to: string }> = [
  { id: 'cc', label: 'Open command center', hint: 'Overview', to: '/command-center' },
  { id: 'servers', label: 'Open servers', hint: 'Connect a VPS', to: '/servers' },
  { id: 'term', label: 'Open terminal', hint: 'PTY', to: '/terminal' },
  { id: 'proc', label: 'Open processes', hint: 'ps sample', to: '/processes' },
  { id: 'svc', label: 'Open services', hint: 'systemd', to: '/services' },
  { id: 'net', label: 'Open network', hint: 'ss listen', to: '/network' },
  { id: 'disk', label: 'Open storage', hint: 'df', to: '/storage' },
  { id: 'logs', label: 'Open logs', hint: 'Journal', to: '/logs' },
  { id: 'diag', label: 'Open diagnostics', hint: 'Health', to: '/diagnostics' },
  { id: 'twin', label: 'Open digital twin', hint: 'Topology', to: '/twin' },
  { id: 'sec', label: 'Open security', hint: 'Host keys', to: '/security' },
  { id: 'dl', label: 'Open downloads', hint: 'Releases', to: '/downloads' },
];

export const CommandPalette = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (event.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) setQuery('');
  }, [commandPaletteOpen]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
  }, [query]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 pt-[18vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-4 shadow-2xl">
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a screen…"
          aria-label="Filter commands"
          className="w-full border-none bg-transparent text-lg text-primary outline-none placeholder-secondary"
        />
        <ul className="mt-4 max-h-80 space-y-1 overflow-auto border-t border-border pt-3">
          {matches.length === 0 && <li className="px-2 py-2 text-sm text-secondary">No matching command.</li>}
          {matches.map((cmd) => (
            <li key={cmd.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-white hover:bg-elevated"
                onClick={() => {
                  navigate(cmd.to);
                  setCommandPaletteOpen(false);
                }}
              >
                <span>{cmd.label}</span>
                <span className="font-mono text-[11px] text-secondary">{cmd.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-secondary">Esc closes. Dangerous host actions stay on their own screens with confirmation.</p>
      </div>
    </div>
  );
};
