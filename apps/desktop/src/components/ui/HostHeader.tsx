import React from 'react';
import { Link } from 'react-router-dom';
import { Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ServerProfile } from '../../types';
import { NoDataState } from './NoDataState';
import { hasBackend, type Loaded } from '../../lib/backend';

/**
 * The header every per-host screen shares: what the screen is, which host the
 * figures below belong to, and a way to switch. The host is always named next
 * to the data so a measurement can never be read against the wrong machine.
 */
interface HostHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  servers: Loaded<ServerProfile[]> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Rendered to the right of the host picker (refresh buttons, counts). */
  trailing?: React.ReactNode;
}

export const HostHeader: React.FC<HostHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  servers,
  selectedId,
  onSelect,
  trailing,
}) => {
  const list = servers?.state === 'ok' ? servers.data : [];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/80 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-info/20 bg-info/10 text-info">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">{title}</h1>
          <p className="text-xs text-secondary">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-1.5">
          <Server className="h-3.5 w-3.5 text-secondary" aria-hidden />
          <span className="sr-only">Host</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={list.length === 0}
            className="bg-transparent font-mono text-xs text-white focus:outline-none disabled:opacity-50"
          >
            {list.length === 0 && <option value="">No hosts in inventory</option>}
            {list.map((s) => (
              <option key={s.id} value={s.id} className="bg-surface text-white">
                {s.alias || s.hostname}
              </option>
            ))}
          </select>
        </label>
        {trailing}
      </div>
    </div>
  );
};

/**
 * The states a per-host screen shares before it has anything to show:
 * no backend, inventory still loading or failed, an empty inventory, or the
 * collector refusing to start. Returns null when the screen should render its
 * own content.
 */
export function hostGate(
  what: string,
  servers: Loaded<ServerProfile[]> | null,
  collectorError: string | null,
): React.ReactNode {
  if (!hasBackend()) {
    return (
      <NoDataState
        variant="unavailable"
        title={`${what} needs the KyvonOPS desktop app`}
        detail="This is the web build: it has no SSH transport, so nothing on a host can be read from here. Install the desktop application to inspect real hosts."
        action={
          <Link to="/downloads" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            Downloads
          </Link>
        }
      />
    );
  }
  if (servers === null) {
    return <NoDataState variant="empty" title="Reading local inventory…" detail="Querying the local SQLite store." />;
  }
  if (servers.state !== 'ok') {
    return (
      <NoDataState
        variant={servers.state === 'unavailable' ? 'unavailable' : 'failed'}
        title={servers.reason}
        detail={servers.detail}
      />
    );
  }
  if (servers.data.length === 0) {
    return (
      <NoDataState
        variant="empty"
        title="No hosts configured"
        detail={`${what} has nothing to read until a server is added to the inventory.`}
        action={
          <Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            Add a server
          </Link>
        }
      />
    );
  }
  if (collectorError) {
    return (
      <NoDataState
        variant="failed"
        title="Telemetry collector is not running on this host"
        detail={collectorError}
        action={
          <Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            Connect the host
          </Link>
        }
      />
    );
  }
  return null;
}
