import React, { useState } from 'react';
import { 
  Server, Shield, AlertTriangle, CheckCircle2, 
  Clock, ArrowUpRight, Zap, RefreshCw, GitCommit,
  Bot, Check, X, Layers
} from 'lucide-react';

export const CommandCenter: React.FC = () => {
  const [selectedSite, setSelectedSite] = useState<'api.example.com' | 'example.com' | 'admin.example.com'>('api.example.com');
  const [mcpApproved, setMcpApproved] = useState<boolean | null>(null);
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>('shop-api');

  return (
    <div className="space-y-6 pb-12">
      {/* 1. VPS Digital Twin Identity Banner */}
      <div className="bg-surface/80 border border-border/80 backdrop-blur-md rounded-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-info/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center text-info shadow-inner">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">production-01</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Digital Twin Synced
                </span>
                <span className="text-xs text-secondary font-mono bg-elevated px-2 py-0.5 rounded border border-border">Hetzner Cloud (Falkenstein)</span>
              </div>
              <p className="text-xs text-secondary mt-1 flex items-center gap-4">
                <span><strong>OS:</strong> Ubuntu 24.04 LTS (Noble)</span>
                <span><strong>Kernel:</strong> Linux 6.8.0-31-generic</span>
                <span><strong>Arch:</strong> x86_64</span>
                <span><strong>Uptime:</strong> 47d 12h 18m</span>
                <span><strong>Public IP:</strong> 159.69.142.88</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right pr-3 border-r border-border hidden sm:block">
              <div className="text-xs text-secondary">Security Posture</div>
              <div className="text-sm font-semibold text-emerald-400 flex items-center justify-end gap-1">
                <Shield className="w-3.5 h-3.5" /> 87/100 (Hardened)
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-xs font-medium text-white transition-all shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 text-secondary" /> Refresh Probe
            </button>
          </div>
        </div>

        {/* Quick Spec Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/60">
          <div className="bg-background/60 p-3.5 rounded-lg border border-border/50">
            <div className="text-xs text-secondary font-medium flex items-center justify-between">
              <span>CPU Allocation</span>
              <span className="font-mono text-white">8 vCPU</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">72.4%</div>
            <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-warning h-full rounded-full" style={{ width: '72%' }} />
            </div>
          </div>

          <div className="bg-background/60 p-3.5 rounded-lg border border-border/50">
            <div className="text-xs text-secondary font-medium flex items-center justify-between">
              <span>Memory (RAM)</span>
              <span className="font-mono text-white">32.0 GB</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">21.8 GB <span className="text-xs font-normal text-secondary">(68%)</span></div>
            <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-info h-full rounded-full" style={{ width: '68%' }} />
            </div>
          </div>

          <div className="bg-background/60 p-3.5 rounded-lg border border-border/50">
            <div className="text-xs text-secondary font-medium flex items-center justify-between">
              <span>NVMe Storage</span>
              <span className="font-mono text-white">240 GB</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">168 GB <span className="text-xs font-normal text-secondary">(70%)</span></div>
            <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '70%' }} />
            </div>
          </div>

          <div className="bg-background/60 p-3.5 rounded-lg border border-border/50">
            <div className="text-xs text-secondary font-medium flex items-center justify-between">
              <span>Swap Space</span>
              <span className="font-mono text-white">4.0 GB</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">0.4 GB <span className="text-xs font-normal text-secondary">(10%)</span></div>
            <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '10%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI / MCP Operations Live Approval Alert */}
      <div className="bg-gradient-to-r from-purple-950/40 via-surface to-surface border border-purple-500/30 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">MCP Agent Operation Pending Authorization</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                Risk: High
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              <strong>Claude Opus / Codex Astra</strong> invoked <code className="text-purple-300 font-mono">kyvon_deploy(shop-api, v1.8.4)</code> via stdio token. Zero SSH keys exposed.
            </p>
          </div>
        </div>

        {mcpApproved === null ? (
          <div className="flex items-center gap-2 self-end md:self-center">
            <button 
              onClick={() => setMcpApproved(false)}
              className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-danger/20 border border-border hover:border-danger/40 text-xs font-medium text-secondary hover:text-danger flex items-center gap-1.5 transition-all"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
            <button 
              onClick={() => setMcpApproved(true)}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md"
            >
              <Check className="w-3.5 h-3.5" /> Authorize Execution
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border">
            {mcpApproved ? (
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Authorized & Logged to Audit Trail</span>
            ) : (
              <span className="text-danger flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Operation Declined by Operator</span>
            )}
          </div>
        )}
      </div>

      {/* 3. The Core Superpower: "Where Is My VPS Going?" Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-info" /> Resource Attribution ("Where Is My VPS Going?")
              </h2>
              <p className="text-xs text-secondary mt-0.5">Direct causal breakdown connecting raw CPU/RAM to business sites and containers.</p>
            </div>
            <span className="text-xs font-mono font-bold text-warning bg-warning/10 px-2.5 py-1 rounded border border-warning/20">
              Total CPU: 72%
            </span>
          </div>

          {/* Segmented Ownership Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded-full bg-elevated flex overflow-hidden p-0.5 border border-border/80">
              <div className="bg-info h-full rounded-l-full transition-all" style={{ width: '51%' }} title="Applications: 51%" />
              <div className="bg-purple-500 h-full transition-all" style={{ width: '11%' }} title="Databases: 11%" />
              <div className="bg-sky-400 h-full transition-all" style={{ width: '7%' }} title="Docker: 7%" />
              <div className="bg-emerald-400 h-full transition-all" style={{ width: '2%' }} title="Nginx: 2%" />
              <div className="bg-zinc-500 h-full rounded-r-full transition-all" style={{ width: '1%' }} title="System: 1%" />
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-secondary pt-1">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-info" /> Applications: <strong>51%</strong></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Databases: <strong>11%</strong></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Docker: <strong>7%</strong></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Nginx: <strong>2%</strong></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-500" /> System: <strong>1%</strong></div>
            </div>
          </div>

          {/* Drilldown Consumers List */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-secondary">Top CPU Consumers (Click to inspect causal chain)</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'shop-api', cpu: '21%', ram: '1.8 GB', container: 'shop-api-prod', pid: 18342, image: 'registry.acme/shop:1.8.3', site: 'api.example.com', runtime: 'Node.js 22' },
                { name: 'wordpress', cpu: '18%', ram: '620 MB', container: 'wp-app', pid: 19231, image: 'wordpress:6.6-fpm', site: 'example.com', runtime: 'PHP 8.3' },
                { name: 'postgres', cpu: '9%', ram: '2.4 GB', container: 'pg-16', pid: 2010, image: 'postgres:16.2', site: 'Internal DB', runtime: 'PostgreSQL' },
                { name: 'worker', cpu: '7%', ram: '410 MB', container: 'shop-worker', pid: 2115, image: 'registry.acme/worker:1.8.3', site: 'Queue Service', runtime: 'Python 3.12' },
              ].map((c) => (
                <div 
                  key={c.name}
                  onClick={() => setActiveDrilldown(c.name)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${activeDrilldown === c.name ? 'bg-elevated border-info/60 shadow-md ring-1 ring-info/30' : 'bg-background/50 border-border hover:bg-elevated/40'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm text-white">{c.name}</span>
                    <span className="font-mono text-xs font-bold text-info">{c.cpu} CPU</span>
                  </div>
                  <div className="text-xs text-secondary mt-1 flex items-center justify-between">
                    <span>{c.runtime} • {c.ram}</span>
                    <span className="text-[11px] text-white/70">{c.site}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Drilldown Causal Chain */}
          {activeDrilldown && (
            <div className="p-4 rounded-xl bg-elevated/60 border border-border/80 text-xs space-y-2">
              <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                <span>Causal Chain for <strong>{activeDrilldown}</strong>:</span>
              </div>
              <div className="font-mono text-[11px] text-secondary flex flex-wrap items-center gap-2">
                <span className="text-info font-bold">Domain: api.example.com</span>
                <span>→</span>
                <span className="text-emerald-400">Nginx: /etc/nginx/sites-enabled/api.conf</span>
                <span>→</span>
                <span className="text-sky-300">Proxy: 127.0.0.1:3000</span>
                <span>→</span>
                <span className="text-purple-300">Container: shop-api-prod</span>
                <span>→</span>
                <span className="text-amber-300">PID: 18342</span>
                <span>→</span>
                <span className="text-white">Git: commit a81d921</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Outage Risk Score & Capacity Saturation Radar */}
        <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" /> Outage Risk Engine
              </h2>
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30">
                High Risk
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">18-vector predictive saturation & stability engine.</p>

            {/* Score Ring / Radial representation */}
            <div className="mt-5 p-4 rounded-xl bg-background/60 border border-border/60 text-center">
              <div className="text-3xl font-extrabold text-danger tracking-tight">82 <span className="text-sm font-normal text-secondary">/ 100</span></div>
              <div className="text-xs font-semibold text-white mt-1">Operational Outage Probability</div>
              <p className="text-[11px] text-secondary mt-1">Imminent disk exhaustion & database connection growth detected.</p>
            </div>

            {/* Risk Factor Breakdown */}
            <div className="space-y-2 mt-4">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider">Top Risk Factors</div>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center p-2 rounded bg-elevated/40 border border-border/40">
                  <span className="text-secondary">CPU Saturation (5m loadavg)</span>
                  <span className="font-mono font-bold text-warning">+18 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-elevated/40 border border-border/40">
                  <span className="text-secondary">RAM Pressure (Available &lt; 15%)</span>
                  <span className="font-mono font-bold text-warning">+14 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-elevated/40 border border-border/40">
                  <span className="text-secondary">Database Connection Pool Saturation</span>
                  <span className="font-mono font-bold text-danger">+15 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-elevated/40 border border-border/40">
                  <span className="text-secondary">Disk Fill Rate Projected Ceiling</span>
                  <span className="font-mono font-bold text-info">+8 pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Predictive Capacity Saturation */}
          <div className="p-3.5 rounded-lg bg-background/80 border border-border/80 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-info" /> Capacity Saturation Forecast
              </span>
              <span className="font-bold text-amber-400 font-mono">~5.2 days</span>
            </div>
            <p className="text-[11px] text-secondary">
              At current write rate (+2.4GB/day), root volume saturation estimated in <strong>5.2 days</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* 5. "Why Is This Site Slow?" Diagnostic Investigator */}
      <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-info" /> "Why Is This Site Slow?" Diagnostic Inspector
            </h2>
            <p className="text-xs text-secondary mt-0.5">End-to-end latency decomposition identifying bottleneck micro-layers.</p>
          </div>

          <div className="flex items-center gap-2 bg-elevated p-1 rounded-lg border border-border">
            {(['api.example.com', 'example.com', 'admin.example.com'] as const).map((site) => (
              <button
                key={site}
                onClick={() => setSelectedSite(site)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${selectedSite === site ? 'bg-info text-white shadow' : 'text-secondary hover:text-white'}`}
              >
                {site}
              </button>
            ))}
          </div>
        </div>

        {/* Latency Waterfall Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
          {[
            { stage: 'DNS Lookup', latency: '12ms', status: 'healthy' },
            { stage: 'TLS Handshake', latency: '31ms', status: 'healthy' },
            { stage: 'Nginx Proxy', latency: '4ms', status: 'healthy' },
            { stage: 'Backend App', latency: '183ms', status: 'warning' },
            { stage: 'PostgreSQL', latency: '142ms', status: 'warning' },
            { stage: 'Redis Cache', latency: '2ms', status: 'healthy' },
            { stage: 'External API', latency: '480ms', status: 'critical' },
          ].map((item) => (
            <div 
              key={item.stage} 
              className={`p-3.5 rounded-lg border ${item.status === 'critical' ? 'bg-danger/10 border-danger/40' : item.status === 'warning' ? 'bg-warning/10 border-warning/30' : 'bg-background/60 border-border/60'}`}
            >
              <div className="text-[11px] text-secondary font-medium">{item.stage}</div>
              <div className={`text-lg font-bold mt-1 ${item.status === 'critical' ? 'text-danger' : item.status === 'warning' ? 'text-warning' : 'text-white'}`}>
                {item.latency}
              </div>
              <div className="text-[10px] mt-1 uppercase font-semibold text-secondary">
                {item.status === 'critical' ? '🔴 Bottleneck' : item.status === 'warning' ? '⚠ Elevated' : '✓ Normal'}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-elevated/40 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <div className="text-white font-semibold flex items-center gap-1.5">
              <span>Primary Latency Bottleneck:</span>
              <span className="text-danger font-mono font-bold">External Payment API Gateway (480ms avg, p99: 2.7s)</span>
            </div>
            <p className="text-secondary text-[11px]">
              Outgoing requests to payment vendor are blocking Node.js event loop workers on <code className="text-purple-300">/api/v1/checkout</code>.
            </p>
          </div>
          <button className="px-3.5 py-1.5 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow">
            Inspect Full Trace <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6. Deployments & Git History Intelligence */}
      <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GitCommit className="w-5 h-5 text-info" /> Deployment Intelligence & Causality
            </h2>
            <p className="text-xs text-secondary mt-0.5">Tracking code revisions directly to runtime container and memory changes.</p>
          </div>
          <span className="text-xs font-semibold text-secondary">3 Active Workloads</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 text-secondary font-medium">
                <th className="pb-3">Application</th>
                <th className="pb-3">Environment</th>
                <th className="pb-3">Version</th>
                <th className="pb-3">Git Commit</th>
                <th className="pb-3">Deployed</th>
                <th className="pb-3">CPU / RAM</th>
                <th className="pb-3">Error Rate</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr>
                <td className="py-3 font-semibold text-white">shop-api</td>
                <td className="py-3 text-secondary">Production</td>
                <td className="py-3 font-mono font-bold text-info">v1.8.3</td>
                <td className="py-3 font-mono text-purple-300 flex items-center gap-1"><GitCommit className="w-3 h-3" /> a81d921</td>
                <td className="py-3 text-secondary">2h 14m ago</td>
                <td className="py-3 text-white font-mono">21% / 1.8 GB</td>
                <td className="py-3 text-emerald-400 font-mono">0.2%</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">● Healthy</span></td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-white">website</td>
                <td className="py-3 text-secondary">Production</td>
                <td className="py-3 font-mono font-bold text-info">v4.2.1</td>
                <td className="py-3 font-mono text-purple-300 flex items-center gap-1"><GitCommit className="w-3 h-3" /> c49b102</td>
                <td className="py-3 text-secondary">1d 4h ago</td>
                <td className="py-3 text-white font-mono">18% / 620 MB</td>
                <td className="py-3 text-emerald-400 font-mono">0.1%</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">● Healthy</span></td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-white">worker</td>
                <td className="py-3 text-secondary">Production</td>
                <td className="py-3 font-mono font-bold text-warning">v7.1.4</td>
                <td className="py-3 font-mono text-purple-300 flex items-center gap-1"><GitCommit className="w-3 h-3" /> e93f112</td>
                <td className="py-3 text-secondary">5h 20m ago</td>
                <td className="py-3 text-white font-mono">7% / 410 MB</td>
                <td className="py-3 text-warning font-mono">1.8%</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">⚠ Warning</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};