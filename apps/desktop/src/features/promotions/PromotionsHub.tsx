import React, { useState } from 'react';
import {
  Share2, ExternalLink, Copy, Check, Heart, Sparkles,
  Globe, MessageSquare, Send,
  TrendingUp, Award, Code2, DollarSign
} from 'lucide-react';

export const PromotionsHub: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedDonationAmount, setSelectedDonationAmount] = useState<number>(15);
  const [customDonation, setCustomDonation] = useState<string>('');

  const targetUrl = 'https://kyvonops.sys.thuyakyaw.com';
  const repoUrl = 'https://github.com/Filip2k03/kyvon_ops';

  const sharePayloads = {
    twitter: {
      name: 'X (Twitter)',
      color: 'bg-black text-white hover:bg-neutral-800 border-neutral-700',
      intent: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        'Check out KyvonOPS V3.0: Sovereign local-first DevOps control plane & zero-secret MCP AI operations for Linux VPS & Cloud!'
      )}&url=${encodeURIComponent(targetUrl)}&hashtags=DevOps,Rust,Docker,Cloudflare,OpenSource`,
    },
    linkedin: {
      name: 'LinkedIn',
      color: 'bg-[#0A66C2] text-white hover:bg-[#084d91] border-transparent',
      intent: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(targetUrl)}`,
    },
    reddit: {
      name: 'Reddit',
      color: 'bg-[#FF4500] text-white hover:bg-[#d63800] border-transparent',
      intent: `https://reddit.com/submit?title=${encodeURIComponent(
        'KyvonOPS – Local-first, zero-secret DevOps control plane & AI operations platform (Rust + Tauri + MCP)'
      )}&url=${encodeURIComponent(targetUrl)}`,
    },
    hackernews: {
      name: 'Hacker News',
      color: 'bg-[#ff6600] text-white hover:bg-[#e05800] border-transparent',
      intent: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(
        targetUrl
      )}&t=${encodeURIComponent('Show HN: KyvonOPS – Sovereign Local-First DevOps Control Plane for VPS & Cloud')}`,
    },
    telegram: {
      name: 'Telegram',
      color: 'bg-[#229ED9] text-white hover:bg-[#1d89be] border-transparent',
      intent: `https://t.me/share/url?url=${encodeURIComponent(targetUrl)}&text=${encodeURIComponent(
        'KyvonOPS V3.0 — Sovereign DevOps Intelligence & AI Operations'
      )}`,
    },
    bluesky: {
      name: 'Bluesky',
      color: 'bg-[#0085ff] text-white hover:bg-[#006fd6] border-transparent',
      intent: `https://bsky.app/intent/compose?text=${encodeURIComponent(
        `KyvonOPS V3.0: Sovereign local-first DevOps control plane and zero-secret MCP AI gateway for VPS & Cloud. ${targetUrl}`
      )}`,
    },
    whatsapp: {
      name: 'WhatsApp',
      color: 'bg-[#25D366] text-white hover:bg-[#20b858] border-transparent',
      intent: `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `KyvonOPS V3.0: Sovereign DevOps Control Plane & AI Operations: ${targetUrl}`
      )}`,
    },
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const openShareIntent = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg text-pink-400">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Promotions & Social Distribution Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  Zero-Login Marketing
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Broadcast KyvonOPS across non-login social networks, copy launch kits, and support development via Stripe.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-info/10 text-info border border-info/20 text-xs font-bold hover:bg-info/20 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Visit kyvonops.sys.thuyakyaw.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Social Sharing & Live OpenGraph Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Instant 1-Click Non-Login Sharing Intents (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Share Buttons */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              1-Click Non-Login Social Intents (Opens in Browser)
            </h2>
            <p className="text-xs text-secondary mb-4">
              Click any network to open a pre-filled, high-converting post in Chrome without requiring API authorization.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Object.entries(sharePayloads).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => openShareIntent(item.intent)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all shadow-sm ${item.color}`}
                >
                  <div className="flex items-center space-x-2">
                    <Send className="w-3.5 h-3.5" />
                    <span>{item.name}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </button>
              ))}
            </div>
          </div>

          {/* Marketing Copy Kits */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              Pre-Crafted Launch Packages (1-Click Copy)
            </h2>

            {/* Hacker News Package */}
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Hacker News "Show HN" Thread
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `Show HN: KyvonOPS – Sovereign Local-First DevOps Control Plane for VPS & Cloud\n\n` +
                    `We built KyvonOPS because managing modern VPS clusters usually forces an uncomfortable trade-off: either surrender your SSH credentials to centralized SaaS dashboards, or manually piece together terminal scripts.\n\n` +
                    `KyvonOPS is a sovereign, local-first DevOps control plane built with Rust, Tauri 2, React/TypeScript, SQLite, and an MCP gateway.\n\n` +
                    `Key Features:\n` +
                    `• One VPS -> Full Digital Twin Topology (Nginx, Docker, systemd, sockets)\n` +
                    `• Domain Resource Attribution & Outage Risk Forecasting\n` +
                    `• Zero-Secret MCP Gateway for Claude Code, Cursor, and Codex\n` +
                    `• Mobile Command Companion (Android APK / iOS IPA) with Biometrics\n` +
                    `• Cloudflare Free Tier Tunnel Ingress\n\n` +
                    `Live Deployment: ${targetUrl}\nGitHub: ${repoUrl}`,
                    'hn'
                  )}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-elevated border border-border text-white hover:text-cyan-400 transition-colors"
                >
                  {copiedKey === 'hn' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'hn' ? 'Copied' : 'Copy HN Post'}</span>
                </button>
              </div>
              <p className="text-xs text-secondary line-clamp-2">
                Show HN: KyvonOPS – Sovereign Local-First DevOps Control Plane for VPS & Cloud (Rust + Tauri + MCP)...
              </p>
            </div>

            {/* Markdown Badge Kit */}
            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> README Badges & Embed Links
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `[![KyvonOPS](https://img.shields.io/badge/Powered%20by-KyvonOPS%20V3.0-blue.svg)](${targetUrl})`,
                    'badge'
                  )}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-elevated border border-border text-white hover:text-indigo-400 transition-colors"
                >
                  {copiedKey === 'badge' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'badge' ? 'Copied' : 'Copy Badge'}</span>
                </button>
              </div>
              <code className="block bg-black/50 p-2 rounded text-[11px] font-mono text-emerald-400 truncate">
                {`[![KyvonOPS](https://img.shields.io/badge/Powered%20by-KyvonOPS%20V3.0-blue.svg)](${targetUrl})`}
              </code>
            </div>
          </div>
        </div>

        {/* Right Column: Live OpenGraph Card Preview & Stripe Donation (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Social Card Preview */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Live OpenGraph Preview Card
            </h2>
            <p className="text-xs text-secondary">
              Real-time rendering of the social card displayed on Twitter, LinkedIn, and Discord.
            </p>

            <div className="border border-border rounded-xl overflow-hidden bg-background shadow-md">
              <div className="h-32 bg-gradient-to-br from-indigo-900 via-neutral-900 to-black p-4 flex flex-col justify-between border-b border-border">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-extrabold tracking-tight text-white text-xs">KYVONOPS V3.0</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sovereign DevOps Control Plane</h3>
                  <p className="text-[11px] text-neutral-400">Digital Twin Topology • Zero-Secret MCP Gateway</p>
                </div>
              </div>
              <div className="p-3.5 space-y-1">
                <div className="text-[10px] text-secondary font-mono uppercase">kyvonops.sys.thuyakyaw.com</div>
                <div className="text-xs font-bold text-white">
                  KyvonOPS — Sovereign DevOps Control Plane & AI Operations
                </div>
                <p className="text-[11px] text-secondary line-clamp-2">
                  One VPS → Discover everything. Zero-secret exposure AI MCP gateway, digital twin topology, capacity forecasting, and mobile companion.
                </p>
              </div>
            </div>
          </div>

          {/* Stripe Donation & Sponsorship Column */}
          <div className="bg-gradient-to-br from-surface to-elevated border border-emerald-500/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sponsor KyvonOPS</h3>
                  <p className="text-[11px] text-secondary">Powered by Stripe Secure Checkout</p>
                </div>
              </div>
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />
            </div>

            <p className="text-xs text-secondary">
              Support open-source, sovereign infrastructure tooling. Donations go directly toward server testing and cross-platform build servers.
            </p>

            {/* Donation Amount Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 25].map(amt => (
                <button
                  key={amt}
                  onClick={() => {
                    setSelectedDonationAmount(amt);
                    setCustomDonation('');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    selectedDonationAmount === amt && !customDonation
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-surface border border-border text-secondary hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-secondary text-xs">$</span>
              <input
                type="number"
                value={customDonation}
                onChange={e => {
                  setCustomDonation(e.target.value);
                  setSelectedDonationAmount(0);
                }}
                placeholder="Custom donation amount..."
                className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-secondary focus:outline-none focus:border-emerald-500"
              />
            </div>

            <a
              href={`https://donate.stripe.com/test_kyvonops?amount=${customDonation || selectedDonationAmount}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md"
            >
              <Heart className="w-4 h-4 text-white fill-white" />
              <span>Donate ${customDonation || selectedDonationAmount} with Stripe</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
