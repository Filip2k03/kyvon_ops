import React, { useState } from 'react';
import {
  Activity, Server, AlertTriangle, CheckCircle2, ShieldCheck,
  Cpu, HardDrive, Wifi, ArrowUpRight, Search,
  Terminal, ShieldAlert, Fingerprint,
  Layers, Clock, XCircle, Check
} from 'lucide-react';

// Types matching PROMPTS.md §§ 5-13
type MobileTab = 'home' | 'servers' | 'sites' | 'incidents' | 'logs' | 'approvals';

interface ApprovalItem {
  id: string;
  action: string;
  server: string;
  reason: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: string;
  requestedBy: 'Codex Astra' | 'Claude Opus' | 'Agy Gemini 3.8';
  status: 'pending' | 'approved' | 'rejected';
  biometricRequired: boolean;
}

export const MobileCompanionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedServerTab, setSelectedServerTab] = useState<'overview' | 'apps' | 'containers' | 'processes' | 'services' | 'logs' | 'security'>('overview');
  const [selectedSite, setSelectedSite] = useState<string>('api.example.com');
  const [selectedIncident, setSelectedIncident] = useState<string | null>('INC-8812');
  const [logFilter, setLogFilter] = useState<'all' | 'nginx' | 'docker' | 'systemd' | 'security'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState<string | null>(null);

  // Real-world operational state for mobile command center
  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    {
      id: 'APP-101',
      action: 'Restart Nginx Daemon',
      server: 'prod-fra-01',
      reason: 'Invalid configuration reload recovery after upstream proxy update',
      risk: 'LOW',
      impact: 'Zero-downtime worker reload (sub-10ms connection draining)',
      requestedBy: 'Claude Opus',
      status: 'pending',
      biometricRequired: false,
    },
    {
      id: 'APP-102',
      action: 'Rollback Deploy: shop-api v2.14.0 -> v2.13.9',
      server: 'prod-fra-01',
      reason: 'HTTP 502 error spike detected by Outage Risk Engine',
      risk: 'HIGH',
      impact: 'Switch traffic socket back to previous healthy container snapshot',
      requestedBy: 'Codex Astra',
      status: 'pending',
      biometricRequired: true,
    }
  ]);

  const handleApprove = (id: string, withBiometric = false) => {
    if (withBiometric) {
      setBiometricScanning(true);
      setTimeout(() => {
        setBiometricScanning(false);
        setBiometricSuccess(`Biometric verification verified for ${id}`);
        setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
        setTimeout(() => setBiometricSuccess(null), 3000);
      }, 1200);
    } else {
      setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    }
  };

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
  };

  return (
    <div className="max-w-md mx-auto bg-background text-primary min-h-[92vh] flex flex-col border border-border rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Header Bar (§6 PROMPTS.md) */}
      <div className="bg-surface/90 backdrop-blur-md border-b border-border p-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold tracking-tight text-white text-sm">KYVONOPS</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-secondary font-mono">
            COMPANION V3.0
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2FA ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Biometric Scan Toast Overlay */}
      {biometricScanning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="p-6 bg-surface border border-cyan-500/40 rounded-2xl max-w-xs w-full shadow-2xl flex flex-col items-center animate-pulse">
            <Fingerprint className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">Authenticating Biometrics</h3>
            <p className="text-xs text-secondary mb-4">Touch ID / Face ID / Android Keystore Signature</p>
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <div className="bg-cyan-400 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {biometricSuccess && (
        <div className="p-3 mx-4 mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{biometricSuccess}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {/* TAB 1: MOBILE HOME (§6) */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Overall Health Score Card */}
            <div className="bg-gradient-to-br from-surface to-elevated border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Infrastructure Health</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  NOMINAL
                </span>
              </div>
              <div className="flex items-baseline space-x-3">
                <span className="text-4xl font-extrabold text-white">92</span>
                <span className="text-lg font-medium text-secondary">/ 100</span>
              </div>
              <p className="text-xs text-secondary mt-1">
                Zero critical outages across fleet. Memory PSI headroom safe.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Servers Card */}
              <div 
                onClick={() => setActiveTab('servers')}
                className="bg-surface border border-border hover:border-info/40 rounded-xl p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-xs font-medium">Servers</span>
                  <Server className="w-3.5 h-3.5 text-info" />
                </div>
                <div className="text-xl font-bold text-white">12</div>
                <div className="flex items-center space-x-2 text-[10px] mt-1">
                  <span className="text-emerald-400 font-medium">10 Healthy</span>
                  <span className="text-amber-400 font-medium">1 Warn</span>
                  <span className="text-rose-400 font-medium">1 Crit</span>
                </div>
              </div>

              {/* Sites Card */}
              <div 
                onClick={() => setActiveTab('sites')}
                className="bg-surface border border-border hover:border-info/40 rounded-xl p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-xs font-medium">Sites & Apps</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-xl font-bold text-white">84</div>
                <div className="flex items-center space-x-2 text-[10px] mt-1">
                  <span className="text-emerald-400 font-medium">81 Up</span>
                  <span className="text-amber-400 font-medium">2 Warn</span>
                  <span className="text-rose-400 font-medium">1 Down</span>
                </div>
              </div>

              {/* Deployments Card */}
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-xs font-medium">Deployments</span>
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xl font-bold text-white">26</div>
                <div className="text-[10px] text-secondary mt-1">Last: shop-api 4m ago</div>
              </div>

              {/* Incidents Card */}
              <div 
                onClick={() => setActiveTab('incidents')}
                className="bg-surface border border-rose-500/30 hover:border-rose-500/60 rounded-xl p-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-xs font-medium">Incidents</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xl font-bold text-rose-400">2 Active</div>
                <div className="text-[10px] text-secondary mt-1">1 Critical, 1 Warning</div>
              </div>
            </div>

            {/* Real Resource Attribution Telemetry (§6 PROMPTS.md) */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Fleet Saturation Metrics</h3>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-info" /> Fleet CPU Load
                    </span>
                    <span className="font-semibold text-white">41.8%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5">
                    <div className="bg-info h-1.5 rounded-full" style={{ width: '41.8%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-purple-400" /> Allocated RAM
                    </span>
                    <span className="font-semibold text-white">58.4%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5">
                    <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: '58.4%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" /> Storage Capacity
                    </span>
                    <span className="font-semibold text-white">68.2%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5">
                    <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '68.2%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Network Ingress
                    </span>
                    <span className="font-semibold text-white">8.2 MB/s</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5">
                    <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: '28%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Approvals Callout (§13 PROMPTS.md) */}
            {approvals.filter(a => a.status === 'pending').length > 0 && (
              <div 
                onClick={() => setActiveTab('approvals')}
                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {approvals.filter(a => a.status === 'pending').length} Approvals Pending
                    </div>
                    <div className="text-[10px] text-amber-300">Action requested by Codex Astra, Claude Opus, or Agy Gemini 3.8</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MOBILE SERVER VIEW & VPS INVENTORY (§7 & §8) */}
        {activeTab === 'servers' && (
          <div className="space-y-4">
            {/* Server Header Card */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-white">production-01</h2>
                  <p className="text-[11px] font-mono text-secondary">198.51.100.24 • Frankfurt (FRA1)</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> HEALTHY
                </span>
              </div>

              {/* Metrics strip */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/60 text-center">
                <div>
                  <div className="text-[10px] text-secondary">CPU</div>
                  <div className="text-xs font-bold text-white">62%</div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary">RAM</div>
                  <div className="text-xs font-bold text-white">71%</div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary">Load 1m</div>
                  <div className="text-xs font-bold text-white">2.31</div>
                </div>
                <div>
                  <div className="text-[10px] text-secondary">Uptime</div>
                  <div className="text-xs font-bold text-white">47d</div>
                </div>
              </div>
            </div>

            {/* Mobile Server Sub-Tabs (§7 PROMPTS.md) */}
            <div className="flex overflow-x-auto space-x-1.5 pb-1 text-xs scrollbar-none">
              {(['overview', 'apps', 'containers', 'processes', 'services', 'logs', 'security'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedServerTab(tab)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-medium transition-colors ${
                    selectedServerTab === tab
                      ? 'bg-info text-white'
                      : 'bg-surface border border-border text-secondary hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Sub-tab 1: Overview & VPS Inventory (§8 PROMPTS.md) */}
            {selectedServerTab === 'overview' && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Hardware & System Inventory</h3>
                <div className="divide-y divide-border/50 text-xs">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">Operating System</span>
                    <span className="text-white font-mono">Ubuntu 24.04 LTS</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">Linux Kernel</span>
                    <span className="text-white font-mono">6.8.0-31-generic</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">Architecture</span>
                    <span className="text-white font-mono">x86_64 (KVM)</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">Memory / Swap</span>
                    <span className="text-white font-mono">16 GB / 4 GB (0% swap used)</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">Cloud / Provider</span>
                    <span className="text-white font-mono">Hetzner Cloud (fsn1)</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-secondary">IPv6 Subnet</span>
                    <span className="text-white font-mono">2a01:4f8:c012:abcd::1/64</span>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-white uppercase tracking-wider pt-2">Detected Software Stack</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['Nginx 1.26', 'Docker 27.0', 'PostgreSQL 16.3', 'Redis 7.2', 'Node.js 20.14', 'Python 3.12', 'systemd 255'].map(tech => (
                    <span key={tech} className="px-2 py-0.5 rounded bg-background border border-border text-[11px] text-secondary font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-tab 2: Containers */}
            {selectedServerTab === 'containers' && (
              <div className="space-y-2">
                {[
                  { name: 'shop-api', image: 'node:20-alpine', cpu: '12.4%', mem: '380MB', state: 'Up 4d' },
                  { name: 'shop-web', image: 'nginx:alpine', cpu: '1.8%', mem: '45MB', state: 'Up 12d' },
                  { name: 'postgres-16', image: 'postgres:16-alpine', cpu: '8.2%', mem: '1.2GB', state: 'Up 47d' },
                  { name: 'redis-cache', image: 'redis:7-alpine', cpu: '0.4%', mem: '120MB', state: 'Up 47d' },
                ].map(c => (
                  <div key={c.name} className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {c.name}
                      </div>
                      <div className="text-[10px] text-secondary font-mono">{c.image} • {c.state}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-white font-mono">{c.cpu}</div>
                      <div className="text-[10px] text-secondary font-mono">{c.mem}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SITES & APPLICATIONS DISCOVERY (§9 & §10) */}
        {activeTab === 'sites' && (
          <div className="space-y-4">
            {/* Site selector tabs */}
            <div className="flex space-x-2">
              {['api.example.com', 'website.example.com', 'admin.example.com'].map(site => (
                <button
                  key={site}
                  onClick={() => setSelectedSite(site)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono truncate transition-colors ${
                    selectedSite === site
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-surface border border-border text-secondary'
                  }`}
                >
                  {site}
                </button>
              ))}
            </div>

            {/* Site Detail (§10 PROMPTS.md) */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">{selectedSite}</h3>
                  <p className="text-[11px] text-secondary">Cloudflare Full Strict TLS • Origin 198.51.100.24:3000</p>
                </div>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> ONLINE
                </span>
              </div>

              {/* Six Health Checks (§10 PROMPTS.md) */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-secondary text-[10px]">HTTP</div>
                  <div className="text-emerald-400 font-bold">✓ 200 OK</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-secondary text-[10px]">TLS</div>
                  <div className="text-emerald-400 font-bold">✓ 1.3 Strict</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-secondary text-[10px]">DNS</div>
                  <div className="text-emerald-400 font-bold">✓ Proxied</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-secondary text-[10px]">Nginx</div>
                  <div className="text-emerald-400 font-bold">✓ Healthy</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-amber-400 font-bold">⚠ Slow p95</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-secondary text-[10px]">Database</div>
                  <div className="text-emerald-400 font-bold">✓ 12 conns</div>
                </div>
              </div>

              {/* Latency & Error Metrics (§10 PROMPTS.md) */}
              <div className="pt-2 border-t border-border/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-secondary">Throughput Rate:</span>
                  <span className="text-white font-mono">1,480 req/min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Latency (p50 / p95 / p99):</span>
                  <span className="text-white font-mono">18ms / 92ms / 340ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">4xx Client Errors:</span>
                  <span className="text-emerald-400 font-mono">0.08% (nominal)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">5xx Server Errors:</span>
                  <span className="text-emerald-400 font-mono">0.00% (zero)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MOBILE INCIDENTS (§12) */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {/* Incident 1 */}
              <div 
                onClick={() => setSelectedIncident('INC-8812')}
                className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  selectedIncident === 'INC-8812'
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : 'bg-surface border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    🔴 Kernel Memory PSI Stall Spike
                  </span>
                  <span className="text-[10px] text-secondary flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 4m ago
                  </span>
                </div>
                <p className="text-xs text-secondary">Server: staging-lon-02 • Outage Risk Score: 78/100</p>
              </div>

              {/* Incident 2 */}
              <div 
                onClick={() => setSelectedIncident('INC-8813')}
                className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  selectedIncident === 'INC-8813'
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-surface border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    🟡 Disk Inode Pressure Approaching Limit
                  </span>
                  <span className="text-[10px] text-secondary flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 2h ago
                  </span>
                </div>
                <p className="text-xs text-secondary">Server: edge-sgp-03 • Outage Risk Score: 48/100</p>
              </div>
            </div>

            {/* Incident Root Cause & Evidence Detail (§12 PROMPTS.md) */}
            {selectedIncident === 'INC-8812' && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Incident Root Cause & Evidence</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                    IMPACT: HIGH
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-secondary block mb-0.5">Affected Target:</span>
                    <span className="font-mono text-white">staging-lon-02 (api.staging.internal)</span>
                  </div>
                  <div>
                    <span className="text-secondary block mb-0.5">Diagnosed Root Cause:</span>
                    <span className="text-rose-200">
                      Cgroup v2 memory.pressure stall duration spiked above 24% for 120s due to unindexed SQL query batch in worker container.
                    </span>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 border border-border space-y-1 font-mono text-[11px]">
                    <div className="text-secondary">Telemetry Corroboration:</div>
                    <div className="text-rose-400">• PSI memory stall avg10: 24.2% (+380% vs baseline)</div>
                    <div className="text-amber-400">• Database connections: 98/100 (+42% saturation)</div>
                    <div className="text-white">• Page cache drop attempts: 14/sec</div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={() => handleApprove('APP-102', true)}
                    className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    Biometric Rollback
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MOBILE STREAMING LOG CENTER (§11) */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            {/* Search & Filter Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-secondary" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={e => setLogSearchQuery(e.target.value)}
                placeholder="Search streaming logs (status, IP, path)..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-secondary focus:outline-none focus:border-info"
              />
            </div>

            {/* Filter tags */}
            <div className="flex space-x-1.5 overflow-x-auto text-[11px] scrollbar-none">
              {(['all', 'nginx', 'docker', 'systemd', 'security'] as const).map(flt => (
                <button
                  key={flt}
                  onClick={() => setLogFilter(flt)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    logFilter === flt
                      ? 'bg-info text-white'
                      : 'bg-surface border border-border text-secondary'
                  }`}
                >
                  {flt.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Streaming Log Viewer Window */}
            <div className="bg-black/90 border border-border/80 rounded-xl p-3 font-mono text-[11px] leading-relaxed space-y-1.5 h-72 overflow-y-auto">
              <div className="text-secondary border-b border-border/40 pb-1 flex justify-between text-[10px]">
                <span>STREAM: /var/log/nginx/access.log + docker</span>
                <span className="text-emerald-400">PAGINATED (50/4800)</span>
              </div>
              <div className="text-emerald-400">
                198.51.100.24 - [05/Sep/2026:22:30:12] "GET /healthz HTTP/2.0" 200 14 "KyvonAgent/3.0"
              </div>
              <div className="text-cyan-300">
                172.67.182.42 - [05/Sep/2026:22:30:14] "POST /api/v1/auth HTTP/2.0" 200 48 "KyvonCompanion/iOS"
              </div>
              <div className="text-amber-400">
                shop-api: [WARN] (cgroup memory) working_set_bytes: 382MB approaching 400MB threshold
              </div>
              <div className="text-emerald-400">
                198.51.100.24 - [05/Sep/2026:22:30:18] "GET /api/sites HTTP/2.0" 200 812 "Claude-Code/1.0"
              </div>
              <div className="text-rose-400">
                systemd[1]: Unit shop-worker-2.service entered failed state. (SIGTERM exit 143)
              </div>
              <div className="text-secondary">
                systemd[1]: shop-worker-2.service: Scheduled restart job, restart counter is at 1.
              </div>
              <div className="text-emerald-400">
                cloudflared[841]: Connection 4f8a-9e7b established to FRA edge tunnel socket.
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MOBILE APPROVAL CENTER (§13) */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Human-In-The-Loop Approval Gates</h2>
              <span className="text-[10px] text-secondary">PROMPTS.md §13</span>
            </div>

            {approvals.map(approval => (
              <div 
                key={approval.id} 
                className={`bg-surface border rounded-xl p-4 space-y-3 transition-colors ${
                  approval.status === 'approved'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : approval.status === 'rejected'
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    approval.risk === 'HIGH' || approval.risk === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-info/20 text-info border border-info/30'
                  }`}>
                    {approval.risk} RISK
                  </span>
                  <span className="text-[11px] text-secondary font-mono">{approval.server}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">{approval.action}</h3>
                  <p className="text-xs text-secondary mt-1">{approval.reason}</p>
                </div>

                <div className="bg-background rounded-lg p-2.5 border border-border text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-secondary">Requested by:</span>
                    <span className="font-semibold text-white">{approval.requestedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Expected Impact:</span>
                    <span className="text-secondary">{approval.impact}</span>
                  </div>
                </div>

                {approval.status === 'pending' ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleReject(approval.id)}
                      className="flex-1 py-2 rounded-lg bg-background border border-border hover:bg-elevated text-secondary text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      Reject
                    </button>
                    {approval.biometricRequired ? (
                      <button
                        onClick={() => handleApprove(approval.id, true)}
                        className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        Approve (Biometric)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(approval.id, false)}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-1.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    {approval.status === 'approved' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Approved & Executed
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Rejected by Operator
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Ergonomic Navigation Bar (§5 & §6 PROMPTS.md) */}
      <div className="bg-surface/95 backdrop-blur-md border-t border-border p-1.5 sticky bottom-0 left-0 right-0 z-20">
        <div className="grid grid-cols-6 gap-1 text-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === 'home' ? 'text-info bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('servers')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === 'servers' ? 'text-info bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Servers</span>
          </button>

          <button
            onClick={() => setActiveTab('sites')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === 'sites' ? 'text-info bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Sites</span>
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'incidents' ? 'text-rose-400 bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Incidents</span>
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500" />
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === 'logs' ? 'text-info bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-2 rounded-lg flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'approvals' ? 'text-amber-400 bg-elevated' : 'text-secondary hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] mt-1 font-medium">Approvals</span>
            {approvals.filter(a => a.status === 'pending').length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
