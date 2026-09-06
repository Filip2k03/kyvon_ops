import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { AuthMethod } from '../../types';

export interface NewServerData {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  auth: AuthMethod;
  tag: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewServerData) => Promise<void>;
}

export function AddServerDialog({ isOpen, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [alias, setAlias] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'agent' | 'private_key'>('agent');
  const [keyPath, setKeyPath] = useState('');
  const [tag, setTag] = useState('development');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!isOpen) dialog.current?.close();
  }, [isOpen]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const sshPort = Number(port);
    if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
      setError('Enter an SSH port between 1 and 65535.');
      return;
    }
    if (!alias.trim() || !hostname.trim() || !username.trim()) {
      setError('Enter a server name, hostname, and SSH username.');
      return;
    }
    if (authType === 'private_key' && !/^(\/|[A-Za-z]:[\\/])/.test(keyPath.trim())) {
      setError('Enter an absolute path to your key file on this workstation.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ alias: alias.trim(), hostname: hostname.trim(), port: sshPort,
        username: username.trim(), tag,
        auth: authType === 'agent' ? { type: 'agent' } : { type: 'private_key', path: keyPath.trim(), encrypted: false },
      });
      setAlias(''); setHostname(''); setUsername(''); setKeyPath(''); setPort('22');
      setAuthType('agent'); setTag('development');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the server. Check the desktop connection and retry.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 text-white focus:outline focus:outline-2 focus:outline-info';
  return (
    <dialog ref={dialog} aria-labelledby="add-server-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 text-primary backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-4"><h2 id="add-server-title" className="text-xl font-semibold">Add your server</h2><button type="button" disabled={saving} onClick={onClose} aria-label="Close add server" className="p-3"><X className="h-5 w-5" /></button></div>
      <p className="mt-2 text-sm leading-6 text-secondary">Save a connection profile in this workstation’s inventory. Saving does not connect to the host or verify its identity.</p>
      <form onSubmit={submit} className="mt-6 space-y-4 text-sm">
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <label className="block">Server name<input className={inputClass} value={alias} onChange={e => setAlias(e.target.value)} required autoFocus autoComplete="off" /></label>
          <label className="block">Hostname or IP address<input className={inputClass} value={hostname} onChange={e => setHostname(e.target.value)} required autoComplete="off" spellCheck={false} /></label>
          <div className="grid grid-cols-2 gap-4"><label>SSH username<input className={inputClass} value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" /></label><label>SSH port<input className={inputClass} type="number" min="1" max="65535" step="1" value={port} onChange={e => setPort(e.target.value)} required /></label></div>
          <label className="block">Environment<select className={inputClass} value={tag} onChange={e => setTag(e.target.value)}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option><option value="client-work">Client workspace</option></select></label>
          <label className="block">Authentication<select className={inputClass} value={authType} onChange={e => setAuthType(e.target.value as 'agent' | 'private_key')}><option value="agent">Your SSH agent</option><option value="private_key">Local private key file</option></select></label>
          {authType === 'private_key' && <label className="block">Absolute key file path<input className={inputClass} value={keyPath} onChange={e => setKeyPath(e.target.value)} required autoComplete="off" spellCheck={false} /></label>}
          <p className="text-xs leading-5 text-secondary">For passphrase-protected keys, use your SSH agent. Password entry is unavailable until a secure credential setup flow is connected. Verify the host fingerprint when connecting.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4"><button disabled={saving} type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-3">Cancel</button><button disabled={saving} type="submit" className="rounded-lg bg-info px-4 py-3 font-semibold text-background disabled:opacity-50">{saving ? 'Saving…' : 'Save server profile'}</button></div>
      </form>
    </dialog>
  );
}
