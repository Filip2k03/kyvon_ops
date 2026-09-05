import React, { useState } from 'react';
import {
  Network, Server, Cpu, HardDrive, Zap,
  Layers, Clock, ShieldCheck, Box,
  Database, Radio
} from 'lucide-react';

interface DependencyNode {
  id: string;
  label: string;
  type: 'edge' | 'proxy' | 'app' | 'cache' | 'database' | 'worker';
  status: 'healthy' | 'warning' | 'degraded';
  detail: string;
  metric: string;
}

export const DigitalTwinExplorer: React.FC = () => {
  const [selectedServer, setSelectedServer] = useState<'prod-fra-01' | 'staging-lon-02'>('prod-fra-01');
  const [simulatedFailure, setSimulatedFailure] = useState<string | null>(null);
  const [forecastHorizon, setForecastHorizon] = useState<'+1h' | '+6h' | '+24h' | '+7d'>('+24h');

  // Digital Twin Dependency Graph Nodes (§33 & §34 PROMPTS.md)
  const graphNodes: DependencyNode[] = [
    {
      id: 'cloudflare',
      label: 'Cloudflare Edge (FRA)',
      type: 'edge',
      status: 'healthy',
      detail: 'Anycast DNS • Full Strict TLS • Bot Fight Active',
      metric: 'p95: 14ms',
    },
    {
      id: 'nginx',
      label: 'Nginx Ingress (v1.26)',
      type: 'proxy',
      status: 'healthy',
      detail: 'Worker keepalive: 32 • Proxy buffer: 16k',
      metric: '1,420 req/s',
    },
    {
      id: 'shop-api',
      label: 'shop-api (Docker Node 20)',
      type: 'app',
      status: simulatedFailure === 'redis' ? 'warning' : 'healthy',
      detail: 'Up 47d • Cgroup RSS: 380MB / 512MB limit',
      metric: 'CPU: 12.4%',
    },
    {
      id: 'redis',
      label: 'Redis Cache (v7.2)',
      type: 'cache',
      status: simulatedFailure === 'redis' ? 'degraded' : 'healthy',
      detail: 'Port 6379 • In-memory cache & pub/sub channel',
      metric: 'Conn: 14 / 500',
    },
    {
      id: 'postgres',
      label: 'PostgreSQL 16 (Primary)',
      type: 'database',
      status: 'healthy',
      detail: 'Active pool: 18 / 100 • Transaction rate: 240 tps',
      metric: 'I/O: 1.2 MB/s',
    },
    {
      id: 'worker',
      label: 'Background Queue Worker',
      type: 'worker',
      status: simulatedFailure === 'redis' ? 'degraded' : 'healthy',
      detail: 'systemd: shop-worker.service • 4 concurrency threads',
      metric: 'Jobs: 42/min',
    },
  ];

  // Outage Risk Contributors Breakdown (§31 PROMPTS.md)
  const riskScore = selectedServer === 'prod-fra-01' ? 32 : 78;
  const riskContributors = selectedServer === 'prod-fra-01'
    ? [
        { name: 'Cgroup Memory PSI Stall (avg10: 2.1%)', points: 8, severity: 'safe' },
        { name: 'Database Connection Pool Saturation (18%)', points: 6, severity: 'safe' },
        { name: 'TCP Socket SYN Backlog (0 drops)', points: 4, severity: 'safe' },
        { name: 'Disk Inode Utilization (28% used)', points: 7, severity: 'safe' },
        { name: 'TLS Certificate Lifetime (68 days remaining)', points: 7, severity: 'safe' },
      ]
    : [
        { name: 'Cgroup v2 Memory PSI Stall Spike (24.2%)', points: 28, severity: 'critical' },
        { name: 'Database Connections Approaching Cap (98/100)', points: 22, severity: 'critical' },
        { name: 'Application Latency p95 Degradation (+380%)', points: 14, severity: 'warning' },
        { name: 'Disk I/O Wait Bottleneck (8.4% iowait)', points: 9, severity: 'warning' },
        { name: 'Container Crashloop Event (Worker exited 143)', points: 5, severity: 'warning' },
      ];

  // Capacity Timeline Forecast (§32 PROMPTS.md)
  const forecastData = {
    '+1h': { cpu: '44.2%', ram: '61.0%', risk: 34, confidence: '94%' },
    '+6h': { cpu: '52.8%', ram: '66.4%', risk: 41, confidence: '88%' },
    '+24h': { cpu: '64.1%', ram: '72.8%', risk: 49, confidence: '82%' },
    '+7d': { cpu: '78.5%', ram: '84.2%', risk: 62, confidence: '71%' },
  };

  const currentForecast = forecastData[forecastHorizon];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 sm:p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 shrink-0">
              <Network className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex flex-wrap items-center gap-2">
                Server Digital Twin & Risk
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  PROMPTS.md §§30-34
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-secondary">
                Internal graph model synthesizing reverse proxies, containers, databases, blast radiuses, and capacity forecasts.
              </p>
            </div>
          </div>

          {/* Server Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedServer('prod-fra-01')}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${
                selectedServer === 'prod-fra-01'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-background border border-border text-secondary hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>prod-fra-01 (Nominal)</span>
            </button>
            <button
              onClick={() => setSelectedServer('staging-lon-02')}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${
                selectedServer === 'staging-lon-02'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-background border border-border text-secondary hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>staging-lon-02 (Elevated)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Twin Topology Graph & Blast Radius Simulator (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Digital Twin Topology Card */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Live Digital Twin Topology Graph (§33)
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSimulatedFailure(simulatedFailure === 'redis' ? null : 'redis')}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    simulatedFailure === 'redis'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold'
                      : 'bg-background border-border text-secondary hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{simulatedFailure === 'redis' ? 'Reset Failure Simulation' : 'Simulate Redis Outage'}</span>
                </button>
              </div>
            </div>

            {/* Blast Radius Warning Toast (§34) */}
            {simulatedFailure === 'redis' && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  SIMULATED BLAST RADIUS CASCADE (§34 PROMPTS.md):
                </div>
                <div>
                  • <strong>Background Queue Worker:</strong> Job consumption halted (connection refused).<br />
                  • <strong>shop-api:</strong> Session lookups falling back to slow Postgres disk queries (+240ms latency).<br />
                  • <strong>Checkout Endpoint:</strong> Risk of intermittent 504 timeouts.
                </div>
              </div>
            )}

            {/* Topology Flow Graph */}
            <div className="space-y-3 pt-2">
              {graphNodes.map((node, index) => (
                <div key={node.id} className="relative">
                  <div className={`p-4 rounded-xl border transition-all ${
                    node.status === 'degraded'
                      ? 'bg-rose-500/10 border-rose-500/50'
                      : node.status === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-background border-border hover:border-border/80'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 rounded-lg bg-surface border border-border">
                          {node.type === 'edge' && <Radio className="w-4 h-4 text-amber-400" />}
                          {node.type === 'proxy' && <Network className="w-4 h-4 text-cyan-400" />}
                          {node.type === 'app' && <Box className="w-4 h-4 text-indigo-400" />}
                          {node.type === 'cache' && <Zap className="w-4 h-4 text-rose-400" />}
                          {node.type === 'database' && <Database className="w-4 h-4 text-blue-400" />}
                          {node.type === 'worker' && <Cpu className="w-4 h-4 text-purple-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            {node.label}
                            {node.status === 'degraded' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                                DEGRADED
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-secondary">{node.detail}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-white px-2 py-0.5 rounded bg-surface border border-border">
                          {node.metric}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  {index < graphNodes.length - 1 && (
                    <div className="w-0.5 h-3 bg-border mx-auto my-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Outage Risk Score & Saturation Forecasting (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Outage Risk Score Card (§31) */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Operational Outage Risk (§31)
              </h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                riskScore > 60
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {riskScore > 60 ? 'HIGH RISK' : 'HEALTHY'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-secondary tracking-wider">Composite Risk Index</div>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-4xl font-extrabold text-white font-mono">{riskScore}</span>
                  <span className="text-xs text-secondary">/ 100</span>
                </div>
              </div>
              <div className="text-right text-xs space-y-1">
                <div className="text-secondary">Risk Band:</div>
                <div className={`font-bold ${riskScore > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {riskScore <= 20 && '0-20: Healthy'}
                  {riskScore > 20 && riskScore <= 40 && '21-40: Low Risk'}
                  {riskScore > 40 && riskScore <= 60 && '41-60: Moderate'}
                  {riskScore > 60 && riskScore <= 80 && '61-80: High Risk'}
                  {riskScore > 80 && '81-100: Critical'}
                </div>
              </div>
            </div>

            {/* Risk Contributors Decomposition (§31 PROMPTS.md) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Score Decomposition</h3>
              <div className="divide-y divide-border/60 text-xs">
                {riskContributors.map(item => (
                  <div key={item.name} className="py-2 flex items-center justify-between">
                    <span className="text-secondary pr-2 truncate">{item.name}</span>
                    <span className={`font-mono font-bold shrink-0 ${
                      item.severity === 'critical'
                        ? 'text-rose-400'
                        : item.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      +{item.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Telemetry Saturation Forecasting (§32) */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Capacity Saturation Forecast (§32)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                Model: ARIMA+PSI
              </span>
            </div>

            {/* Time Horizon Selector */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['+1h', '+6h', '+24h', '+7d'] as const).map(horizon => (
                <button
                  key={horizon}
                  onClick={() => setForecastHorizon(horizon)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    forecastHorizon === horizon
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-background border border-border text-secondary hover:text-white'
                  }`}
                >
                  {horizon}
                </button>
              ))}
            </div>

            {/* Forecast Projection Metrics */}
            <div className="p-4 rounded-xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-info" /> Projected CPU Load
                </span>
                <span className="font-mono font-bold text-white">{currentForecast.cpu}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Projected Working Set RAM
                </span>
                <span className="font-mono font-bold text-white">{currentForecast.ram}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Forecasted Risk Score
                </span>
                <span className="font-mono font-bold text-amber-400">{currentForecast.risk} / 100</span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="text-secondary">Forecast Confidence:</span>
                <span className="font-bold text-emerald-400 font-mono">{currentForecast.confidence}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border/80 text-[11px] text-secondary leading-relaxed">
              <strong>Invariant (§32):</strong> Telemetry projections are probability-weighted extrapolations from kernel counters. Never treated as guaranteed events without live evidence.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
