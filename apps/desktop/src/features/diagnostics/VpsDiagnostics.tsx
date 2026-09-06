import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { NoDataState } from '../../components/ui/NoDataState';
import { hasBackend } from '../../lib/backend';

/**
 * Outage-risk synthesis lives in `kyvon-diagnostics`. This screen previously
 * rendered invented latency waterfalls for api.example.com. Those numbers were
 * not measured, so they are not shown.
 */
export const VpsDiagnostics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-border bg-elevated p-3 text-info">
          <Zap className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Diagnostics</h1>
          <p className="text-xs text-secondary">Causal synthesis is not wired to live samples in this build</p>
        </div>
      </div>
      <NoDataState
        variant={hasBackend() ? 'empty' : 'unavailable'}
        title={hasBackend() ? 'No diagnostic report yet' : 'Diagnostics need the desktop app'}
        detail={
          hasBackend()
            ? 'kyvon-diagnostics is in the workspace but this screen does not invent waterfalls or outage scores. Connect a host, start the collector, and use Processes, Storage, Network, and Services for measured data.'
            : 'The browser build has no SSH transport, so it cannot diagnose a VPS.'
        }
        action={
          <Link to={hasBackend() ? '/servers' : '/downloads'} className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            {hasBackend() ? 'Open servers' : 'Downloads'}
          </Link>
        }
      />
    </div>
  );
};
