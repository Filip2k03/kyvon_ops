import React, { useState } from 'react';
import { 
  Apple, Monitor, Smartphone, Terminal, Heart,
  Sparkles, ShieldCheck, ArrowUpRight, Cpu, Layers,
  CreditCard, Check, Compass
} from 'lucide-react';
import { DONATION_TIERS, StripeClient } from '../../lib/api/stripe';
import { SponsorBanner } from '../../components/monetization/SponsorBanner';

export const DownloadPortal: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<number>(15);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [isProcessingStripe, setIsProcessingStripe] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedTier;

  const handleStripeDonate = async () => {
    if (activeAmount <= 0) return;
    try {
      setIsProcessingStripe(true);
      setCheckoutSuccess(null);

      const stripe = new StripeClient();
      const session = await stripe.createCheckoutSession({
        amountUsd: activeAmount,
        donorEmail: donorEmail || undefined,
        message: 'KyvonOPS 2.0 Open Source Sponsorship',
      });

      // Simulating or triggering real Stripe Checkout redirection
      window.open(session.checkoutUrl, '_blank');
      setCheckoutSuccess(`Stripe Checkout session initialized for $${activeAmount}. Thank you for supporting KyvonOPS!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Stripe checkout failed');
    } finally {
      setIsProcessingStripe(false);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* Hero Banner */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-info/10 border border-info/20 text-info text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>KyvonOPS 2.0 Production Distribution Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Zero SaaS. Encrypted SSH. Infinite Scale.
        </h1>
        <p className="text-sm text-secondary max-w-2xl mx-auto">
          Download native binaries for your operating system or compile mobile builds for remote fleet management from anywhere.
        </p>
      </div>

      {/* Platform availability: only link artifacts that actually exist. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[{
          name: 'macOS',
          icon: <Apple className="w-6 h-6" aria-hidden="true" />,
          badge: 'Not published',
          description: 'A signed macOS installer is not published yet. Check the release page for verified artifacts.',
        }, {
          name: 'Windows',
          icon: <Monitor className="w-6 h-6" aria-hidden="true" />,
          badge: 'Not published',
          description: 'A signed Windows installer is not published yet. Check the release page for verified artifacts.',
        }, {
          name: 'Linux',
          icon: <Terminal className="w-6 h-6" aria-hidden="true" />,
          badge: 'Source available',
          description: 'Build from the repository with the documented source-workspace checks while release packaging is completed.',
        }, {
          name: 'Mobile',
          icon: <Smartphone className="w-6 h-6" aria-hidden="true" />,
          badge: 'Not published',
          description: 'No verified Android or iOS package is published for V4.1.',
        }].map((platform) => (
        <div key={platform.name} className="bg-surface border border-border rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-neutral-800 rounded-lg text-white">
                {platform.icon}
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-secondary">{platform.badge}</span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">{platform.name}</h3>
            <p className="text-xs text-secondary mb-4">{platform.description}</p>
          </div>
          <div className="space-y-2">
            <a href="https://github.com/Filip2k03/kyvon_ops/releases" target="_blank" rel="noreferrer" className="w-full py-2 bg-info hover:bg-info/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>View verified releases</span>
            </a>
          </div>
        </div>
        ))}
      </div>

      {/* Stripe Donation & Community Sponsorship Section */}
      <div className="bg-surface border border-border rounded-xl p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left: Sponsorship Overview */}
          <div className="lg:w-5/12 space-y-4">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>Fuel Sovereign Open Source</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Support KyvonOPS Development via Stripe
            </h2>
            <p className="text-xs text-secondary leading-relaxed">
              KyvonOPS is 100% free from centralized SaaS telemetry traps. Your support funds multi-kernel testing, Musl static agent toolchains, and continuous Model Context Protocol (MCP) security gate updates.
            </p>

            <div className="space-y-2 pt-2 text-xs text-secondary">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No advertising scripts in the operational workspace</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>100% open-source local-first SQLite & Rust architecture</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Transparent Stripe billing with instant receipt & perks</span>
              </div>
            </div>
          </div>

          {/* Right: Stripe Donation Widget */}
          <div className="lg:w-7/12 w-full bg-background border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-info" />
              Select Donation Tier
            </h3>

            {/* Presets Grid: $5, $10, $15, $25 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {DONATION_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => {
                    setSelectedTier(tier.amount);
                    setCustomAmount('');
                  }}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedTier === tier.amount && !customAmount
                      ? 'bg-info/20 border-info text-info ring-1 ring-info'
                      : 'bg-surface border-border text-secondary hover:text-white hover:border-border/80'
                  }`}
                >
                  <div className="text-lg font-black text-white">${tier.amount}</div>
                  <div className="text-[11px] font-semibold mt-0.5">{tier.name}</div>
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="mb-5">
              <label className="block text-xs text-secondary mb-1.5">Or enter a custom donation amount ($ USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-white font-bold text-sm">$</span>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedTier(0);
                  }}
                  className="w-full bg-surface border border-border rounded-lg pl-8 pr-4 py-2 text-sm text-white font-bold placeholder-secondary focus:outline-none focus:border-info"
                />
              </div>
            </div>

            {/* Optional Donor Email */}
            <div className="mb-5">
              <label className="block text-xs text-secondary mb-1.5">Receipt Email (Optional for Stripe invoice)</label>
              <input
                type="email"
                placeholder="developer@example.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-secondary focus:outline-none focus:border-info"
              />
            </div>

            {/* Selected Tier Perk Summary */}
            <div className="p-3 bg-surface border border-border rounded-lg text-xs mb-5 text-secondary">
              <span className="text-white font-semibold">Selected Sponsor Impact: </span>
              {customAmount && parseFloat(customAmount) > 0
                ? `Custom sponsorship of $${customAmount}. Thank you for powering autonomous infrastructure!`
                : DONATION_TIERS.find((t) => t.amount === selectedTier)?.description}
            </div>

            {/* Stripe Trigger Button */}
            <button
              onClick={handleStripeDonate}
              disabled={isProcessingStripe || activeAmount <= 0}
              className="w-full py-3 bg-rose-500 hover:bg-rose-500/90 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-rose-500/10 disabled:opacity-50"
            >
              <Heart className="w-4 h-4 fill-current" />
              <span>
                {isProcessingStripe ? 'Opening Stripe Checkout...' : `Donate $${activeAmount} via Stripe`}
              </span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            {checkoutSuccess && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{checkoutSuccess}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <SponsorBanner placement="downloads" />

      {/* Deep Thinking: Developer Architecture & Operating Directives */}
      <div className="bg-surface border border-border rounded-xl p-8 shadow-sm space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-info/10 border border-info/20 rounded-lg text-info">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Engineering Directives & Deep-Thinking Architectural Insights
            </h2>
            <p className="text-xs text-secondary">
              Sovereign paradigms recommended for engineers expanding and maintaining KyvonOPS 2.0.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          <div className="p-4 bg-background border border-border rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-info text-xs font-bold">
              <Cpu className="w-4 h-4" />
              <span>Zero-Fork Syscall Telemetry</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Never execute shell commands like `top` or `ps` in high-frequency monitoring loops. Parsing `/proc` directly via Musl static daemons saves up to 15% host CPU overhead and avoids fork-bomb saturation.
            </p>
          </div>

          <div className="p-4 bg-background border border-border rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Agent Asymmetry Invariant</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              External language models (Codex Astra, Claude Opus, Agy Gemini 3.8) must never receive private keys or passwords. They operate through typed, schema-validated MCP tools governed by human-in-the-loop approval gates.
            </p>
          </div>

          <div className="p-4 bg-background border border-border rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
              <Layers className="w-4 h-4" />
              <span>Causal Topology Graph</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Correlate Ingress (Cloudflare & Nginx) to physical hardware through cgroups v2 slices. Knowing which domain triggers memory stalls turns hours of debugging into a 30-second root cause diagnosis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
