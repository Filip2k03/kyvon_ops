import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Terminal, ShieldAlert } from 'lucide-react';
import { Backend, hasBackend } from '../../lib/backend';

/**
 * The PTY surface for a multiplexed SSH channel.
 *
 * This screen deliberately does nothing when no channel is attached.
 *
 * The version this replaced ran a simulated shell: it answered `uptime`,
 * `docker ps`, `nginx -t` and `df -h` with invented output, printed
 * "Ed25519 Verified" and "OS Keyring Authenticated" in its banner, and
 * replied `Executed successfully (exit code 0)` to *any other input*. An
 * operator typing `systemctl restart nginx` would have been told it worked.
 *
 * A terminal that lies about execution is worse than no terminal, so input is
 * echoed locally and plainly refused until `open_terminal` gives us a real
 * channel to forward keystrokes to (PROMPTS.md §108, §118).
 */
export const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const [sessionId] = useState<string | null>(null);

  const attached = hasBackend() && sessionId !== null;

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#0b0d12',
        foreground: '#e5e7eb',
        cursor: '#00F298',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(terminalRef.current);
    setTimeout(() => fitAddon.fit(), 50);

    term.writeln('\x1b[1;36mKyvonOPS PTY\x1b[0m');
    if (!hasBackend()) {
      term.writeln('\x1b[33mNo SSH transport in this build.\x1b[0m');
      term.writeln('');
      term.writeln('This page is running in a browser, which cannot open a TCP');
      term.writeln('connection to port 22 or read a key from your OS keychain.');
      term.writeln('Use the KyvonOPS desktop application for shell access.');
    } else {
      term.writeln('\x1b[33mNo channel attached.\x1b[0m');
      term.writeln('');
      term.writeln('Select a host and connect to open a multiplexed PTY channel.');
    }
    term.writeln('');

    let line = '';
    const prompt = () => term.write('\x1b[90m(not connected)\x1b[0m$ ');
    prompt();

    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n');
        const cmd = line.trim();
        line = '';
        if (cmd.length === 0) {
          prompt();
          return;
        }
        if (attached && sessionId) {
          void Backend.writeTerminal(sessionId, `${cmd}\n`);
          return;
        }
        // Never claim an outcome for a command that was not run.
        term.writeln(`\x1b[31mNot executed:\x1b[0m no SSH channel is attached.`);
        term.writeln(`\x1b[90m${cmd}\x1b[0m`);
        prompt();
      } else if (data === '') {
        if (line.length > 0) {
          line = line.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data >= ' ' && data <= '~') {
        line += data;
        term.write(data);
      }
    });

    xtermInstance.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [attached, sessionId]);

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface p-3 rounded-xl border border-border shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center text-info">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Shell</div>
            <div className="text-[11px] text-secondary">
              {hasBackend()
                ? 'Desktop runtime — connect a host to attach a channel'
                : 'Web build — no SSH transport available'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" /> Not connected
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 min-h-0 rounded-xl border border-border bg-[#0b0d12] p-3 overflow-hidden"
      />
    </div>
  );
};
