import type { FilesystemInfo, PortInfo, ProcessInfo } from '../types/telemetry';

/**
 * Pure presentation logic for the per-host screens, kept out of the components
 * so it can be tested without a DOM. Nothing here invents a value: every
 * function maps a measured sample to how it is shown.
 */

// ------------------------------------------------------------- Processes

export type ProcessSortKey = 'cpu_pct' | 'mem_pct' | 'rss_bytes' | 'pid' | 'uptime_secs';

/** Stable descending sort (ascending for PID) with PID as the tiebreak. */
export function sortProcesses(
  processes: readonly ProcessInfo[],
  key: ProcessSortKey,
  direction: 'asc' | 'desc',
): ProcessInfo[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...processes].sort((a, b) => {
    const delta = a[key] - b[key];
    if (delta !== 0) return sign * delta;
    return a.pid - b.pid;
  });
}

export type ProcessStateKind = 'running' | 'sleeping' | 'blocked' | 'zombie' | 'stopped' | 'other';

/**
 * First letter of the `ps` STAT column. `D` and `Z` are the two an operator
 * needs to see at a glance: a process stuck in the kernel is not consuming CPU
 * but is still stuck, and a zombie says something about its parent.
 */
export function processStateKind(state: string): ProcessStateKind {
  switch (state.charAt(0)) {
    case 'R':
      return 'running';
    case 'S':
    case 'I':
      return 'sleeping';
    case 'D':
      return 'blocked';
    case 'Z':
      return 'zombie';
    case 'T':
    case 't':
      return 'stopped';
    default:
      return 'other';
  }
}

export const PROCESS_STATE_LABEL: Record<ProcessStateKind, { label: string; hint: string; tone: string }> = {
  running: { label: 'R', hint: 'Running or runnable', tone: 'bg-emerald-500/10 text-emerald-400' },
  sleeping: { label: 'S', hint: 'Interruptible sleep (waiting for an event)', tone: 'bg-elevated text-secondary' },
  blocked: { label: 'D', hint: 'Uninterruptible sleep: stalled on kernel I/O', tone: 'bg-amber-500/10 text-amber-400' },
  zombie: { label: 'Z', hint: 'Defunct: exited, awaiting reap by its parent', tone: 'bg-rose-500/10 text-rose-400' },
  stopped: { label: 'T', hint: 'Stopped by a job-control or trace signal', tone: 'bg-elevated text-secondary' },
  other: { label: '?', hint: 'State letter not recognised', tone: 'bg-elevated text-secondary' },
};

/** `12d 04h`, `3h 12m`, `45s` — for the ETIMES column. */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

// ------------------------------------------------------------------ Disk

/** Same arithmetic as `FilesystemInfo::used_pct` in kyvon-core. */
export function fsUsedPct(fs: FilesystemInfo): number {
  const usable = fs.used_bytes + fs.available_bytes;
  return usable === 0 ? 0 : (fs.used_bytes / usable) * 100;
}

/** Null when `df -i` reported nothing — unknown, not 0%. */
export function fsInodePct(fs: FilesystemInfo): number | null {
  return fs.inodes_total > 0 ? (fs.inodes_used / fs.inodes_total) * 100 : null;
}

export type Severity = 'nominal' | 'warning' | 'critical';

export function severityForPct(pct: number): Severity {
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'warning';
  return 'nominal';
}

/**
 * The failure an operator cannot see from a byte bar: inodes running out
 * while free space still looks fine. True when inodes are meaningfully closer
 * to exhaustion than bytes are.
 */
export function inodesWillExhaustFirst(fs: FilesystemInfo): boolean {
  const inodes = fsInodePct(fs);
  if (inodes === null) return false;
  return inodes >= 75 && inodes > fsUsedPct(fs) + 10;
}

export type FsKind = 'physical' | 'network' | 'virtual' | 'unknown';

export function fsKind(fsType: string): FsKind {
  switch (fsType) {
    case '':
      return 'unknown';
    case 'ext2':
    case 'ext3':
    case 'ext4':
    case 'xfs':
    case 'btrfs':
    case 'zfs':
    case 'f2fs':
    case 'vfat':
    case 'exfat':
    case 'ntfs':
    case 'ntfs3':
    case 'fuseblk':
      return 'physical';
    case 'nfs':
    case 'nfs4':
    case 'cifs':
    case 'smb3':
    case 'ceph':
    case 'glusterfs':
    case 'fuse.sshfs':
      return 'network';
    default:
      return 'virtual';
  }
}

// ----------------------------------------------------------------- Ports

export const EXPOSURE_LABEL: Record<PortInfo['exposure'], { label: string; hint: string; tone: string }> = {
  all_interfaces: {
    label: 'All interfaces',
    hint: 'Bound to 0.0.0.0 or ::. Reachable from anywhere the firewall permits.',
    tone: 'bg-amber-500/10 text-amber-400',
  },
  interface: {
    label: 'One address',
    hint: 'Bound to a specific non-loopback address.',
    tone: 'bg-info/10 text-info',
  },
  loopback: {
    label: 'Loopback',
    hint: 'Bound to 127.0.0.1 or ::1. Not reachable from the network.',
    tone: 'bg-emerald-500/10 text-emerald-400',
  },
};

/** Listening sockets, most exposed first, then by port. */
export function sortPorts(ports: readonly PortInfo[]): PortInfo[] {
  const rank: Record<PortInfo['exposure'], number> = { all_interfaces: 0, interface: 1, loopback: 2 };
  return [...ports].sort((a, b) => rank[a.exposure] - rank[b.exposure] || a.port - b.port);
}

/**
 * Well-known ports a public bind is worth a second look at. This is a
 * reading aid, not a verdict — whether a bind is actually reachable depends
 * on the firewall, which this screen has not measured.
 */
export const SENSITIVE_PORTS: ReadonlyMap<number, string> = new Map([
  [3306, 'MySQL / MariaDB'],
  [5432, 'PostgreSQL'],
  [6379, 'Redis'],
  [27017, 'MongoDB'],
  [9200, 'Elasticsearch'],
  [11211, 'memcached'],
  [2375, 'Docker API (unencrypted)'],
  [2376, 'Docker API (TLS)'],
  [5900, 'VNC'],
  [3389, 'RDP'],
  [25, 'SMTP'],
]);
