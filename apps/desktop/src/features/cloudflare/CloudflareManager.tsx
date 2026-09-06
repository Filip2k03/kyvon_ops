import React, { useState, useEffect, useCallback } from 'react';
import { 
  Globe, Shield, RefreshCw, Plus, Trash2, Key, CheckCircle, AlertCircle, 
  Server, Terminal, Lock, Flame, Radio, Zap, Copy
} from 'lucide-react';
import { CloudflareClient } from '../../lib/api/cloudflare';
import { CloudflareZone, CloudflareDnsRecord, CloudflareSslSetting } from '../../lib/api/types';
import { ReverseProxyGenerator } from '../../lib/api/reverseProxy';
import { CloudflareTunnelGenerator } from '../../lib/api/cloudflareTunnel';

export const CloudflareManager: React.FC = () => {
  const [apiToken, setApiToken] = useState('');
  const [isSavedToken, setIsSavedToken] = useState(false);
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [dnsRecords, setDnsRecords] = useState<CloudflareDnsRecord[]>([]);
  const [sslSetting, setSslSetting] = useState<CloudflareSslSetting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New DNS Record Modal / Form State
  const [newRecord, setNewRecord] = useState<{
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
    name: string;
    content: string;
    proxied: boolean;
    ttl: number;
  }>({
    type: 'A',
    name: '',
    content: '',
    proxied: true,
    ttl: 1, // Auto
  });

  // Reverse Proxy Generator State
  const [proxyTarget, setProxyTarget] = useState('');
  const [proxyDomain, setProxyDomain] = useState('');
  const [generatedProxyType, setGeneratedProxyType] = useState<'caddy' | 'nginx'>('caddy');
  const [generatedConfig, setGeneratedConfig] = useState('');

  // Cloudflare Free Plan Tunnel State
  const [tunnelId, setTunnelId] = useState('');
  const [tunnelToken, setTunnelToken] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'dns' | 'tunnel' | 'proxy'>('dns');
  const [generatedTunnelScript, setGeneratedTunnelScript] = useState('');

  useEffect(() => {
    try {
      localStorage.removeItem('cf_api_token');
    } catch {
      /* ignore */
    }
  }, []);

  const handleSaveToken = () => {
    if (!apiToken.trim()) return;
    setIsSavedToken(true);
    setSuccessMsg('Token held in this window only. It is not written to disk.');
    fetchZones(apiToken.trim());
  };

  const fetchZones = useCallback(async (token: string) => {
    try {
      setLoading(true);
      setError(null);
      const client = new CloudflareClient(token);
      const fetchedZones = await client.listZones();
      setZones(fetchedZones);
      if (fetchedZones.length > 0 && !selectedZone) {
        setSelectedZone(fetchedZones[0].id);
        setProxyDomain(fetchedZones[0].name);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zones');
    } finally {
      setLoading(false);
    }
  }, [selectedZone]);

  const loadZoneDetails = useCallback(async (zoneId: string) => {
    if (!apiToken || !zoneId) return;
    try {
      setLoading(true);
      setError(null);
      const client = new CloudflareClient(apiToken);
      const [records, ssl] = await Promise.all([
        client.listDnsRecords(zoneId),
        client.getSslSetting(zoneId).catch(() => null),
      ]);
      setDnsRecords(records);
      setSslSetting(ssl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load DNS records');
    } finally {
      setLoading(false);
    }
  }, [apiToken]);

  useEffect(() => {
    if (isSavedToken && apiToken) {
      fetchZones(apiToken);
    }
  }, [isSavedToken, apiToken, fetchZones]);

  useEffect(() => {
    if (selectedZone) {
      loadZoneDetails(selectedZone);
      const z = zones.find(item => item.id === selectedZone);
      if (z) setProxyDomain(z.name);
    }
  }, [selectedZone, loadZoneDetails, zones]);

  const handleCreateDns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !newRecord.name || !newRecord.content) return;
    try {
      setLoading(true);
      const client = new CloudflareClient(apiToken);
      await client.createDnsRecord(selectedZone, newRecord);
      setSuccessMsg(`Created ${newRecord.type} record for ${newRecord.name}`);
      setNewRecord({ type: 'A', name: '', content: '', proxied: true, ttl: 1 });
      await loadZoneDetails(selectedZone);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create DNS record');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDns = async (recordId: string, recordName: string) => {
    if (!confirm(`Are you sure you want to delete DNS record for ${recordName}?`)) return;
    try {
      setLoading(true);
      const client = new CloudflareClient(apiToken);
      await client.deleteDnsRecord(selectedZone, recordId);
      setSuccessMsg(`Deleted DNS record ${recordName}`);
      await loadZoneDetails(selectedZone);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete DNS record');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSslMode = async (mode: 'off' | 'flexible' | 'full' | 'strict') => {
    if (!selectedZone) return;
    try {
      setLoading(true);
      const client = new CloudflareClient(apiToken);
      const res = await client.updateSslMode(selectedZone, mode);
      setSslSetting(res);
      setSuccessMsg(`Updated SSL/TLS mode to ${mode.toUpperCase()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update SSL mode');
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!selectedZone) return;
    try {
      setLoading(true);
      const client = new CloudflareClient(apiToken);
      await client.purgeCache(selectedZone, { purge_everything: true });
      setSuccessMsg('Successfully purged all edge cache for this zone.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to purge cache');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProxy = () => {
    if (!proxyDomain.trim() || !proxyTarget.trim()) {
      setError('Enter the public hostname and the private origin address before generating a proxy config.');
      return;
    }
    const config = generatedProxyType === 'caddy'
      ? ReverseProxyGenerator.generateCaddyfile({
          domain: proxyDomain.trim(),
          upstreamUrl: proxyTarget.trim(),
          enableWebsockets: true,
          enableGzip: true,
          sslMode: 'letsencrypt',
        })
      : ReverseProxyGenerator.generateNginxConfig({
          domain: proxyDomain.trim(),
          upstreamUrl: proxyTarget.trim(),
          enableWebsockets: true,
          enableGzip: true,
          sslMode: 'letsencrypt',
        });
    setGeneratedConfig(config);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Cloudflare Edge & Reverse Proxy Controller
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Production API v4
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Manage live DNS records, Edge SSL/TLS encryption, and generate hardened Caddy/Nginx reverse proxy configurations.
              </p>
            </div>
          </div>
          <button
            onClick={() => selectedZone && loadZoneDetails(selectedZone)}
            disabled={loading || !apiToken}
            className="flex items-center space-x-2 px-4 py-2 bg-elevated hover:bg-hover border border-border text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Cloudflare</span>
          </button>
        </div>

        {/* API Token Input */}
        <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-secondary" />
            <input
              type="password"
              placeholder="Paste Cloudflare API Token (Permissions: Zone.DNS, Zone.SSL)"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-secondary focus:outline-none focus:border-info"
            />
          </div>
          <button
            onClick={handleSaveToken}
            className="px-5 py-2 bg-info hover:bg-info/90 text-background font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Connect Token</span>
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Zone Selector & SSL / Cache Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Zone Selector */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
            Select Active Zone (Domain)
          </label>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            disabled={zones.length === 0}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-info"
          >
            {zones.length === 0 ? (
              <option value="">No zones loaded. Provide API token.</option>
            ) : (
              zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} ({zone.status})
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-secondary mt-2">
            Found {zones.length} active domain zones on this Cloudflare account.
          </p>
        </div>

        {/* SSL/TLS Mode */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-info" />
            Edge SSL / TLS Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['flexible', 'full', 'strict', 'off'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleUpdateSslMode(mode)}
                disabled={!selectedZone || loading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                  sslSetting?.value === mode
                    ? 'bg-info/20 border-info text-info font-bold'
                    : 'bg-background border-border text-secondary hover:text-white'
                }`}
              >
                {mode === 'strict' ? 'Full (Strict)' : mode}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary mt-2">
            Current: <span className="text-white font-medium capitalize">{sslSetting?.value || 'Loading...'}</span>
          </p>
        </div>

        {/* Quick Edge Actions */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Edge Cache Management
            </label>
            <p className="text-xs text-secondary">
              Instantly purge stale edge assets across global Cloudflare Points of Presence (PoPs).
            </p>
          </div>
          <button
            onClick={handlePurgeCache}
            disabled={!selectedZone || loading}
            className="mt-3 w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <Flame className="w-4 h-4" />
            <span>Purge Everything</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveSubTab('dns')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeSubTab === 'dns'
              ? 'bg-info/20 text-info border border-info/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Edge DNS & CDN Shield</span>
        </button>
        <button
          onClick={() => setActiveSubTab('tunnel')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeSubTab === 'tunnel'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Free Plan Tunnel (Zero Open Ports)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('proxy')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeSubTab === 'proxy'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Hardened Caddy / Nginx</span>
        </button>
      </div>

      {/* Conditional Content Based on Active SubTab */}
      {activeSubTab === 'dns' && (
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-info" />
            <h2 className="text-base font-bold text-white">Live Cloudflare DNS Records</h2>
            <span className="text-xs bg-elevated px-2 py-0.5 rounded text-secondary">
              {dnsRecords.length} records
            </span>
          </div>
        </div>

        {/* New Record Inline Creator */}
        <form onSubmit={handleCreateDns} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 p-4 bg-background border border-border rounded-lg">
          <div>
            <label className="block text-xs text-secondary mb-1">Type</label>
            <select
              value={newRecord.type}
              onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as 'A' | 'AAAA' | 'CNAME' | 'TXT' })}
              className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs text-white"
            >
              <option value="A">A (IPv4)</option>
              <option value="AAAA">AAAA (IPv6)</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-secondary mb-1">Name / Subdomain</label>
            <input
              type="text"
              placeholder="e.g. api or @"
              value={newRecord.name}
              onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
              className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs text-white"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-secondary mb-1">Target Content / IP</label>
            <input
              type="text"
              placeholder="e.g. 198.51.100.24"
              value={newRecord.content}
              onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
              className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs text-white"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !selectedZone}
              className="w-full py-1.5 bg-info hover:bg-info/90 text-background font-bold text-xs rounded transition-colors flex items-center justify-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
          </div>
        </form>

        {/* DNS Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-secondary border-collapse">
            <thead>
              <tr className="border-b border-border text-white font-semibold">
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Content</th>
                <th className="py-2.5 px-3">Proxy Status</th>
                <th className="py-2.5 px-3">TTL</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dnsRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-secondary">
                    No DNS records found for this zone.
                  </td>
                </tr>
              ) : (
                dnsRecords.map((rec) => (
                  <tr key={rec.id || rec.name} className="hover:bg-elevated/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-info font-bold">{rec.type}</td>
                    <td className="py-2.5 px-3 font-mono text-white">{rec.name}</td>
                    <td className="py-2.5 px-3 font-mono text-white/80 max-w-xs truncate">{rec.content}</td>
                    <td className="py-2.5 px-3">
                      {rec.proxied ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Proxied (CDN)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-secondary">
                          DNS Only
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">{rec.ttl === 1 ? 'Auto' : `${rec.ttl}s`}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => rec.id && handleDeleteDns(rec.id, rec.name)}
                        className="p-1 text-secondary hover:text-rose-400 transition-colors rounded hover:bg-rose-500/10"
                        title="Delete DNS Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Free Plan Cloudflare Tunnels (Zero Open Ports) Sub-Tab */}
      {activeSubTab === 'tunnel' && (
      <div className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Cloudflare Free Tier Tunnel Provisioner (Zero Inbound Ports)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  100% Free Plan Supported
                </span>
              </h2>
              <p className="text-xs text-secondary">
                No public IPv4 required, no firewall ports open (port 80/443 closed). The VPS establishes an outbound multiplexed QUIC tunnel to Cloudflare Edge.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pt-3">
            <div>
              <label className="block text-xs text-secondary mb-1">Tunnel Name</label>
              <input
                type="text"
                value={tunnelId}
                onChange={(e) => setTunnelId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">Target Public Hostname</label>
              <input
                type="text"
                value={proxyDomain}
                onChange={(e) => setProxyDomain(e.target.value)}
                placeholder="app.example.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">VPS Local Port/Socket</label>
              <input
                type="text"
                value={proxyTarget}
                onChange={(e) => setProxyTarget(e.target.value)}
                placeholder="private origin on the VPS (loopback or unix socket)"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-secondary mb-1">Cloudflare Tunnel Token (from Zero Trust Dashboard)</label>
            <input
              type="password"
              value={tunnelToken}
              onChange={(e) => setTunnelToken(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                if (!tunnelId.trim() || !proxyDomain.trim() || !proxyTarget.trim() || !tunnelToken.trim()) {
                  setError('Tunnel name, public hostname, private origin, and tunnel token are required. No placeholder token is shipped.');
                  return;
                }
                const script = CloudflareTunnelGenerator.generateDeploymentScript({
                  tunnelId: tunnelId.trim(),
                  tunnelName: tunnelId.trim(),
                  accountTag: 'free_tier',
                  domain: proxyDomain.trim(),
                  localService: proxyTarget.trim(),
                }, tunnelToken.trim());
                setGeneratedTunnelScript(script);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-500/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Generate One-Click Linux Installer Script</span>
            </button>
          </div>

          {generatedTunnelScript && (
            <div className="relative">
              <pre className="p-4 bg-background border border-border rounded-lg text-xs font-mono text-amber-300 overflow-x-auto max-h-80">
                {generatedTunnelScript}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedTunnelScript);
                  setSuccessMsg('Deployment script copied to clipboard! Paste into your VPS terminal.');
                }}
                className="absolute top-3 right-3 px-3 py-1 bg-surface border border-border rounded text-[11px] text-white hover:bg-elevated transition-colors flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Script</span>
              </button>
            </div>
          )}
        </div>

        {/* Free Plan Best Practices Checklist */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Cloudflare Free Plan Full Security Checklist
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">1. Universal SSL / Full Strict</span>
              <p className="text-secondary text-[11px]">Enforce end-to-end encryption with Cloudflare Origin CA certificate.</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">2. Bot Fight Mode (Free)</span>
              <p className="text-secondary text-[11px]">Blocks automated crawlers, scrapers, and malicious request bursts.</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">3. HTTP/3 with QUIC & 0-RTT</span>
              <p className="text-secondary text-[11px]">Enables zero-latency roundtrips and connection resumption for mobile.</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">4. Brotli Compression (Free)</span>
              <p className="text-secondary text-[11px]">Reduces text asset payload size by up to 20% compared to standard gzip.</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">5. Always Use HTTPS</span>
              <p className="text-secondary text-[11px]">Redirects all plain HTTP port 80 requests to secure port 443 at the edge.</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg space-y-1">
              <span className="font-bold text-white">6. Zero-Trust Tunnel Access</span>
              <p className="text-secondary text-[11px]">Safeguards internal admin dashboards behind Cloudflare Access 2FA login.</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Reverse Proxy Config Generator */}
      {activeSubTab === 'proxy' && (
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Ingress Reverse Proxy Generator (Caddy / Nginx)</h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setGeneratedProxyType('caddy')}
              className={`px-3 py-1 rounded text-xs font-semibold border ${
                generatedProxyType === 'caddy'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-background border-border text-secondary'
              }`}
            >
              Caddyfile
            </button>
            <button
              onClick={() => setGeneratedProxyType('nginx')}
              className={`px-3 py-1 rounded text-xs font-semibold border ${
                generatedProxyType === 'nginx'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-background border-border text-secondary'
              }`}
            >
              Nginx
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-secondary mb-1">Public Domain (Routed from Cloudflare)</label>
            <input
              type="text"
              value={proxyDomain}
              onChange={(e) => setProxyDomain(e.target.value)}
              placeholder="api.example.com"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">VPS Upstream Socket / Port</label>
            <input
              type="text"
              value={proxyTarget}
              onChange={(e) => setProxyTarget(e.target.value)}
              placeholder="private origin hostname:port or unix socket"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateProxy}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-500/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center space-x-2 mb-4"
        >
          <Terminal className="w-4 h-4" />
          <span>Generate Hardened {generatedProxyType.toUpperCase()} Config</span>
        </button>

        {generatedConfig && (
          <div className="relative">
            <pre className="p-4 bg-background border border-border rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto">
              {generatedConfig}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedConfig);
                setSuccessMsg('Configuration copied to clipboard!');
              }}
              className="absolute top-3 right-3 px-3 py-1 bg-surface border border-border rounded text-[11px] text-white hover:bg-elevated transition-colors"
            >
              Copy
            </button>
            </div>
        )}
      </div>
      )}
    </div>
  );
};
