import React, { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ChevronDown, ChevronUp, RotateCcw, Search, ShieldAlert, Terminal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { NoDataState } from '../../components/ui/NoDataState';
import { Backend, hasBackend, type Loaded } from '../../lib/backend';
import { onTerminalEvent, type TerminalEvent } from '../../lib/events';

type TerminalStatus = 'opening' | 'attached' | 'closing' | 'closed' | 'failed';

const clampDimension = (value: number) => Math.max(2, Math.min(500, value));

function describeFailure(result: Exclude<Loaded<unknown>, { state: 'ok' }>): string {
  return `${result.reason}. ${result.detail}`;
}

/** Decode terminal bytes without treating arbitrary PTY output as UTF-8 text. */
function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** A real xterm.js surface backed by one multiplexed SSH PTY channel. */
export const TerminalView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get('server')?.trim() ?? '';
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const inputEnabledRef = useRef(false);
  const [status, setStatus] = useState<TerminalStatus>('opening');
  const [error, setError] = useState<string | null>(null);
  const [exitStatus, setExitStatus] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!hasBackend() || !serverId || !terminalRef.current) return;

    const element = terminalRef.current;
    let disposed = false;
    let opening = true;
    let removeEventListener = () => {};
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastDimensions = '';
    let writeQueue = Promise.resolve();
    const pendingEvents: TerminalEvent[] = [];

    setStatus('opening');
    setError(null);
    setExitStatus(null);
    setSearchOpen(false);

    const term = new XTerm({
      allowTransparency: false,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      minimumContrastRatio: 4.5,
      scrollback: 10_000,
      theme: {
        background: '#0b0d12',
        foreground: '#e5e7eb',
        cursor: '#00F298',
        selectionBackground: '#175c4a',
      },
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(element);
    xtermRef.current = term;
    searchAddonRef.current = searchAddon;

    const fail = (message: string) => {
      if (disposed) return;
      inputEnabledRef.current = false;
      setError(message);
      setStatus('failed');
    };

    const processEvent = (event: TerminalEvent) => {
      if (!sessionIdRef.current || event.session_id !== sessionIdRef.current) return;
      if (event.event === 'terminal_output') {
        try {
          term.write(decodeBase64(event.dataB64));
        } catch {
          fail('The desktop backend sent terminal output that was not valid base64. The session was not rendered.');
        }
        return;
      }

      inputEnabledRef.current = false;
      sessionIdRef.current = null;
      setExitStatus(event.exit_status);
      setStatus('closed');
    };

    const fit = () => {
      try {
        fitAddon.fit();
      } catch {
        return { cols: 80, rows: 24 };
      }
      const cols = clampDimension(term.cols);
      const rows = clampDimension(term.rows);
      if (cols !== term.cols || rows !== term.rows) term.resize(cols, rows);
      return { cols, rows };
    };

    const resizeObserver = new ResizeObserver(() => {
      const { cols, rows } = fit();
      if (!sessionIdRef.current) return;
      const dimensions = `${cols}:${rows}`;
      if (dimensions === lastDimensions) return;
      lastDimensions = dimensions;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const sessionId = sessionIdRef.current;
        if (!sessionId || disposed) return;
        void Backend.resizeTerminal(sessionId, cols, rows).then((result) => {
          if (result.state !== 'ok' && !disposed && sessionIdRef.current === sessionId) {
            fail(describeFailure(result));
          }
        });
      }, 80);
    });
    resizeObserver.observe(element);

    const inputSubscription = term.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!inputEnabledRef.current || !sessionId) return;
      // Serialize IPC writes so separate key events cannot arrive out of order.
      writeQueue = writeQueue.then(async () => {
        if (disposed || !inputEnabledRef.current || sessionIdRef.current !== sessionId) return;
        const result = await Backend.writeTerminal(sessionId, data);
        if (result.state !== 'ok' && !disposed && sessionIdRef.current === sessionId) {
          fail(describeFailure(result));
        }
      });
    });

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      const isMac = navigator.userAgent.includes('Mac');
      const openSearch = (isMac && event.metaKey && event.key.toLowerCase() === 'f')
        || (!isMac && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f');
      if (openSearch) {
        setSearchOpen(true);
        return false;
      }

      const copy = (isMac && event.metaKey && event.key.toLowerCase() === 'c')
        || (!isMac && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c');
      if (copy && term.hasSelection() && navigator.clipboard) {
        void navigator.clipboard.writeText(term.getSelection()).catch(() => {});
        return false;
      }
      // With no selection Ctrl-C must continue to the remote PTY.
      return true;
    });

    void (async () => {
      const unlisten = await onTerminalEvent((event) => {
        if (disposed) return;
        if (opening && !sessionIdRef.current) {
          // Opening can produce output before invoke resolves with its id.
          if (pendingEvents.length < 512) pendingEvents.push(event);
          return;
        }
        processEvent(event);
      });
      if (disposed) {
        unlisten();
        return;
      }
      removeEventListener = unlisten;

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;
      const { cols, rows } = fit();
      lastDimensions = `${cols}:${rows}`;
      const opened = await Backend.openTerminal(serverId, cols, rows);
      opening = false;

      if (disposed) {
        if (opened.state === 'ok') void Backend.closeTerminal(opened.data);
        return;
      }
      if (opened.state !== 'ok') {
        fail(describeFailure(opened));
        return;
      }

      sessionIdRef.current = opened.data;
      inputEnabledRef.current = true;
      setStatus('attached');
      for (const event of pendingEvents) processEvent(event);
      pendingEvents.length = 0;
      term.focus();
    })();

    return () => {
      disposed = true;
      inputEnabledRef.current = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      inputSubscription.dispose();
      removeEventListener();
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) void Backend.closeTerminal(sessionId);
      term.dispose();
      if (xtermRef.current === term) xtermRef.current = null;
      if (searchAddonRef.current === searchAddon) searchAddonRef.current = null;
    };
  }, [attempt, serverId]);

  const closeSession = async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    inputEnabledRef.current = false;
    setStatus('closing');
    const result = await Backend.closeTerminal(sessionId);
    if (result.state !== 'ok') {
      setError(describeFailure(result));
      setStatus('failed');
      return;
    }
    sessionIdRef.current = null;
    setExitStatus(null);
    setStatus('closed');
  };

  if (!hasBackend()) {
    return (
      <NoDataState
        variant="unavailable"
        title="Terminal access requires the desktop application"
        detail="A browser cannot open port 22 or read credentials from the OS keychain. Install and open KyvonOPS Desktop to use SSH terminals."
        action={<Link to="/downloads" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">View desktop downloads</Link>}
      />
    );
  }

  if (!serverId) {
    return (
      <NoDataState
        variant="empty"
        title="Choose a connected server"
        detail="Open a terminal from Fleet Inventory after the server has an authenticated SSH connection."
        action={<Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">Choose a server</Link>}
      />
    );
  }

  const statusText = status === 'attached'
    ? 'Connected'
    : status === 'opening'
      ? 'Opening PTY…'
      : status === 'closing'
        ? 'Closing…'
        : status === 'closed'
          ? exitStatus === null ? 'Session closed' : `Exited ${exitStatus}`
          : 'Unavailable';

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3">
      <div className="flex shrink-0 flex-col items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-info/20 bg-info/10 text-info">
            <Terminal className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">SSH shell</div>
            <div className="truncate font-mono text-[11px] text-secondary" title={serverId}>{serverId}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSearchOpen(true)} className="rounded-lg border border-border bg-elevated p-2 text-secondary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-info" aria-label="Search terminal scrollback" title="Search scrollback">
            <Search className="h-4 w-4" aria-hidden />
          </button>
          {status === 'attached' ? (
            <button type="button" onClick={() => void closeSession()} className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs font-semibold text-secondary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-info">Close session</button>
          ) : null}
          <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${status === 'attached' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-400'}`} role="status">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> {statusText}
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex shrink-0 items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <span>{error} No command was simulated or reported as successful.</span>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="flex shrink-0 items-center gap-1 font-semibold text-white hover:underline"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry</button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-[#0b0d12]">
        {searchOpen ? (
          <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-xl">
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); if (event.target.value) searchAddonRef.current?.findNext(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
                if (event.key === 'Enter') {
                  if (event.shiftKey) searchAddonRef.current?.findPrevious(searchQuery);
                  else searchAddonRef.current?.findNext(searchQuery);
                }
              }}
              className="w-52 max-w-[55vw] bg-transparent px-2 py-1 text-xs text-white outline-none placeholder:text-secondary"
              placeholder="Search scrollback"
              aria-label="Search terminal scrollback"
            />
            <button type="button" onClick={() => searchAddonRef.current?.findPrevious(searchQuery)} className="p-1.5 text-secondary hover:text-white" aria-label="Previous match"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => searchAddonRef.current?.findNext(searchQuery)} className="p-1.5 text-secondary hover:text-white" aria-label="Next match"><ChevronDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => { searchAddonRef.current?.clearDecorations(); setSearchOpen(false); }} className="p-1.5 text-secondary hover:text-white" aria-label="Close search"><X className="h-4 w-4" /></button>
          </div>
        ) : null}
        <div ref={terminalRef} className="h-full w-full p-3" aria-label={`SSH terminal for ${serverId}`} />
        {status === 'opening' ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0d12]/80 text-xs font-semibold text-secondary">Opening a real SSH PTY…</div> : null}
        {status === 'closed' ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border bg-surface/95 px-4 py-3 text-xs text-secondary">
            <span>{exitStatus === null ? 'The remote shell closed without an exit status.' : `The remote shell exited with status ${exitStatus}.`}</span>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="flex items-center gap-1 font-semibold text-white hover:underline"><RotateCcw className="h-3.5 w-3.5" /> Reopen</button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
