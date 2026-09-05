import React, { useState } from 'react';
import { 
  Zap, AlertTriangle, Clock, RefreshCw,
  CheckCircle2, ArrowRight
} from 'lucide-react';

export const VpsDiagnostics: React.FC = () => {
  const [selectedTarget, setSelectedTarget] = useState<'api.example.com' | 'production-01'>('api.example.com');
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const runDiagnostic = () => {
    setIsDiagnosing(true);
    setTimeout(() => setIsDiagnosing(false), 800);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-info" /> Systems Diagnostic Intelligence
          </h1>
          <p className="text-xs text-secondary mt-1">
            Deep-dive performance decomposition, causal outage prediction, and configuration drift reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-elevated p-1 rounded-lg border border-border">
            <button 
              onClick={() => setSelectedTarget('api.example.com')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedTarget === 'api.example.com' ? 'bg-info text-white shadow' : 'text-secondary hover:text-white'}`}
            >
              api.example.com
            </button>
            <button 
              onClick={() => setSelectedTarget('production-01')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedTarget === 'production-01' ? 'bg-info text-white shadow' : 'text-secondary hover:text-white'}`}
            >
              Host: production-01
            </button>
          </div>

          <button 
            onClick={runDiagnostic}
            disabled={isDiagnosing}
            className="px-3.5 py-1.5 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            {isDiagnosing ? 'Probing Kernel...' : 'Run Full Diagnostic'}
          </button>
        </div>
      </div>

      {/* Latency Waterfall Analysis */}
      <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-white">End-to-End Latency Waterfall ({selectedTarget})</h2>
            <p className="text-xs text-secondary">Isolating execution latency across network and physical boundaries.</p>
          </div>
          <span className="text-xs font-mono font-bold text-danger bg-danger/10 px-2.5 py-1 rounded border border-danger/20">
            Total TTFB: 854ms (p99: 2.7s)
          </span>
        </div>

        <div className="space-y-3">
          {[
            { label: 'DNS Resolution', ms: 12, pct: 2, status: 'Healthy', note: 'Authoritative Cloudflare Anycast' },
            { label: 'TLS 1.3 Handshake', ms: 31, pct: 4, status: 'Healthy', note: 'Session tickets resumed' },
            { label: 'Nginx Ingress Overhead', ms: 4, pct: 1, status: 'Healthy', note: 'Fast socket handover' },
            { label: 'Node.js Backend Worker', ms: 183, pct: 21, status: 'Warning', note: 'Event-loop delay on /checkout' },
            { label: 'PostgreSQL Query Pool', ms: 142, pct: 17, status: 'Warning', note: '96% connection pool saturation' },
            { label: 'Redis L2 Cache Hit', ms: 2, pct: 1, status: 'Healthy', note: '0.8ms roundtrip' },
            { label: 'External Payment API Call', ms: 480, pct: 54, status: 'Critical', note: '🔴 Remote third-party HTTP lockup' },
          ].map((seg) => (
            <div key={seg.label} className="p-3 rounded-lg bg-background/60 border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="w-48 font-medium text-white">{seg.label}</div>
              <div className="flex-1 w-full max-w-md">
                <div className="flex justify-between text-[11px] text-secondary mb-1">
                  <span>{seg.ms} ms</span>
                  <span>{seg.pct}% of total</span>
                </div>
                <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${seg.status === 'Critical' ? 'bg-danger' : seg.status === 'Warning' ? 'bg-warning' : 'bg-emerald-400'}`} 
                    style={{ width: `${Math.max(seg.pct, 4)}%` }} 
                  />
                </div>
              </div>
              <div className="w-44 text-right text-secondary text-[11px] font-mono hidden sm:block">
                {seg.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* "What Changed?" Causality Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-info" /> "What Changed on Production Today?"
            </h2>
            <span className="text-[11px] font-mono text-secondary">Last 6 Hours</span>
          </div>
          <p className="text-xs text-secondary">
            Causal event correlation linking code releases and configuration drift to resource anomalies.
          </p>

          <div className="relative pl-6 border-l border-border/80 space-y-4 pt-2">
            {[
              { time: '18:42:10', type: 'incident', title: 'HTTP Latency Spike +380%', desc: 'api.example.com average response degraded from 180ms to 850ms.', bad: true },
              { time: '18:40:02', type: 'db', title: 'PostgreSQL Pool Saturated', desc: 'Active client connections reached 48/50 (96% limit).', bad: true },
              { time: '18:38:15', type: 'deploy', title: 'Deployment shop-api v1.8.3', desc: 'Git commit a81d921 rolled out by CI/CD pipeline.', bad: false },
              { time: '18:35:00', type: 'config', title: 'Nginx config reloaded', desc: 'proxy_read_timeout adjusted in /etc/nginx/sites-enabled/api.conf.', bad: false },
            ].map((event, idx) => (
              <div key={idx} className="relative">
                <span className={`absolute -left-[31px] top-0.5 w-3 h-3 rounded-full border-2 border-background ${event.bad ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-info'}`} />
                <div className="text-[11px] font-mono text-secondary">{event.time}</div>
                <div className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1.5">
                  {event.title}
                  {event.bad && <span className="text-[10px] text-danger font-bold uppercase">Root Cause</span>}
                </div>
                <p className="text-[11px] text-secondary mt-0.5">{event.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Predictive Stability & Blast Radius */}
        <div className="bg-surface/80 border border-border rounded-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> Blast Radius & Dependency Impact
              </h2>
              <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/20">
                1 Degradation Active
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Simulating failure cascades across upstream reverse proxies and persistence channels.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-background/70 border border-border/80 space-y-3">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span className="text-warning">⚠ Dependency Cascade:</span>
              </div>
              <div className="font-mono text-xs text-secondary flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-1 rounded bg-danger/20 text-danger border border-danger/30">External Payment API 🔴</span>
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="px-2 py-1 rounded bg-warning/20 text-warning border border-warning/30">shop-api Workers ⚠</span>
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="px-2 py-1 rounded bg-elevated text-white border border-border">api.example.com /checkout</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider">Recommended Automated Action</div>
              <div className="p-3.5 rounded-lg bg-elevated border border-border/80 text-xs space-y-2">
                <div className="font-semibold text-white">Circuit Breaker & Worker Rollback:</div>
                <p className="text-secondary text-[11px]">
                  Enabling fallback circuit breaker on checkout API will drop p99 latency back to 180ms immediately.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-all">
                    Enable Circuit Breaker
                  </button>
                  <button className="px-3 py-1 rounded bg-background hover:bg-elevated border border-border text-secondary text-[11px] font-medium transition-all">
                    View Runbook
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background/60 border border-border/60 text-xs flex items-center justify-between">
            <span className="text-secondary flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Host isolation verified
            </span>
            <span className="text-[11px] font-mono text-secondary">Zero daemon overhead on node</span>
          </div>
        </div>
      </div>
    </div>
  );
};