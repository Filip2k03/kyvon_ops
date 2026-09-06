import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Network, RefreshCw, Server, Boxes, Settings, HardDrive, Activity } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Backend, hasBackend, type Loaded } from '../../lib/backend';
import { LoadedFallback, NoDataState } from '../../components/ui/NoDataState';
import type { ServerProfile } from '../../types';
import { useTelemetry } from '../../lib/useTelemetry';

/** A topology assembled from the selected user's VPS discovery results. */
export const DigitalTwinExplorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<Loaded<ServerProfile[]> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setResult(await Backend.listServers());
    setBusy(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const servers = result?.state === 'ok' ? result.data : [];
  const selected = servers.find((server) => server.id === searchParams.get('server')) ?? servers[0] ?? null;
  const live = useTelemetry(selected?.id ?? null);
  const connected = useMemo(() => selected ? live.lastFrameAt !== null : false, [live.lastFrameAt, selected]);
  const facts = selected?.facts ?? null;

  const discovered = facts ? [
    { label: facts.os_name || facts.os_id || 'Operating system', detail: `${facts.arch} · kernel ${facts.kernel}`, icon: Server },
    facts.capabilities.systemd ? { label: 'systemd', detail: 'Detected during host probe', icon: Settings } : null,
    facts.capabilities.docker ? { label: 'Docker', detail: 'Detected during host probe', icon: Boxes } : null,
    { label: 'Storage and network', detail: 'Inspect live samples in their dedicated views', icon: HardDrive },
  ].filter(Boolean) as Array<{ label: string; detail: string; icon: typeof Server }> : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5"><Network className="w-6 h-6 text-info" /> Digital Twin</h1>
          <p className="text-xs text-secondary mt-1">A topology assembled from the selected VPS discovery results.</p>
        </div>
        <button onClick={() => void load()} disabled={!hasBackend() || busy} className="px-3 py-2 rounded-lg bg-elevated border border-border text-secondary hover:text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {result === null ? <NoDataState variant="empty" title="Reading VPS inventory…" detail="Querying the local installation." /> : <LoadedFallback result={result} />}

      {result?.state === 'ok' && !selected && (
        <NoDataState variant="empty" title="Connect a VPS to build its digital twin" detail="KyvonOPS does not ship sample servers or an imaginary topology. Add a VPS, connect it, and run discovery." />
      )}

      {selected && (
        <>
          <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.alias}</h2>
                <p className="text-xs text-secondary font-mono mt-1">{selected.username}@{selected.hostname}:{selected.port}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${connected ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-secondary bg-elevated border-border'}`}>
                {connected ? 'Connected' : 'Waiting for live telemetry'}
              </span>
            </div>
            {!facts ? (
              <NoDataState variant="empty" title="Discovery has not completed" detail="Connect this VPS and run capability discovery before a topology can be shown." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discovered.map(({ label, detail, icon: Icon }) => (
                  <div key={label} className="rounded-lg border border-border/70 bg-background/50 p-4 flex items-start gap-3">
                    <Icon className="w-4 h-4 text-info mt-0.5" />
                    <div><p className="text-sm font-semibold text-white">{label}</p><p className="text-xs text-secondary mt-1">{detail}</p></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-info" /> Live signals</h2>
            {live.lastFrameAt ? (
              <p className="text-xs text-secondary mt-3">Telemetry last measured {new Date(live.lastFrameAt).toLocaleString()}. Open Command Center, Services, Docker, or Logs for measured details.</p>
            ) : (
              <p className="text-xs text-secondary mt-3">No live telemetry is available yet. Connect the VPS and start a collector to populate this view.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};
