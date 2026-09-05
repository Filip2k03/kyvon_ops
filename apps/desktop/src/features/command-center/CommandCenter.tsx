import React, { useCallback, useEffect, useState } from 'react';
import { Server, Shield, Activity, RefreshCw, Plus, Cpu, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Backend, hasBackend, runtimeName, type Loaded } from '../../lib/backend';
import { LoadedFallback, NoDataState } from '../../components/ui/NoDataState';
import type { ServerProfile } from '../../types';

/**
 * The screen that answers PROMPTS.md §122: is my infrastructure healthy, what
 * is consuming resources, what is affected, what changed, what next.
 *
 * It can only answer those from measurements. Health, capacity, risk and
 * change history all come from telemetry and the causal graph, and none of
 * those pipelines is connected to the UI yet — so this screen reports what the
 * inventory really contains and names the rest as not yet collected.
 *
 * The previous version of this file answered all five questions with invented
 * values (a hostname, a public IP, an uptime, a 87/100 security score). That
 * is precisely the failure §108 exists to prevent, and it is worse than an
 * empty screen: an operator cannot tell a fabricated reading from a real one.
 */

/** A panel that exists in the product but has no data path wired yet. */
const PendingSignal: React.FC<{ icon: typeof Cpu; label: string; source: string }> = ({
  icon: Icon,
  label,
  source,
}) => (
  <div className="bg-background/60 p-3.5 rounded-lg border border-border/50">
    <div className="text-xs text-secondary font-medium flex items-center justify-between">
      <span>{label}</span>
      <Icon className="w-3.5 h-3.5 text-secondary/60" />
    </div>
    <div className="mt-1.5 text-sm font-semibold text-secondary/70 italic">Not collected</div>
    <div className="mt-0.5 text-[10px] text-secondary/60 leading-snug">{source}</div>
  </div>
);

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<Loaded<ServerProfile[]> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setResult(await Backend.listServers());
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const servers = result?.state === 'ok' ? result.data : [];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-surface/80 border border-border/80 backdrop-blur-md rounded-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-info/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center text-info shadow-inner">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Command Center</h1>
              <p className="text-xs text-secondary mt-1">
                {hasBackend()
                  ? `${servers.length} host${servers.length === 1 ? '' : 's'} in the local inventory.`
                  : 'Running as a web build — no SSH transport, no keychain, no local database.'}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-secondary/70">
                  runtime: {runtimeName()}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={() => void load()}
            disabled={!hasBackend() || busy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-xs font-medium text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-secondary ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/*
          These four are the product's headline signals. They are rendered as
          explicitly uncollected rather than omitted, so the gap between what
          KyvonOPS promises and what it currently measures stays visible.
        */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-6 pt-6 border-t border-border/60">
          <PendingSignal icon={Cpu} label="Resource utilization" source="kyvon-telemetry over SSH" />
          <PendingSignal icon={Layers} label="Capacity headroom" source="kyvon-diagnostics::capacity" />
          <PendingSignal icon={Activity} label="Operational risk" source="kyvon-diagnostics::outage_risk" />
          <PendingSignal icon={Shield} label="Security posture" source="passive security scan" />
        </div>
      </div>

      {result === null ? (
        <NoDataState variant="empty" title="Reading local inventory…" detail="Querying the local SQLite store." />
      ) : (
        <LoadedFallback result={result} />
      )}

      {result?.state === 'ok' &&
        (servers.length === 0 ? (
          <NoDataState
            variant="empty"
            title="No hosts configured"
            detail="KyvonOPS has nothing to report until a server is added. Connection details are stored locally; the password or key passphrase goes to your OS keychain."
            action={
              <button
                onClick={() => navigate('/servers')}
                className="px-3.5 py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add a server
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => navigate('/servers')}
                className="text-left bg-surface/90 border border-border/80 hover:border-border rounded-xl p-5 shadow-xl transition-all"
              >
                <h3 className="font-bold text-sm text-white">{server.alias}</h3>
                <div className="text-[11px] font-mono text-secondary mt-1">
                  {server.username}@{server.hostname}:{server.port}
                </div>
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-secondary/70 italic">
                  Health not measured — telemetry not connected
                </div>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
};
