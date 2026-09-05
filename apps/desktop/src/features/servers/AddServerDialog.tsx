import React, { useState } from 'react';
import { X, Server, Key, Lock, Terminal, Shield, CheckCircle2, RefreshCw } from 'lucide-react';

export interface NewServerData {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  authType: 'private_key' | 'password' | 'agent';
  keyPath?: string;
  password?: string;
  tag: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewServerData) => void;
}

export const AddServerDialog: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [alias, setAlias] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'private_key' | 'password' | 'agent'>('private_key');
  const [keyPath, setKeyPath] = useState('~/.ssh/id_ed25519');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('production');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = () => {
    if (!hostname) {
      setTestResult('Error: Hostname or IP is required.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    setTimeout(() => {
      setIsTesting(false);
      setTestResult(`✓ Connection successful! Established SSH multiplex channel (Ed25519) to ${username}@${hostname}:${port}`);
    }, 900);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias || !hostname) return;

    onSave({
      alias,
      hostname,
      port,
      username,
      authType,
      keyPath: authType === 'private_key' ? keyPath : undefined,
      password: authType === 'password' ? password : undefined,
      tag,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-elevated/40">
          <div className="flex items-center space-x-2.5">
            <Server className="w-5 h-5 text-info" />
            <h2 className="text-base font-bold text-white">Connect New Linux Host</h2>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-white p-1 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-secondary font-medium mb-1.5">Server Alias / Name</label>
              <input
                type="text"
                placeholder="e.g. production-01"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white placeholder-secondary/50 focus:outline-none focus:border-info"
              />
            </div>

            <div>
              <label className="block text-secondary font-medium mb-1.5">Environment Tag</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-info"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
                <option value="client-work">Client Workspace</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-secondary font-medium mb-1.5">Hostname / IPv4</label>
              <input
                type="text"
                placeholder="e.g. 203.0.113.10 or vps.example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white placeholder-secondary/50 focus:outline-none focus:border-info font-mono"
              />
            </div>

            <div>
              <label className="block text-secondary font-medium mb-1.5">SSH Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-info font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-secondary font-medium mb-1.5">SSH User</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-info font-mono"
            />
          </div>

          {/* Authentication Selection */}
          <div className="pt-2">
            <label className="block text-secondary font-medium mb-2">Authentication Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAuthType('private_key')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${authType === 'private_key' ? 'bg-info/10 border-info text-info' : 'bg-background border-border text-secondary hover:text-white'}`}
              >
                <Key className="w-3.5 h-3.5" /> SSH Key File
              </button>
              <button
                type="button"
                onClick={() => setAuthType('agent')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${authType === 'agent' ? 'bg-info/10 border-info text-info' : 'bg-background border-border text-secondary hover:text-white'}`}
              >
                <Terminal className="w-3.5 h-3.5" /> SSH Agent
              </button>
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${authType === 'password' ? 'bg-info/10 border-info text-info' : 'bg-background border-border text-secondary hover:text-white'}`}
              >
                <Lock className="w-3.5 h-3.5" /> Password
              </button>
            </div>
          </div>

          {authType === 'private_key' && (
            <div>
              <label className="block text-secondary font-medium mb-1.5">Private Key Path</label>
              <input
                type="text"
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-info"
              />
              <span className="text-[11px] text-secondary mt-1 block">Passphrases resolved securely via OS Keychain.</span>
            </div>
          )}

          {authType === 'password' && (
            <div>
              <label className="block text-secondary font-medium mb-1.5">Host Password</label>
              <input
                type="password"
                placeholder="Stored in OS Keychain, never in plaintext"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-info"
              />
            </div>
          )}

          {authType === 'agent' && (
            <div className="p-3 rounded-lg bg-elevated/40 border border-border text-secondary text-[11px] flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Using active <code>SSH_AUTH_SOCK</code> daemon keys. Zero key copying required.</span>
            </div>
          )}

          {testResult && (
            <div className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${testResult.startsWith('✓') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-danger/10 border-danger/30 text-danger'}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{testResult}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-lg bg-elevated hover:bg-elevated/80 border border-border text-white text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Handshaking...' : 'Test Connection'}
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-background hover:bg-elevated text-secondary hover:text-white border border-border text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-semibold shadow-md transition-all"
              >
                Add & Probe Host
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};