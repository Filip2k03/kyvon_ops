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
  /** One-shot secret for the OS keychain. Never persisted in React after submit. */
  secret?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewServerData) => Promise<void>;
}

type AuthChoice = 'agent' | 'private_key' | 'password';

export function AddServerDialog({ isOpen, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [alias, setAlias] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<AuthChoice>('agent');
  const [keyPath, setKeyPath] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [secret, setSecret] = useState('');
  const [remember, setRemember] = useState(true);
  const [tag, setTag] = useState('development');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!isOpen) dialog.current?.close();
  }, [isOpen]);

  function reset() {
    setAlias('');
    setHostname('');
    setUsername('');
    setKeyPath('');
    setPort('22');
    setAuthType('agent');
    setTag('development');
    setEncrypted(false);
    setSecret('');
    setRemember(true);
  }

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
    if (authType === 'password' && !secret.trim()) {
      setError('Enter the SSH password. It is stored in the OS keychain when Remember securely is on, never in the inventory database.');
      return;
    }
    if (authType === 'password' && !remember) {
      setError('Password login requires Remember securely. Without OS keychain storage KyvonOPS would have to keep the password in memory, which this build refuses.');
      return;
    }
    setSaving(true);
    setError('');
    const auth: AuthMethod =
      authType === 'agent'
        ? { type: 'agent' }
        : authType === 'password'
          ? { type: 'password' }
          : { type: 'private_key', path: keyPath.trim(), encrypted };
    try {
      await onSave({
        alias: alias.trim(),
        hostname: hostname.trim(),
        port: sshPort,
        username: username.trim(),
        tag,
        auth,
        secret: authType === 'agent' ? undefined : secret,
      });
      reset();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the server. Check the desktop connection and retry.');
    } finally {
      setSecret('');
      setSaving(false);
    }
  }

  const inputClass =
    'mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 text-white focus:outline focus:outline-2 focus:outline-info';

  return (
    <dialog
      ref={dialog}
      aria-labelledby="add-server-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 text-primary backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="add-server-title" className="text-xl font-semibold">
          Connect a VPS
        </h2>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Close add server" className="p-3">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-secondary">
        Saving writes the connection shape to this workstation. Passwords and key passphrases go to the OS keychain,
        never SQLite. Connecting later verifies the SSH host fingerprint before trusting the host.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4 text-sm">
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <label className="block">
            Server name
            <input className={inputClass} value={alias} onChange={(e) => setAlias(e.target.value)} required autoFocus autoComplete="off" />
          </label>
          <label className="block">
            Hostname or IP address
            <input
              className={inputClass}
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              SSH username
              <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
            </label>
            <label>
              SSH port
              <input
                className={inputClass}
                type="number"
                min="1"
                max="65535"
                step="1"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block">
            Environment
            <select className={inputClass} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </label>
          <label className="block">
            Authentication
            <select className={inputClass} value={authType} onChange={(e) => setAuthType(e.target.value as AuthChoice)}>
              <option value="agent">SSH agent on this workstation</option>
              <option value="private_key">Local private key file</option>
              <option value="password">SSH password (OS keychain)</option>
            </select>
          </label>
          {authType === 'private_key' && (
            <>
              <label className="block">
                Absolute key file path
                <input
                  className={inputClass}
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="/Users/you/.ssh/id_ed25519"
                />
              </label>
              <label className="flex items-center gap-2 text-secondary">
                <input type="checkbox" checked={encrypted} onChange={(e) => setEncrypted(e.target.checked)} />
                Key file is encrypted (passphrase)
              </label>
              {encrypted && (
                <label className="block">
                  Key passphrase
                  <input
                    className={inputClass}
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                </label>
              )}
            </>
          )}
          {authType === 'password' && (
            <>
              <label className="block">
                SSH password
                <input
                  className={inputClass}
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                  autoComplete="new-password"
                  spellCheck={false}
                />
              </label>
              <label className="flex items-start gap-2 text-xs leading-5 text-secondary">
                <input className="mt-0.5" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  Remember securely. Stored in your operating system’s credential storage (Keychain, Credential Manager, or
                  Secret Service). Never shown, copied, or written to SQLite.
                </span>
              </label>
            </>
          )}
          <p className="text-xs leading-5 text-secondary">
            There is no “show password” or “export key” action. Verify the host fingerprint when you Connect.
          </p>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button disabled={saving} type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-3">
            Cancel
          </button>
          <button
            disabled={saving}
            type="submit"
            className="rounded-lg bg-info px-4 py-3 font-semibold text-background disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save server profile'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
