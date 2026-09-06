import React, { useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Search } from 'lucide-react';
import { HostHeader, hostGate } from '../../components/ui/HostHeader';
import { NoDataState } from '../../components/ui/NoDataState';
import { formatBytes, useTelemetry } from '../../lib/useTelemetry';
import { useCollector, useSelectedServer } from '../../lib/useSelectedServer';
import {
  formatUptime,
  PROCESS_STATE_LABEL,
  processStateKind,
  sortProcesses,
  type ProcessSortKey,
} from '../../lib/hostViews';

/**
 * The host's process table, from `ps -eo pid,ppid,user,pcpu,pmem,rss,stat,etimes,args`
 * shipped every third collector tick and parsed on this side.
 *
 * Two rules from the telemetry design show up here. The collector sends the
 * top 60 consumers, not every process, so the header says "60 of 214" rather
 * than implying the list is complete. And command lines have already been
 * through secret redaction in Rust, so a `--password=` argument arrives as
 * `[REDACTED]` and is never on this screen to begin with.
 *
 * There is deliberately no kill button. Ending a process is a write, and
 * writes go through the typed, risk-classified path — not a click on a row.
 */

const COLUMNS: Array<{ key: ProcessSortKey; label: string; align: 'left' | 'right' }> = [
  { key: 'pid', label: 'PID', align: 'right' },
  { key: 'cpu_pct', label: 'CPU %', align: 'right' },
  { key: 'mem_pct', label: 'MEM %', align: 'right' },
  { key: 'rss_bytes', label: 'RSS', align: 'right' },
  { key: 'uptime_secs', label: 'Elapsed', align: 'right' },
];

export const ProcessExplorer: React.FC = () => {
  const { servers, selectedId, select } = useSelectedServer();
  const collectorError = useCollector(selectedId);
  const live = useTelemetry(selectedId);

  const [sortKey, setSortKey] = useState<ProcessSortKey>('cpu_pct');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (!live.processes) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? live.processes.processes.filter(
          (p) => p.command.toLowerCase().includes(q) || p.user.toLowerCase().includes(q) || String(p.pid) === q,
        )
      : live.processes.processes;
    return sortProcesses(filtered, sortKey, direction);
  }, [live.processes, query, sortKey, direction]);

  const blocked = live.processes?.processes.filter((p) => processStateKind(p.state) === 'blocked').length ?? 0;
  const zombies = live.processes?.processes.filter((p) => processStateKind(p.state) === 'zombie').length ?? 0;

  const toggleSort = (key: ProcessSortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection(key === 'pid' ? 'asc' : 'desc');
    }
  };

  const gate = hostGate('The process explorer', servers, collectorError);

  return (
    <div className="flex h-full flex-col gap-4 pb-8">
      <HostHeader
        icon={Activity}
        title="Processes"
        subtitle={
          live.processes
            ? `Top ${live.processes.processes.length} of ${live.processes.total} processes by CPU · sampled every 3 s`
            : 'Top consumers from ps, parsed on this workstation'
        }
        servers={servers}
        selectedId={selectedId}
        onSelect={select}
        trailing={
          live.processes && (
            <div className="flex items-center gap-1.5 text-[11px]">
              {blocked > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400" title={PROCESS_STATE_LABEL.blocked.hint}>
                  {blocked} in D
                </span>
              )}
              {zombies > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-400" title={PROCESS_STATE_LABEL.zombie.hint}>
                  {zombies} zombie{zombies === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )
        }
      />

      {gate}

      {!gate && live.stoppedReason && (
        <NoDataState variant="failed" title="Telemetry stopped" detail={live.stoppedReason} />
      )}

      {!gate && live.errors.processes && (
        <NoDataState
          variant="failed"
          title="The process list could not be read"
          detail={`${live.errors.processes}. The host's ps output did not match the expected columns; the raw sample was discarded rather than shown partially.`}
        />
      )}

      {!gate && !live.processes && !live.errors.processes && !live.stoppedReason && (
        <NoDataState
          variant="empty"
          title="Waiting for the first process sample"
          detail="The collector ships the process table every third tick. If nothing arrives within a few seconds, the SSH session may not be established — check the server list."
        />
      )}

      {!gate && live.processes && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-secondary" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by command, user or PID"
              aria-label="Filter processes"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-secondary/60 focus:border-info/50 focus:outline-none"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-surface/80">
            <div className="max-h-[calc(100vh-18rem)] overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 text-secondary backdrop-blur">
                  <tr>
                    {COLUMNS.slice(0, 1).map((c) => (
                      <SortHeader key={c.key} column={c} active={sortKey} direction={direction} onClick={toggleSort} />
                    ))}
                    <th className="p-3 font-medium">User</th>
                    <th className="p-3 font-medium">State</th>
                    {COLUMNS.slice(1).map((c) => (
                      <SortHeader key={c.key} column={c} active={sortKey} direction={direction} onClick={toggleSort} />
                    ))}
                    <th className="p-3 font-medium">Command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-secondary">
                        No process in this sample matches “{query}”.
                      </td>
                    </tr>
                  )}
                  {rows.map((p) => {
                    const kind = processStateKind(p.state);
                    const st = PROCESS_STATE_LABEL[kind];
                    return (
                      <tr key={p.pid} className="transition-colors hover:bg-elevated/40">
                        <td className="p-3 text-right font-mono tabular-nums text-white">
                          {p.pid}
                          {p.ppid > 0 && <span className="ml-1 text-[10px] text-secondary/60">←{p.ppid}</span>}
                        </td>
                        <td className="p-3 font-mono text-secondary">{p.user}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex min-w-[1.5rem] justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${st.tone}`}
                            title={`${p.state} — ${st.hint}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-white">{p.cpu_pct.toFixed(1)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-white">{p.mem_pct.toFixed(1)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-secondary">{formatBytes(p.rss_bytes)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-secondary">{formatUptime(p.uptime_secs)}</td>
                        <td className="max-w-md truncate p-3 font-mono text-secondary" title={p.command}>
                          {p.command}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SortHeader: React.FC<{
  column: { key: ProcessSortKey; label: string; align: 'left' | 'right' };
  active: ProcessSortKey;
  direction: 'asc' | 'desc';
  onClick: (key: ProcessSortKey) => void;
}> = ({ column, active, direction, onClick }) => {
  const isActive = column.key === active;
  return (
    <th
      className={`p-0 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onClick(column.key)}
        className={`inline-flex w-full items-center gap-1 p-3 hover:text-white ${column.align === 'right' ? 'justify-end' : ''} ${isActive ? 'text-white' : ''}`}
      >
        {column.label}
        {isActive && (direction === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
      </button>
    </th>
  );
};
