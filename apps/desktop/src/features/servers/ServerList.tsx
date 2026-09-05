import React, { useState } from 'react';
import { 
  Server, Plus, Terminal, RefreshCw, Trash2, 
  Zap, Cpu, HardDrive, Wifi
} from 'lucide-react';
import { AddServerDialog, NewServerData } from './AddServerDialog';
import { useNavigate } from 'react-router-dom';

interface ServerItem {
  id: string;
  alias: string;
  hostname: string;
  port: number;
  username: string;
  os: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'connecting';
  cpuUsage: number;
  ramUsage: number;
  pingMs: number;
  tag: string;
}

export const ServerList: React.FC = () => {
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [servers, setServers] = useState<ServerItem[]>([
    {
      id: 'srv-prod-01',
      alias: 'production-01',
      hostname: '159.69.142.88',
      port: 22,
      username: 'root',
      os: 'Ubuntu 24.04 LTS (Noble)',
      provider: 'Hetzner Cloud',
      status: 'connected',
      cpuUsage: 72,
      ramUsage: 68,
      pingMs: 24,
      tag: 'production',
    },
    {
      id: 'srv-stage-01',
      alias: 'staging-west',
      hostname: '194.195.240.12',
      port: 2222,
      username: 'deploy',
      os: 'Debian 12 (Bookworm)',
      provider: 'OVHcloud',
      status: 'disconnected',
      cpuUsage: 14,
      ramUsage: 32,
      pingMs: 48,
      tag: 'staging',
    },
    {
      id: 'srv-client-acme',
      alias: 'acme-ecommerce',
      hostname: '88.198.54.190',
      port: 22,
      username: 'admin',
      os: 'Rocky Linux 9.4',
      provider: 'Hetzner Dedicated',
      status: 'connected',
      cpuUsage: 41,
      ramUsage: 55,
      pingMs: 18,
      tag: 'client-work',
    },
  ]);

  const handleAddServer = (data: NewServerData) => {
    const newServer: ServerItem = {
      id: `srv-${Date.now().toString(36)}`,
      alias: data.alias,
      hostname: data.hostname,
      port: data.port,
      username: data.username,
      os: 'Linux (Probing...)',
      provider: 'Custom Cloud / VPS',
      status: 'connecting',
      cpuUsage: 0,
      ramUsage: 0,
      pingMs: 15,
      tag: data.tag,
    };

    setServers((prev) => [newServer, ...prev]);

    // Simulate probe resolving in 1.2s
    setTimeout(() => {
      setServers((prev) =>
        prev.map((s) =>
          s.id === newServer.id
            ? { ...s, status: 'connected', os: 'Ubuntu 24.04 LTS', cpuUsage: 28, ramUsage: 45 }
            : s
        )
      );
    }, 1200);
  };

  const toggleConnection = (id: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextStatus = s.status === 'connected' ? 'disconnected' : 'connected';
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  const deleteServer = (id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Server className="w-6 h-6 text-info" /> Fleet Inventory & Host Nodes
          </h1>
          <p className="text-xs text-secondary mt-1">
            Local SQLite inventory with encrypted keychain vault credentials and multiplexed SSH transports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Add Server
          </button>
        </div>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((server) => (
          <div
            key={server.id}
            className="bg-surface/90 border border-border/80 hover:border-border rounded-xl p-5 shadow-xl transition-all space-y-4 relative overflow-hidden group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-elevated border border-border flex items-center justify-center text-info">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    {server.alias}
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-elevated text-secondary border border-border/60">
                      {server.tag}
                    </span>
                  </h3>
                  <div className="text-[11px] font-mono text-secondary mt-0.5">
                    {server.username}@{server.hostname}:{server.port}
                  </div>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                  server.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : server.status === 'connecting'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    server.status === 'connected' ? 'bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                {server.status === 'connected'
                  ? 'Connected'
                  : server.status === 'connecting'
                  ? 'Probing...'
                  : 'Disconnected'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/60 text-xs space-y-2">
              <div className="flex justify-between items-center text-secondary">
                <span>OS & Kernel</span>
                <span className="text-white font-medium text-[11px]">{server.os}</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span>Cloud Provider</span>
                <span className="text-white font-medium text-[11px]">{server.provider}</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span>SSH Roundtrip Latency</span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> {server.pingMs} ms
                </span>
              </div>
            </div>

            {/* Load summary if connected */}
            {server.status === 'connected' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-elevated/50 border border-border/40">
                  <div className="text-[10px] text-secondary flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> CPU Load
                  </div>
                  <div className="font-bold text-white mt-0.5 font-mono">{server.cpuUsage}%</div>
                </div>
                <div className="p-2 rounded bg-elevated/50 border border-border/40">
                  <div className="text-[10px] text-secondary flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> Memory
                  </div>
                  <div className="font-bold text-white mt-0.5 font-mono">{server.ramUsage}%</div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleConnection(server.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                    server.status === 'connected'
                      ? 'bg-elevated hover:bg-danger/10 text-secondary hover:text-danger border-border'
                      : 'bg-info hover:bg-info/90 text-white border-transparent'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {server.status === 'connected' ? 'Disconnect' : 'Connect'}
                </button>

                <button
                  onClick={() => navigate('/terminal')}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-white border border-border"
                  title="Open Shell Terminal"
                >
                  <Terminal className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/diagnostics')}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-white border border-border"
                  title="Diagnostics & Causal Graph"
                >
                  <Zap className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => deleteServer(server.id)}
                className="p-1.5 rounded-lg hover:bg-danger/20 text-secondary hover:text-danger transition-colors"
                title="Remove Server"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AddServerDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleAddServer}
      />
    </div>
  );
};