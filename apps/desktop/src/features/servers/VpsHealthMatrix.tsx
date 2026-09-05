import React, { useState } from 'react';
import { 
  Server, Activity, ArrowUpRight, Smartphone, Monitor, Search
} from 'lucide-react';

interface VpsNodeHealth {
  id: string;
  alias: string;
  ip: string;
  os: string;
  uptime: string;
  riskScore: number; // 0-100
  cpuUtilizationPct: number;
  cores: number;
  loadAverage1m: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryPsiStallAvg10: number; // >15 is warning
  diskUsedGb: number;
  diskTotalGb: number;
  diskInodesUsedPct: number;
  tcpListenDrops: number;
  systemdFailedUnits: number;
  dockerContainersRunning: number;
  dockerContainersFailed: number;
  tlsCertDaysRemaining: number;
  status: 'nominal' | 'warning' | 'critical';
}

const NODES_DATA: VpsNodeHealth[] = [
  {
    id: 'srv_fra_01',
    alias: 'prod-fra-01',
    ip: '198.51.100.24',
    os: 'Ubuntu 24.04 LTS (Kernel 6.8)',
    uptime: '47 days, 8 hours',
    riskScore: 32,
    cpuUtilizationPct: 24.8,
    cores: 4,
    loadAverage1m: 0.98,
    memoryUsedMb: 4120,
    memoryTotalMb: 16384,
    memoryPsiStallAvg10: 2.1,
    diskUsedGb: 112,
    diskTotalGb: 250,
    diskInodesUsedPct: 28,
    tcpListenDrops: 0,
    systemdFailedUnits: 0,
    dockerContainersRunning: 8,
    dockerContainersFailed: 0,
    tlsCertDaysRemaining: 68,
    status: 'nominal',
  },
  {
    id: 'srv_lon_02',
    alias: 'staging-lon-02',
    ip: '203.0.113.88',
    os: 'Debian 12 Bookworm',
    uptime: '12 days, 2 hours',
    riskScore: 78,
    cpuUtilizationPct: 82.4,
    cores: 2,
    loadAverage1m: 3.42,
    memoryUsedMb: 7680,
    memoryTotalMb: 8192,
    memoryPsiStallAvg10: 18.4,
    diskUsedGb: 88,
    diskTotalGb: 100,
    diskInodesUsedPct: 89,
    tcpListenDrops: 14,
    systemdFailedUnits: 1,
    dockerContainersRunning: 5,
    dockerContainersFailed: 1,
    tlsCertDaysRemaining: 9,
    status: 'critical',
  },
  {
    id: 'srv_sgp_03',
    alias: 'edge-sgp-03',
    ip: '198.51.100.109',
    os: 'Ubuntu 22.04 LTS',
    uptime: '94 days, 18 hours',
    riskScore: 48,
    cpuUtilizationPct: 56.1,
    cores: 2,
    loadAverage1m: 1.62,
    memoryUsedMb: 3900,
    memoryTotalMb: 8192,
    memoryPsiStallAvg10: 6.2,
    diskUsedGb: 45,
    diskTotalGb: 120,
    diskInodesUsedPct: 34,
    tcpListenDrops: 2,
    systemdFailedUnits: 0,
    dockerContainersRunning: 4,
    dockerContainersFailed: 0,
    tlsCertDaysRemaining: 34,
    status: 'warning',
  },
];

export const VpsHealthMatrix: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'nominal'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedNode, setSelectedNode] = useState<VpsNodeHealth | null>(NODES_DATA[1]);

  const filteredNodes = NODES_DATA.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (searchQuery && !n.alias.toLowerCase().includes(searchQuery.toLowerCase()) && !n.ip.includes(searchQuery)) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                VPS Fleet Health & Deep Inspection Matrix
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  V3.0 Engine
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Continuous cgroups v2 PSI memory stalls, disk inode saturation, TCP socket drops, and systemd unit health across all nodes.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                viewMode === 'desktop' ? 'bg-info/20 text-info border-info' : 'bg-background border-border text-secondary'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop Grid</span>
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                viewMode === 'mobile' ? 'bg-info/20 text-info border-info' : 'bg-background border-border text-secondary'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Companion View</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder="Search by alias or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-secondary focus:outline-none focus:border-info"
            />
          </div>

          <div className="flex space-x-2 w-full md:w-auto">
            {(['all', 'critical', 'warning', 'nominal'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                  filterStatus === st
                    ? 'bg-elevated text-white border-border'
                    : 'bg-transparent text-secondary border-transparent hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Viewport: Desktop Table vs Mobile Cards */}
      {viewMode === 'desktop' ? (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse text-secondary">
            <thead>
              <tr className="border-b border-border text-white font-semibold">
                <th className="py-3 px-3">Node / Host</th>
                <th className="py-3 px-3">Risk Score</th>
                <th className="py-3 px-3">CPU / Load</th>
                <th className="py-3 px-3">Memory / PSI</th>
                <th className="py-3 px-3">Disk / Inodes</th>
                <th className="py-3 px-3">TCP Drops</th>
                <th className="py-3 px-3">Systemd</th>
                <th className="py-3 px-3">Containers</th>
                <th className="py-3 px-3">TLS Cert</th>
                <th className="py-3 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredNodes.map((node) => (
                <tr key={node.id} className="hover:bg-elevated/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        node.status === 'nominal' ? 'bg-emerald-400' : node.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400 animate-pulse'
                      }`} />
                      {node.alias}
                    </div>
                    <div className="text-[10px] text-secondary font-mono">{node.ip}</div>
                  </td>
                  <td className="py-3 px-3 font-bold font-mono">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                      node.riskScore > 70 ? 'bg-rose-500/20 text-rose-300' : node.riskScore > 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {node.riskScore} / 100
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-white font-mono">{node.cpuUtilizationPct}%</div>
                    <div className="text-[10px] text-secondary">Load: {node.loadAverage1m} ({node.cores}c)</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-white font-mono">{Math.round(node.memoryUsedMb / 1024 * 10) / 10} / {Math.round(node.memoryTotalMb / 1024)} GB</div>
                    <div className={`text-[10px] font-mono ${node.memoryPsiStallAvg10 > 15 ? 'text-rose-400 font-bold' : 'text-secondary'}`}>
                      PSI: {node.memoryPsiStallAvg10}%
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-white font-mono">{node.diskUsedGb} / {node.diskTotalGb} GB</div>
                    <div className="text-[10px] text-secondary">Inodes: {node.diskInodesUsedPct}%</div>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {node.tcpListenDrops > 0 ? (
                      <span className="text-rose-400 font-bold">+{node.tcpListenDrops}</span>
                    ) : (
                      <span className="text-secondary">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {node.systemdFailedUnits > 0 ? (
                      <span className="text-rose-400 font-bold">{node.systemdFailedUnits} failed</span>
                    ) : (
                      <span className="text-emerald-400">All Active</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-white">
                    {node.dockerContainersRunning} up
                    {node.dockerContainersFailed > 0 && <span className="text-rose-400 font-bold ml-1">({node.dockerContainersFailed} down)</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[11px] font-mono ${node.tlsCertDaysRemaining < 14 ? 'text-rose-400 font-bold' : 'text-secondary'}`}>
                      {node.tlsCertDaysRemaining} days
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedNode(node)}
                      className="px-2.5 py-1 bg-elevated hover:bg-hover border border-border rounded text-[11px] text-white transition-colors"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Mobile Companion Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className="p-5 bg-surface border border-border hover:border-info/40 rounded-xl transition-all cursor-pointer shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      node.status === 'nominal' ? 'bg-emerald-400' : node.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400 animate-pulse'
                    }`} />
                    {node.alias}
                  </div>
                  <div className="text-xs text-secondary font-mono">{node.ip}</div>
                </div>

                <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                  node.riskScore > 70 ? 'bg-rose-500/20 text-rose-300' : node.riskScore > 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  Risk {node.riskScore}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-secondary pt-1">
                <div>CPU: <span className="text-white">{node.cpuUtilizationPct}%</span></div>
                <div>RAM: <span className="text-white">{Math.round(node.memoryUsedMb / 1024 * 10) / 10}GB</span></div>
                <div>Disk: <span className="text-white">{node.diskUsedGb}GB</span></div>
                <div>TLS: <span className="text-white">{node.tlsCertDaysRemaining}d</span></div>
              </div>

              <div className="pt-2 border-t border-border flex justify-between items-center text-[11px] text-secondary">
                <span>{node.dockerContainersRunning} containers running</span>
                <span className="text-info font-bold flex items-center gap-1">
                  Inspect <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Node Deep Drill-Down Modal / Section */}
      {selectedNode && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-info" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Node Diagnostic Trace: {selectedNode.alias} ({selectedNode.ip})
                </h3>
                <span className="text-xs text-secondary">{selectedNode.os} • Uptime {selectedNode.uptime}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-secondary hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-background border border-border rounded-lg space-y-1.5">
              <span className="text-xs font-semibold text-secondary">Kernel Memory Pressure (PSI)</span>
              <div className="text-lg font-bold font-mono text-white">{selectedNode.memoryPsiStallAvg10}% stall</div>
              <p className="text-[11px] text-secondary">
                {selectedNode.memoryPsiStallAvg10 > 15
                  ? '⚠️ High stall rate detected. Linux kernel thrashing swap pages.'
                  : 'Nominal. No significant CPU cycles lost waiting on anonymous memory pages.'}
              </p>
            </div>

            <div className="p-4 bg-background border border-border rounded-lg space-y-1.5">
              <span className="text-xs font-semibold text-secondary">TCP Ingress Socket Health</span>
              <div className="text-lg font-bold font-mono text-white">
                {selectedNode.tcpListenDrops > 0 ? `${selectedNode.tcpListenDrops} Drops` : '0 Drops'}
              </div>
              <p className="text-[11px] text-secondary">
                {selectedNode.tcpListenDrops > 0
                  ? 'SYN backlog queue full in /proc/net/snmp. Inbound handshakes dropped.'
                  : 'Nominal. TCP accept queue has sufficient capacity for peak ingress traffic.'}
              </p>
            </div>

            <div className="p-4 bg-background border border-border rounded-lg space-y-1.5">
              <span className="text-xs font-semibold text-secondary">Storage Inodes & Sectors</span>
              <div className="text-lg font-bold font-mono text-white">{selectedNode.diskInodesUsedPct}% Inodes</div>
              <p className="text-[11px] text-secondary">
                {selectedNode.diskInodesUsedPct > 85
                  ? 'Critical inode exhaustion risk. Filesystem write failures imminent.'
                  : 'Nominal headroom across all root and data mount points.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
