import React, { useCallback, useEffect, useState } from 'react';
import { Server, Plus, Terminal, RefreshCw, Trash2, Zap, Search } from 'lucide-react';
import { AddServerDialog, NewServerData } from './AddServerDialog';
import { useNavigate } from 'react-router-dom';
import { Backend, hasBackend, type Loaded } from '../../lib/backend';
import { LoadedFallback, NoDataState } from '../../components/ui/NoDataState';
import { describeAuth, type ServerProfile } from '../../types';
import { formatBytes } from '../../lib/useTelemetry';

type HostKeyPromptPayload = {
  prompt_id: string;
  prompt: {
    server_id: string;
    host: string;
    port: number;
    key_type: string;
    fingerprint: string;
    previous_fingerprint?: string | null;
  };
};

/**
 * The user's VPS inventory, read from the local SQLite store over Tauri IPC.
 *
 * Only fields the backend actually returns are rendered. Live figures — CPU,
 * memory, SSH latency, OS facts — belong to the telemetry stream and to
 * `HostFacts` from a completed probe; until those are wired, this screen says
 * so rather than showing a number nobody measured (PROMPTS.md §108).
 */
export const ServerList: React.FC = () => {
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [result, setResult] = useState<Loaded<ServerProfile[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionStates, setConnectionStates] = useState<Record<string, string>>({});
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPromptPayload | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setResult(await Backend.listServers());
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Restore the actual in-memory SSH session state when this route is opened
  // after onboarding or a browser-level refresh. No cookie or token is
  // persisted: the desktop transport itself is the source of truth.
  useEffect(() => {
    if (!hasBackend()) return;
    void Backend.connectedServers().then((connected) => {
      if (connected.state === 'ok') {
        setConnectionStates(Object.fromEntries(connected.data.map((id) => [id, 'connected'])));
      }
    });
  }, []);

  useEffect(() => {
    if (!hasBackend()) return;
    let disposed = false;
    let dispose: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) => Promise.all([
      listen<HostKeyPromptPayload>('kyvon-host-key-prompt', event => setHostKeyPrompt(event.payload)),
      listen<{ event: string; server_id?: string; state?: string; message?: string }>('kyvon-event', event => {
        if (event.payload.event === 'connection_state' && event.payload.server_id && event.payload.state) {
          setConnectionStates(previous => ({ ...previous, [event.payload.server_id!]: event.payload.state! }));
          if (event.payload.message) {
            setConnectionErrors(previous => ({ ...previous, [event.payload.server_id!]: event.payload.message! }));
          }
        }
      }),
    ])).then(unlisteners => {
      const cleanup = () => unlisteners.forEach(unlisten => { void unlisten(); });
      if (disposed) cleanup();
      else dispose = cleanup;
    });
    return () => { disposed = true; dispose?.(); };
  }, []);

  const handleAddServer = async (data: NewServerData) => {
    const created = await Backend.addServer(
      {
        alias: data.alias,
        hostname: data.hostname,
        port: data.port,
        username: data.username,
        auth: data.auth,
        tags: [data.tag],
      },
      data.secret,
    );
    // Re-read rather than optimistically inserting: the store assigns the id
    // and is the only authority on what is actually persisted.
    if (created.state === 'ok') await load();
    else throw new Error(`${created.reason}. ${created.detail}`);
  };

  const [probing, setProbing] = useState<string | null>(null);

  // A probe writes HostFacts to the store, so re-read rather than patching
  // local state: the store is the authority on what was actually persisted.
  const handleProbe = async (id: string) => {
    setProbing(id);
    const probed = await Backend.probeCapabilities(id);
    setProbing(null);
    if (probed.state === 'ok') await load();
    else setResult(probed as unknown as Loaded<ServerProfile[]>);
  };

  const handleDelete = async (id: string) => {
    const removed = await Backend.deleteServer(id);
    if (removed.state === 'ok') await load();
  };

  const handleConnect = async (id: string) => {
    setConnectionStates(previous => ({ ...previous, [id]: 'connecting' }));
    setConnectionErrors(previous => ({ ...previous, [id]: '' }));
    const result = await Backend.connect(id);
    if (result.state === 'ok') {
      setConnectionStates(previous => ({ ...previous, [id]: 'connected' }));
      // Move directly into the VPS workspace after the real SSH session
      // is established. The server id in the URL keeps the selected host
      // stable across Command Center and per-host views.
      navigate(`/command-center?server=${encodeURIComponent(id)}`);
    } else {
      setConnectionStates(previous => ({ ...previous, [id]: 'error' }));
      setConnectionErrors(previous => ({ ...previous, [id]: result.detail }));
    }
  };

  const handleDisconnect = async (id: string) => {
    setConnectionStates(previous => ({ ...previous, [id]: 'disconnecting' }));
    const result = await Backend.disconnect(id);
    if (result.state === 'failed') setConnectionStates(previous => ({ ...previous, [id]: 'error' }));
  };

  const servers = result?.state === 'ok' ? result.data : [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Server className="w-6 h-6 text-info" /> My VPS
          </h1>
          <p className="text-xs text-secondary mt-1">
            Local SQLite inventory with encrypted keychain vault credentials and multiplexed SSH transports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            disabled={!hasBackend() || busy}
            className="px-3 py-2 rounded-lg bg-elevated border border-border text-secondary hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            disabled={!hasBackend()}
            title={hasBackend() ? undefined : 'Adding a server requires the desktop application'}
            className="px-3.5 py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add Server
          </button>
        </div>
      </div>

      {result === null ? (
        <NoDataState variant="empty" title="Reading local inventory…" detail="Querying the local SQLite store." />
      ) : (
        <LoadedFallback result={result} />
      )}

      {result?.state === 'ok' && servers.length === 0 && (
        <NoDataState
          variant="empty"
            title="No VPS connected"
            detail="Connect your first VPS to store its connection shape locally. The password or key passphrase goes to your OS keychain, never to this database."
          action={
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add your first server
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((server) => (
          <div
            key={server.id}
            className="bg-surface/90 border border-border/80 hover:border-border rounded-xl p-5 shadow-xl transition-all space-y-4 relative overflow-hidden group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-elevated border border-border flex items-center justify-center text-info">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    {server.alias}
                    {server.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-elevated text-secondary border border-border/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </h3>
                  <div className="text-[11px] font-mono text-secondary mt-0.5">
                    {server.username}@{server.hostname}:{server.port}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/60 text-xs space-y-2">
              <div className="flex justify-between items-center text-secondary">
                <span>Authentication</span>
                <span className="text-white font-medium text-[11px]">{describeAuth(server.auth)}</span>
              </div>
              {/*
                Facts come from a completed probe and are null until one runs.
                Showing a distribution guessed from the hostname, or a core
                count of 0, would be the fabrication this project forbids —
                so an unprobed host says exactly that.
              */}
              {server.facts ? (
                <>
                  <div className="flex justify-between items-center text-secondary">
                    <span>Operating system</span>
                    <span className="text-white font-medium text-[11px]">
                      {server.facts.os_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-secondary">
                    <span>Kernel &amp; arch</span>
                    <span className="text-white font-mono text-[11px]">
                      {server.facts.kernel} · {server.facts.arch}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-secondary">
                    <span>CPU &amp; memory</span>
                    <span className="text-white font-mono text-[11px]">
                      {server.facts.cpu_cores} cores ·{' '}
                      {formatBytes(server.facts.memory_total_bytes)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-secondary">
                  <span>Host facts</span>
                  <span className="text-[11px] text-secondary/70 italic">Not probed yet</span>
                </div>
              )}
            </div>

            {connectionErrors[server.id] && (
              <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] leading-5 text-red-200">
                {connectionErrors[server.id]}
              </div>
            )}

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => void (connectionStates[server.id] === 'connected' ? handleDisconnect(server.id) : handleConnect(server.id))}
                  className="px-3 py-1.5 rounded-lg border border-transparent bg-info hover:bg-info/90 text-white text-xs font-semibold flex items-center gap-1 transition-all"
                  disabled={connectionStates[server.id] === 'connecting' || connectionStates[server.id] === 'disconnecting'}
                >
                  <RefreshCw className={`w-3 h-3 ${['connecting', 'disconnecting', 'verifying_host', 'authenticating'].includes(connectionStates[server.id]) ? 'animate-spin' : ''}`} /> {connectionStates[server.id] === 'connected' ? 'Disconnect' : connectionStates[server.id] === 'verifying_host' ? 'Verify host…' : connectionStates[server.id] === 'authenticating' ? 'Authenticating…' : connectionStates[server.id] === 'connecting' ? 'Connecting…' : connectionStates[server.id] === 'disconnecting' ? 'Disconnecting…' : 'Connect'}
                </button>

                {/*
                  Probing needs a live session, so the button says why it is
                  unavailable rather than failing silently when clicked.
                */}
                <button
                  onClick={() => void handleProbe(server.id)}
                  disabled={probing === server.id || connectionStates[server.id] !== 'connected'}
                  className="px-3 py-1.5 rounded-lg border border-border bg-elevated hover:bg-elevated/80 text-secondary hover:text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    connectionStates[server.id] === 'connected'
                      ? 'Read OS, kernel, CPU and memory from the host'
                      : 'Connect first — probing reads the host over SSH'
                  }
                >
                  <Search className={`w-3 h-3 ${probing === server.id ? 'animate-pulse' : ''}`} />
                  {probing === server.id ? 'Probing…' : 'Probe'}
                </button>

                <button
                  onClick={() => navigate(`/terminal?server=${encodeURIComponent(server.id)}`)}
                  disabled={connectionStates[server.id] !== 'connected'}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-white border border-border disabled:cursor-not-allowed disabled:opacity-40"
                  title={connectionStates[server.id] === 'connected' ? 'Open shell terminal' : 'Connect this server before opening a terminal'}
                  aria-label={`Open terminal for ${server.alias}`}
                >
                  <Terminal className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/diagnostics')}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-white border border-border"
                  title="Diagnostics & Causal Graph"
                >
                  <Zap className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => void handleDelete(server.id)}
                className="p-1.5 rounded-lg hover:bg-danger/20 text-secondary hover:text-danger transition-colors"
                title="Remove Server"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AddServerDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleAddServer}
      />
      {hostKeyPrompt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="host-key-title" className="max-w-lg rounded-xl border border-amber-500/40 bg-surface p-6 shadow-2xl"><h2 id="host-key-title" className="text-lg font-semibold text-white">Verify SSH host key</h2><p className="mt-3 text-sm leading-6 text-secondary">{hostKeyPrompt.prompt.previous_fingerprint ? 'The host key changed. Verify it out of band before continuing.' : 'This host key has not been trusted on this workstation.'}</p><dl className="mt-4 space-y-2 rounded-lg bg-background p-4 text-xs"><div className="flex justify-between gap-4"><dt className="text-secondary">Target</dt><dd className="font-mono text-white">{hostKeyPrompt.prompt.host}:{hostKeyPrompt.prompt.port}</dd></div><div className="flex justify-between gap-4"><dt className="text-secondary">Algorithm</dt><dd className="font-mono text-white">{hostKeyPrompt.prompt.key_type}</dd></div><div className="flex justify-between gap-4"><dt className="text-secondary">Fingerprint</dt><dd className="break-all text-right font-mono text-amber-300">{hostKeyPrompt.prompt.fingerprint}</dd></div></dl><div className="mt-5 flex justify-end gap-3"><button type="button" className="rounded-lg border border-border px-4 py-3 text-sm" onClick={() => { void Backend.resolveHostKey(hostKeyPrompt.prompt_id, false); setHostKeyPrompt(null); }}>Reject</button><button type="button" className="rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950" onClick={() => { void Backend.resolveHostKey(hostKeyPrompt.prompt_id, true); setHostKeyPrompt(null); }}>Trust and connect</button></div></div></div>}
    </div>
  );
};
