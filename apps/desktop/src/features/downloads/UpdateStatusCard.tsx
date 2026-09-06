import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  checkForUpdate,
  CURRENT_VERSION,
  type UpdateCheckState,
} from '../../lib/releases';

export const UpdateStatusCard: React.FC = () => {
  const [status, setStatus] = useState<UpdateCheckState>({ state: 'checking' });

  const check = useCallback(async () => {
    setStatus({ state: 'checking' });
    setStatus(await checkForUpdate());
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const message = (() => {
    switch (status.state) {
      case 'checking':
        return 'Checking the published GitHub release channel…';
      case 'available':
        return `KyvonOPS ${status.release.tag_name} is available. Review the release notes and checksum before downloading.`;
      case 'up-to-date':
        return `You are running ${CURRENT_VERSION}. The latest published stable release is ${status.release.tag_name}.`;
      case 'no-release':
        return status.detail;
      case 'unavailable':
        return status.detail;
    }
  })();

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="update-status-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-lg border border-info/20 bg-info/10 p-2 text-info" aria-hidden="true">
            {status.state === 'checking' ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <h2 id="update-status-heading" className="text-sm font-semibold text-white">Desktop updates</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-secondary">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={status.state === 'checking'}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-white transition hover:border-info hover:text-info disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Check again
        </button>
      </div>

      {status.state === 'available' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <a
            href={status.release.html_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-info px-3 py-2 text-xs font-semibold text-background transition hover:bg-info/90"
          >
            Review release {status.release.tag_name}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <span className="text-[11px] text-secondary">
            Automatic installation is disabled until signed updater metadata is configured.
          </span>
        </div>
      )}

      {(status.state === 'no-release' || status.state === 'unavailable') && (
        <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-[11px] text-secondary" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <span>Release checks are informational only. No installer was downloaded or executed.</span>
        </div>
      )}

      {status.state === 'up-to-date' && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-[11px] text-emerald-400" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>Release channel is current. Verify the checksum shown beside any downloaded artifact.</span>
        </div>
      )}
    </section>
  );
};
