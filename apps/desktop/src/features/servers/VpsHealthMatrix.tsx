import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Server, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Backend, hasBackend } from '../../lib/backend';
import { formatBytes, useTelemetry } from '../../lib/useTelemetry';
import { useCollector, useSelectedServer } from '../../lib/useSelectedServer';
import { NoDataState } from '../../components/ui/NoDataState';

/** Live VPS health view. It never renders fixture nodes or invented metrics. */
export const VpsHealthMatrix: React.FC = () => {
  const { servers, selected, selectedId, select } = useSelectedServer();
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const liveId = selectedId && connected.has(selectedId) ? selectedId : null;
  const collectorError = useCollector(liveId);
  const live = useTelemetry(liveId);

  useEffect(() => {
    let active = true;
    if (!hasBackend()) return;
    void Backend.connectedServers().then((result) => {
      if (active && result.state === 'ok') setConnected(new Set(result.data));
    });
    return () => { active = false; };
  }, [selectedId]);

  const memoryPct = live.memory && live.memory.total_bytes > 0 ? (live.memory.used_bytes / live.memory.total_bytes) * 100 : null;
  const disk = live.disk?.filesystems ?? [];
  const diskSummary = useMemo(() => {
    if (!disk.length) return null;
    const total = disk.reduce((sum, fs) => sum + fs.total_bytes, 0);
    const used = disk.reduce((sum, fs) => sum + fs.used_bytes, 0);
    return { total, used, pct: total > 0 ? (used / total) * 100 : null };
  }, [disk]);

  if (!hasBackend()) return <NoDataState variant="unavailable" title="VPS health needs the desktop app" detail="The browser build has no SSH transport and cannot read system information." action={<Link to="/downloads" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">Open downloads</Link>} />;
  if (servers?.state === 'failed') return <NoDataState variant="failed" title="Could not load VPS inventory" detail={servers.detail} action={<Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">Open servers</Link>} />;
  if (!selected || !selectedId) return <NoDataState variant="empty" title="Connect a VPS to view system information" detail="KyvonOPS does not show host metrics or operating-system facts until a server is connected." action={<Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">Connect VPS</Link>} />;
  if (!liveId) return <NoDataState variant="empty" title="VPS is not connected" detail={`${selected.alias} is configured locally, but no live SSH session is open. Connect it from Servers to read real system information.`} action={<Link to={`/servers?server=${encodeURIComponent(selectedId)}`} className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">Open connection</Link>} />;

  const facts = selected.facts;
  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400"><Server className="h-6 w-6" aria-hidden="true" /></div><div><h1 className="text-xl font-bold text-white">VPS system information</h1><p className="text-xs text-secondary">Live SSH session · {selected.username}@{selected.hostname}:{selected.port}</p></div></div>
          <select aria-label="Connected VPS" value={selectedId} onChange={(event) => select(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-xs text-white">{(servers?.state === 'ok' ? servers.data : []).filter((server) => connected.has(server.id)).map((server) => <option key={server.id} value={server.id}>{server.alias}</option>)}</select>
        </div>
        {collectorError && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" role="alert">{collectorError}</p>}
        {live.stoppedReason && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">Telemetry stopped: {live.stoppedReason}</p>}
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Live VPS resources">
        <Metric icon={Cpu} label="CPU" value={live.cpu ? `${live.cpu.total.toFixed(1)}%` : null} detail={live.cpu ? `${live.cpu.cores.length} cores · load ${live.cpu.load[0].toFixed(2)}` : 'Waiting for telemetry'} />
        <Metric icon={MemoryStick} label="Memory" value={memoryPct === null ? null : `${memoryPct.toFixed(1)}%`} detail={live.memory ? `${formatBytes(live.memory.used_bytes)} of ${formatBytes(live.memory.total_bytes)}` : 'Waiting for telemetry'} />
        <Metric icon={HardDrive} label="Disk" value={diskSummary?.pct == null ? null : `${diskSummary.pct.toFixed(1)}%`} detail={diskSummary ? `${formatBytes(diskSummary.used)} of ${formatBytes(diskSummary.total)}` : 'Waiting for telemetry'} />
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-info" aria-hidden="true" />Host facts</h2>{facts ? <dl className="grid grid-cols-2 gap-3 text-xs"><Fact label="Hostname" value={facts.hostname} /><Fact label="OS" value={`${facts.os_name} ${facts.os_version}`} /><Fact label="Kernel" value={facts.kernel} /><Fact label="Architecture" value={facts.arch} /><Fact label="CPU cores" value={String(facts.cpu_cores)} /><Fact label="Uptime" value={`${Math.floor(facts.uptime_secs / 3600)}h`} /></dl> : <p className="text-xs text-secondary">Host discovery has not completed for this connected VPS.</p>}</div>
        <div className="rounded-xl border border-border bg-surface p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><ShieldAlert className="h-4 w-4 text-info" aria-hidden="true" />Capabilities</h2>{facts ? <div className="grid grid-cols-2 gap-3 text-xs">{Object.entries(facts.capabilities).map(([name, available]) => <div key={name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"><span className="capitalize text-secondary">{name}</span><span className={available ? 'text-emerald-400' : 'text-secondary'}>{available ? 'Detected' : 'Unavailable'}</span></div>)}</div> : <p className="text-xs text-secondary">Capabilities appear after a successful host probe.</p>}</div>
      </section>
      <p className="text-[11px] text-secondary">{live.lastFrameAt ? `Last measured ${new Date(live.lastFrameAt).toLocaleTimeString()}.` : 'Waiting for the first measured sample.'} Values come directly from the selected VPS over SSH.</p>
    </div>
  );
};

const Metric: React.FC<{ icon: typeof Cpu; label: string; value: string | null; detail: string }> = ({ icon: Icon, label, value, detail }) => <div className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between text-xs text-secondary"><span>{label}</span><Icon className="h-4 w-4 text-info" aria-hidden="true" /></div><div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value ?? 'Not measured'}</div><p className="mt-1 text-[11px] text-secondary">{detail}</p></div>;
const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => <div><dt className="text-secondary">{label}</dt><dd className="mt-1 break-words font-mono text-white">{value || 'Unavailable'}</dd></div>;
