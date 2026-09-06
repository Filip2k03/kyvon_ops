import { describe, expect, test } from 'bun:test';
import {
  fsInodePct,
  fsKind,
  fsUsedPct,
  formatUptime,
  inodesWillExhaustFirst,
  processStateKind,
  severityForPct,
  sortPorts,
  sortProcesses,
} from '../src/lib/hostViews';
import type { FilesystemInfo, PortInfo, ProcessInfo } from '../src/types';

function proc(over: Partial<ProcessInfo> & Pick<ProcessInfo, 'pid'>): ProcessInfo {
  return {
    ppid: 1,
    user: 'root',
    cpu_pct: 0,
    mem_pct: 0,
    rss_bytes: 0,
    state: 'S',
    command: 'idle',
    uptime_secs: 0,
    ...over,
  };
}

describe('process presentation', () => {
  test('sorts by CPU descending with PID as the tiebreak', () => {
    const rows = sortProcesses(
      [proc({ pid: 3, cpu_pct: 1 }), proc({ pid: 1, cpu_pct: 9 }), proc({ pid: 2, cpu_pct: 9 })],
      'cpu_pct',
      'desc',
    );
    expect(rows.map((p) => p.pid)).toEqual([1, 2, 3]);
  });

  test('maps D and Z distinctly from runnable', () => {
    expect(processStateKind('R')).toBe('running');
    expect(processStateKind('Ds')).toBe('blocked');
    expect(processStateKind('Z')).toBe('zombie');
  });

  test('formats elapsed seconds without inventing days from zero', () => {
    expect(formatUptime(0)).toBe('0s');
    expect(formatUptime(45)).toBe('45s');
    expect(formatUptime(125)).toBe('2m');
  });
});

describe('filesystem presentation', () => {
  const fs = (over: Partial<FilesystemInfo>): FilesystemInfo => ({
    mount_point: '/',
    device: '/dev/vda1',
    fs_type: 'ext4',
    total_bytes: 100,
    used_bytes: 50,
    available_bytes: 50,
    inodes_total: 1000,
    inodes_used: 100,
    ...over,
  });

  test('used percent matches usable bytes, not the raw total', () => {
    expect(fsUsedPct(fs({ used_bytes: 90, available_bytes: 10, total_bytes: 110 }))).toBe(90);
  });

  test('inode percent is null when df -i reported nothing', () => {
    expect(fsInodePct(fs({ inodes_total: 0, inodes_used: 0 }))).toBeNull();
  });

  test('inode exhaustion ahead of bytes is flagged, not guessed from empty inodes', () => {
    expect(inodesWillExhaustFirst(fs({ used_bytes: 40, available_bytes: 60, inodes_used: 900, inodes_total: 1000 }))).toBe(
      true,
    );
    expect(inodesWillExhaustFirst(fs({ inodes_total: 0 }))).toBe(false);
  });

  test('severity bands and mount kinds stay honest', () => {
    expect(severityForPct(74)).toBe('nominal');
    expect(severityForPct(90)).toBe('critical');
    expect(fsKind('ext4')).toBe('physical');
    expect(fsKind('nfs4')).toBe('network');
    expect(fsKind('')).toBe('unknown');
  });
});

describe('port presentation', () => {
  const port = (over: Partial<PortInfo> & Pick<PortInfo, 'port' | 'exposure'>): PortInfo => ({
    protocol: 'tcp',
    address: '0.0.0.0',
    process: null,
    pid: null,
    ...over,
  });

  test('all-interface binds sort ahead of loopback', () => {
    const ranked = sortPorts([
      port({ port: 22, exposure: 'loopback', address: '127.0.0.1' }),
      port({ port: 80, exposure: 'all_interfaces' }),
      port({ port: 443, exposure: 'interface', address: '10.0.0.5' }),
    ]);
    expect(ranked.map((p) => p.port)).toEqual([80, 443, 22]);
  });
});
