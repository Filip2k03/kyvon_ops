import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backend, hasBackend, type Loaded } from './backend';
import type { ServerProfile } from '../types';

/**
 * Which host a per-host screen is looking at.
 *
 * The selection lives in the URL (`?server=<id>`) so the terminal, the process
 * list and the storage view can hand off to each other without losing it, and
 * a refresh lands on the same host. When the URL names nothing, the first host
 * in the inventory is chosen — a choice, not a guess, and it is written back
 * so the operator can see which host every figure belongs to.
 */
export interface SelectedServer {
  servers: Loaded<ServerProfile[]> | null;
  selectedId: string | null;
  selected: ServerProfile | null;
  select: (id: string) => void;
  reload: () => Promise<void>;
}

export function useSelectedServer(): SelectedServer {
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<Loaded<ServerProfile[]> | null>(null);

  const reload = useCallback(async () => {
    setServers(await Backend.listServers());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fromUrl = searchParams.get('server')?.trim() ?? '';
  const list = servers?.state === 'ok' ? servers.data : [];
  const selected = list.find((s) => s.id === fromUrl) ?? list[0] ?? null;
  const selectedId = selected?.id ?? null;

  useEffect(() => {
    if (selectedId && selectedId !== fromUrl) {
      setSearchParams({ server: selectedId }, { replace: true });
    }
  }, [selectedId, fromUrl, setSearchParams]);

  const select = useCallback(
    (id: string) => setSearchParams({ server: id }),
    [setSearchParams],
  );

  return { servers, selectedId, selected, select, reload };
}

/**
 * Run the telemetry collector on one host for the lifetime of a screen.
 *
 * `start_collector` refuses when there is no SSH session, which is the normal
 * state before the operator connects — so its failure is returned for the
 * screen to show with a link to the server list, rather than treated as an
 * exception. `null` means the collector was started or nothing was asked for.
 */
export function useCollector(serverId: string | null): string | null {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!serverId || !hasBackend()) return;
    let active = true;
    void Backend.startCollector(serverId).then((result) => {
      if (!active || result.state === 'ok') return;
      setError(result.detail);
    });
    return () => {
      active = false;
      void Backend.stopCollector(serverId);
    };
  }, [serverId]);

  return error;
}
