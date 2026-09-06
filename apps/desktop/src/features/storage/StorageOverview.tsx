import React from 'react';
import { AlertTriangle, HardDrive } from 'lucide-react';
import { HostHeader, hostGate } from '../../components/ui/HostHeader';
import { NoDataState } from '../../components/ui/NoDataState';
import { formatBytes, useTelemetry } from '../../lib/useTelemetry';
import { useCollector, useSelectedServer } from '../../lib/useSelectedServer';
import {
  fsInodePct,
  fsKind,
  fsUsedPct,
  inodesWillExhaustFirst,
  severityForPct,
  type Severity,
} from '../../lib/hostViews';
import type { FilesystemInfo } from '../../types';

/**
 * Filesystem capacity per mount, from `df -PB1`, `df -Pi` and `/proc/mounts`
 * shipped every 30 collector ticks and joined on this side.
 *
 * Every mount gets two bars, not one. Bytes are what people look at; inodes
 * are what actually fills a disk that still reports gigabytes free — a mail
 * spool, a session directory, a runaway cache of tiny files. When inode usage
 * is running ahead of byte usage the card says so in words, because a second
 * thin bar is easy to miss at 2 AM.
 *
 * Pseudo-filesystems (tmpfs, overlay, cgroup, …) were dropped in Rust before
 * the frame was emitted; what is left is storage that can run out.
 */

const BAR_TONE: Record<Severity, string> = {
  nominal: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-rose-400',
};

const TEXT_TONE: Record<Severity, string> = {
  nominal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-rose-400',
};

const KIND_BADGE: Record<ReturnType<typeof fsKind>, string> = {
  physical: 'border-border text-secondary',
  network: 'border-info/30 text-info',
  virtual: 'border-border text-secondary/70',
  unknown: 'border-border text-secondary/50',
};

export const StorageOverview: React.FC = () => {
  const { servers, selectedId, select } = useSelectedServer();
  const collectorError = useCollector(selectedId);
  const live = useTelemetry(selectedId);

  const gate = hostGate('The storage overview', servers, collectorError);
  const filesystems = live.disk?.filesystems ?? null;
  const worst = filesystems
    ? filesystems.reduce<Severity>((acc, fs) => {
        const s = severityForPct(Math.max(fsUsedPct(fs), fsInodePct(fs) ?? 0));
        return s === 'critical' || acc === 'critical' ? 'critical' : s === 'warning' ? 'warning' : acc;
      }, 'nominal')
    : null;

  return (
    <div className="flex h-full flex-col gap-4 pb-8">
      <HostHeader
        icon={HardDrive}
        title="Storage"
        subtitle={
          filesystems
            ? `${filesystems.length} real filesystem${filesystems.length === 1 ? '' : 's'} · sampled every 30 s`
            : 'Bytes and inodes per mount, from df on the host'
        }
        servers={servers}
        selectedId={selectedId}
        onSelect={select}
        trailing={
          worst && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${worst === 'nominal' ? 'bg-emerald-500/10' : worst === 'warning' ? 'bg-amber-500/10' : 'bg-rose-500/10'} ${TEXT_TONE[worst]}`}>
              {worst === 'nominal' ? 'All mounts under 75%' : worst === 'warning' ? 'A mount is above 75%' : 'A mount is above 90%'}
            </span>
          )
        }
      />

      {gate}

      {!gate && live.stoppedReason && (
        <NoDataState variant="failed" title="Telemetry stopped" detail={live.stoppedReason} />
      )}

      {!gate && live.errors.disk && (
        <NoDataState
          variant="failed"
          title="Filesystem usage could not be read"
          detail={`${live.errors.disk}. The host's df output did not parse; nothing is shown rather than a partial table.`}
        />
      )}

      {!gate && !filesystems && !live.errors.disk && !live.stoppedReason && (
        <NoDataState
          variant="empty"
          title="Waiting for the first filesystem sample"
          detail="df runs on the first collector tick and every 30 s after. If nothing arrives, the SSH session may not be established."
        />
      )}

      {!gate && filesystems && filesystems.length === 0 && (
        <NoDataState
          variant="empty"
          title="No real storage reported"
          detail="df returned only pseudo-filesystems (tmpfs, overlay, cgroup). On a container host this can be accurate; on a VPS it usually means df could not see the root device."
        />
      )}

      {!gate && filesystems && filesystems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filesystems.map((fs) => (
            <MountCard key={`${fs.device}:${fs.mount_point}`} fs={fs} />
          ))}
        </div>
      )}
    </div>
  );
};

const MountCard: React.FC<{ fs: FilesystemInfo }> = ({ fs }) => {
  const bytesPct = fsUsedPct(fs);
  const inodePct = fsInodePct(fs);
  const bytesSeverity = severityForPct(bytesPct);
  const inodeSeverity = inodePct === null ? null : severityForPct(inodePct);
  const inodesFirst = inodesWillExhaustFirst(fs);
  const kind = fsKind(fs.fs_type);
  const border =
    bytesSeverity === 'critical' || inodeSeverity === 'critical'
      ? 'border-rose-500/40'
      : bytesSeverity === 'warning' || inodeSeverity === 'warning'
        ? 'border-amber-500/30'
        : 'border-border/80';

  return (
    <div className={`rounded-xl border ${border} bg-surface/80 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold text-white" title={fs.mount_point}>
            {fs.mount_point}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-secondary" title={fs.device}>
            {fs.device}
          </div>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${KIND_BADGE[kind]}`} title={kind === 'unknown' ? 'Filesystem type not reported by /proc/mounts' : `${kind} filesystem`}>
          {fs.fs_type || 'type unknown'}
        </span>
      </div>

      <Bar
        label="Bytes"
        pct={bytesPct}
        severity={bytesSeverity}
        left={`${formatBytes(fs.used_bytes)} used`}
        right={`${formatBytes(fs.available_bytes)} free of ${formatBytes(fs.total_bytes)}`}
      />

      {inodePct === null ? (
        <div className="mt-4 text-[11px] text-secondary/70">
          Inodes: not reported — <span className="font-mono">df -i</span> returned nothing for this mount, so inode headroom is unknown.
        </div>
      ) : (
        <Bar
          label="Inodes"
          pct={inodePct}
          severity={inodeSeverity ?? 'nominal'}
          left={`${fs.inodes_used.toLocaleString()} used`}
          right={`${(fs.inodes_total - fs.inodes_used).toLocaleString()} free of ${fs.inodes_total.toLocaleString()}`}
        />
      )}

      {inodesFirst && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Inodes will run out before space does: {inodePct?.toFixed(0)}% of inodes are used against {bytesPct.toFixed(0)}% of bytes.
            Writes will fail with “No space left on device” while <span className="font-mono">df -h</span> still shows free space. Look for directories with very many small files.
          </span>
        </div>
      )}
    </div>
  );
};

const Bar: React.FC<{ label: string; pct: number; severity: Severity; left: string; right: string }> = ({
  label,
  pct,
  severity,
  left,
  right,
}) => (
  <div className="mt-4">
    <div className="flex items-baseline justify-between text-[11px]">
      <span className="font-medium text-secondary">{label}</span>
      <span className={`font-mono tabular-nums ${TEXT_TONE[severity]}`}>{pct.toFixed(1)}%</span>
    </div>
    <div
      className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated"
      role="progressbar"
      aria-label={`${label} used`}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full ${BAR_TONE[severity]} transition-[width] duration-150 ease-out`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
    <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-secondary/80">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  </div>
);
