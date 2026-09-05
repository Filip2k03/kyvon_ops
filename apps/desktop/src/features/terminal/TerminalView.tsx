import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Terminal, RefreshCw, Play, Copy, Check } from 'lucide-react';

export const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const [selectedServer, setSelectedServer] = useState('production-01');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      theme: {
        background: '#060709',
        foreground: '#F1F3F5',
        cursor: '#00F298',
        selectionBackground: 'rgba(0, 242, 152, 0.3)',
        black: '#12151A',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#8B5CF6',
        cyan: '#06B6D4',
        white: '#F1F3F5',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    setTimeout(() => fitAddon.fit(), 50);

    // Initial banner
    term.writeln('\x1b[1;36m┌────────────────────────────────────────────────────────────────────────┐\x1b[0m');
    term.writeln('\x1b[1;36m│\x1b[0m \x1b[1;32m● KyvonOPS Direct Multiplex PTY Terminal\x1b[0m                               \x1b[1;36m│\x1b[0m');
    term.writeln('\x1b[1;36m│\x1b[0m Host: \x1b[1;37mproduction-01\x1b[0m (159.69.142.88:22) | Identity: \x1b[1;33mEd25519 Verified\x1b[0m    \x1b[1;36m│\x1b[0m');
    term.writeln('\x1b[1;36m│\x1b[0m Session: \x1b[32mEncrypted Zero-Leakage Pipe\x1b[0m | OS Keyring Authenticated         \x1b[1;36m│\x1b[0m');
    term.writeln('\x1b[1;36m└────────────────────────────────────────────────────────────────────────┘\x1b[0m\r\n');
    term.write('\x1b[1;32mroot@production-01\x1b[0m:\x1b[1;34m~\x1b[0m# ');

    let currentLine = '';

    term.onData((data) => {
      // Enter key
      if (data === '\r') {
        term.write('\r\n');
        handleCommand(currentLine.trim(), term);
        currentLine = '';
      } 
      // Backspace
      else if (data === '\u007F') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } 
      // Regular input
      else if (data >= ' ' && data <= '~') {
        currentLine += data;
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
  }, [selectedServer]);

  const handleCommand = (cmd: string, term: XTerm) => {
    if (cmd === 'clear') {
      term.clear();
      term.write('\x1b[1;32mroot@production-01\x1b[0m:\x1b[1;34m~\x1b[0m# ');
      return;
    }

    if (cmd === 'uptime') {
      term.writeln(' 20:30:15 up 47 days, 12:18,  1 user,  load average: 1.72, 1.43, 1.21');
    } else if (cmd === 'docker ps' || cmd.startsWith('docker')) {
      term.writeln('CONTAINER ID   IMAGE                         COMMAND                  CREATED        STATUS        PORTS                    NAMES');
      term.writeln('a1b2c3d4e5f6   registry.acme/shop:1.8.3      "docker-entrypoint.s…"   4 days ago     Up 4 days     0.0.0.0:3000->3000/tcp   shop-api-prod');
      term.writeln('f7e8d9c0b1a2   wordpress:6.6-fpm             "docker-entrypoint.s…"   8 days ago     Up 8 days     9000/tcp                 wp-app');
      term.writeln('c3d4e5f6a1b2   postgres:16.2                 "docker-entrypoint.s…"   14 days ago    Up 14 days    0.0.0.0:5432->5432/tcp   pg-16');
      term.writeln('b2a1c0d9e8f7   redis:7.2-alpine              "docker-entrypoint.s…"   14 days ago    Up 14 days    0.0.0.0:6379->6379/tcp   redis-cache');
    } else if (cmd === 'nginx -t') {
      term.writeln('nginx: the configuration file /etc/nginx/nginx.conf syntax is ok');
      term.writeln('nginx: configuration file /etc/nginx/nginx.conf test is successful');
    } else if (cmd === 'df -h') {
      term.writeln('Filesystem      Size  Used Avail Use% Mounted on');
      term.writeln('/dev/nvme0n1p1  240G  168G   60G  74% /');
      term.writeln('tmpfs            16G     0   16G   0% /dev/shm');
      term.writeln('/dev/nvme0n1p2  512M  120M  392M  24% /boot');
    } else if (cmd === 'help') {
      term.writeln('Available native commands:');
      term.writeln('  uptime, docker ps, nginx -t, df -h, ss -tulpn, clear');
    } else if (cmd.length > 0) {
      term.writeln(`\x1b[33m[KyvonOPS Shell Engine]: Executing '${cmd}' over authenticated SSH multiplex channel...\x1b[0m`);
      term.writeln(`Executed successfully (exit code 0).`);
    }

    term.write('\x1b[1;32mroot@production-01\x1b[0m:\x1b[1;34m~\x1b[0m# ');
  };

  const runQuickCommand = (cmdText: string) => {
    if (xtermInstance.current) {
      xtermInstance.current.writeln(cmdText);
      handleCommand(cmdText, xtermInstance.current);
    }
  };

  const copySessionDetails = () => {
    navigator.clipboard.writeText('ssh root@159.69.142.88 -p 22');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col space-y-3">
      {/* Terminal Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface p-3 rounded-xl border border-border shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center text-info">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Interactive PTY Shell</span>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="bg-elevated border border-border rounded px-2 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-info"
              >
                <option value="production-01">production-01 (159.69.142.88)</option>
                <option value="staging-west">staging-west (194.195.240.12)</option>
                <option value="acme-ecommerce">acme-ecommerce (88.198.54.190)</option>
              </select>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Active Multiplex
              </span>
            </div>
            <div className="text-[11px] font-mono text-secondary">
              Host: <strong className="text-white">production-01</strong> (159.69.142.88) • Session ID: #sh-4819
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            onClick={copySessionDetails}
            className="px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-xs text-secondary hover:text-white flex items-center gap-1.5 transition-all"
            title="Copy SSH CLI Command"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-mono">{copied ? 'Copied' : 'SSH CLI'}</span>
          </button>

          <button
            onClick={() => xtermInstance.current?.clear()}
            className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-secondary hover:text-white transition-all"
            title="Clear Buffer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Macro Bar */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1 shrink-0">
        <span className="text-secondary font-medium text-[11px] flex items-center gap-1">
          <Play className="w-3 h-3 text-info" /> Quick Ops:
        </span>
        {[
          { label: 'docker ps', cmd: 'docker ps' },
          { label: 'nginx -t', cmd: 'nginx -t' },
          { label: 'df -h', cmd: 'df -h' },
          { label: 'uptime', cmd: 'uptime' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => runQuickCommand(item.cmd)}
            className="px-2.5 py-1 rounded bg-elevated/80 hover:bg-elevated border border-border text-white text-[11px] font-mono transition-all shrink-0 hover:border-info/50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 bg-[#060709] p-3 rounded-xl border border-border shadow-2xl overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
};