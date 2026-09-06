import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Play, RefreshCw, Search, ShieldAlert, Square } from 'lucide-react';
import { Backend, hasBackend, type Loaded, type ServiceAction } from '../../lib/backend';
import { HostHeader } from '../../components/ui/HostHeader';
import { NoDataState } from '../../components/ui/NoDataState';
import { useSelectedServer } from '../../lib/useSelectedServer';
import type { RiskAssessment, RiskTier, ServiceInfo } from '../../types';

/**
 * systemd units via `list_services` / `start_service` / `stop_service`.
 *
 * Listing is a read. Start and stop are writes: the UI asks
 * `assess_service_action` first, shows the exact command and its risk tier,
 * and only then calls the mutating command. There is no unauthenticated kill
 * or restart shortcut.
 */

type FilterTab = 'all' | 'running' | 'failed' | 'inactive';

const TIER_BADGE: Record<RiskTier, string> = {
  safe: 'bg-emerald-500/10 text-emerald-400',
  low: 'bg-info/10 text-info',
  medium: 'bg-amber-500/10 text-amber-400',
  high: 'bg-orange-500/10 text-orange-400',
  critical: 'bg-rose-500/10 text-rose-400',
};

export const ServiceManager: React.FC = () => {
  const { servers, selectedId, selected, select } = useSelectedServer();
  const [services, setServices] = useState<Loaded<ServiceInfo[]> | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [pending, setPending] = useState<{ action: ServiceAction; unit: string } | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setRefreshing(true);
    setServices(await Backend.listServices(id));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (selectedId) void load(selectedId);
    else setServices(null);
  }, [selectedId, load]);

  const initiate = async (action: ServiceAction, unit: string) => {
    setPending({ action, unit });
    setAssessment(null);
    setMutationError(null);
    setAssessing(true);
    const res = await Backend.assessServiceAction(action, unit);
    setAssessing(false);
    if (res.state === 'ok') setAssessment(res.data);
    else setMutationError(res.detail);
  };

  const confirm = async () => {
    if (!pending || !selectedId) return;
    setExecuting(true);
    setMutationError(null);
    const call = pending.action === 'start' ? Backend.startService : Backend.stopService;
    const res = await call(selectedId, pending.unit);
    setExecuting(false);
    if (res.state === 'ok') {
      setPending(null);
      setAssessment(null);
      void load(selectedId);
    } else {
      setMutationError(res.detail);
    }
  };

  const closeModal = () => {
    if (executing) return;
    setPending(null);
    setAssessment(null);
    setMutationError(null);
  };

  const rows = useMemo(() => {
    if (services?.state !== 'ok') return [];
    const q = query.trim().toLowerCase();
    return services.data.filter((svc) => {
      const matches =
        !q ||
        svc.unit.toLowerCase().includes(q) ||
        svc.description.toLowerCase().includes(q);
      if (!matches) return false;
      if (filter === 'running') return svc.active_state === 'active' && svc.sub_state === 'running';
      if (filter === 'failed') return svc.active_state === 'failed' || svc.sub_state === 'failed';
      if (filter === 'inactive') return svc.active_state === 'inactive';
      return true;
    });
  }, [services, filter, query]);

  if (!hasBackend()) {
    return (
      <NoDataState
        variant="unavailable"
        title="Service inspection needs the KyvonOPS desktop app"
        detail="systemd units cannot be listed from a browser tab. The desktop app opens SSH from this workstation."
        action={
          <Link to="/downloads" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            Downloads
          </Link>
        }
      />
    );
  }

  const inventoryEmpty = servers?.state === 'ok' && servers.data.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 pb-8">
      <HostHeader
        icon={Activity}
        title="Services"
        subtitle={
          selected
            ? `systemctl list-units on ${selected.alias || selected.hostname}`
            : 'Classified start/stop with verification and audit'
        }
        servers={servers}
        selectedId={selectedId}
        onSelect={select}
        trailing={
          <button
            type="button"
            onClick={() => selectedId && void load(selectedId)}
            disabled={refreshing || !selectedId}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface hover:bg-elevated disabled:opacity-50"
            title="Refresh unit list"
            aria-label="Refresh unit list"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-secondary ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {servers === null && (
        <NoDataState variant="empty" title="Reading local inventory…" detail="Querying the local SQLite store." />
      )}
      {servers && servers.state !== 'ok' && (
        <NoDataState
          variant={servers.state === 'unavailable' ? 'unavailable' : 'failed'}
          title={servers.reason}
          detail={servers.detail}
        />
      )}
      {inventoryEmpty && (
        <NoDataState
          variant="empty"
          title="No hosts configured"
          detail="Services have nothing to query until a server is added."
          action={
            <Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
              Add a server
            </Link>
          }
        />
      )}

      {selectedId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Unit filter">
              {(['all', 'running', 'failed', 'inactive'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab}
                  onClick={() => setFilter(tab)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                    filter === tab ? 'bg-info/10 text-info' : 'text-secondary hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-secondary" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search unit or description"
                aria-label="Search units"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-secondary/60 focus:border-info/50 focus:outline-none"
              />
            </div>
          </div>

          {services?.state === 'failed' || services?.state === 'unavailable' ? (
            <NoDataState
              variant={services.state === 'unavailable' ? 'unavailable' : 'failed'}
              title={services.reason}
              detail={services.detail}
              action={
                <button
                  type="button"
                  onClick={() => void load(selectedId)}
                  className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white"
                >
                  Retry
                </button>
              }
            />
          ) : services?.state === 'ok' && rows.length === 0 ? (
            <NoDataState
              variant="empty"
              title="No units match this filter"
              detail={query ? 'Clear the search query or pick a different tab.' : 'systemctl returned no service units the parser recognised.'}
            />
          ) : services?.state === 'ok' ? (
            <div className="overflow-hidden rounded-xl border border-border/80 bg-surface/80">
              <div className="max-h-[calc(100vh-18rem)] overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 text-secondary backdrop-blur">
                    <tr>
                      <th className="p-3 font-medium">Unit</th>
                      <th className="p-3 font-medium">State</th>
                      <th className="p-3 font-medium">Sub</th>
                      <th className="p-3 font-medium">Enablement</th>
                      <th className="p-3 font-medium">Description</th>
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((svc) => {
                      const running = svc.active_state === 'active' && svc.sub_state === 'running';
                      const failed = svc.active_state === 'failed' || svc.sub_state === 'failed';
                      return (
                        <tr key={svc.unit} className="transition-colors hover:bg-elevated/40">
                          <td className="p-3 font-mono font-medium text-white">{svc.unit}</td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                running
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : failed
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : 'bg-elevated text-secondary'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  running ? 'bg-emerald-400' : failed ? 'bg-rose-400' : 'bg-secondary'
                                }`}
                                aria-hidden
                              />
                              {svc.active_state}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-secondary">{svc.sub_state}</td>
                          <td className="p-3">
                            {svc.enabled ? (
                              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-secondary">
                                {svc.enabled}
                              </span>
                            ) : (
                              <span className="text-secondary/50">not queried</span>
                            )}
                          </td>
                          <td className="max-w-xs truncate p-3 text-secondary" title={svc.description}>
                            {svc.description || '—'}
                          </td>
                          <td className="p-3 text-right">
                            {running ? (
                              <button
                                type="button"
                                onClick={() => void initiate('stop', svc.unit)}
                                className="inline-flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20"
                              >
                                <Square className="h-3 w-3" aria-hidden /> Stop
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void initiate('start', svc.unit)}
                                className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20"
                              >
                                <Play className="h-3 w-3" aria-hidden /> Start
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <NoDataState variant="empty" title="Loading units…" detail="Asking systemctl over the established SSH session." />
          )}
        </>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-confirm-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 id="service-confirm-title" className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden />
                Confirm {pending.action} of {pending.unit}
              </h2>
              <button type="button" onClick={closeModal} className="text-secondary hover:text-white" aria-label="Close">
                ×
              </button>
            </div>
            <div className="mt-4 space-y-4 text-xs">
              {assessing ? (
                <div className="flex items-center justify-center gap-2 py-8 text-secondary">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  Classifying the command…
                </div>
              ) : assessment ? (
                <>
                  <p>
                    <span className="text-secondary">Risk tier: </span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${TIER_BADGE[assessment.tier]}`}>
                      {assessment.tier}
                    </span>
                  </p>
                  <div>
                    <div className="mb-1 text-secondary">Command that will run</div>
                    <code className="block rounded-lg border border-border bg-black/50 p-2.5 font-mono text-[11px] text-amber-300">
                      {assessment.command}
                    </code>
                  </div>
                  {assessment.reasons.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5 text-secondary">
                      {assessment.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {assessment.expected_impact.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5 text-rose-300/90">
                      {assessment.expected_impact.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
              {mutationError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">{mutationError}</div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-secondary hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={executing || !assessment}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {executing && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
