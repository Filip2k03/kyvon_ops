import React, { useEffect, useState } from 'react';
import { 
  Sparkles, Key, Layout, Send, CheckCircle, AlertCircle, 
  ShieldCheck, Smartphone, Palette, Copy, RotateCcw,
  Sliders, Eye, Code2
} from 'lucide-react';
import { GeminiClient } from '../../lib/api/gemini';

export const GeminiOperations: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [sessionHeld, setSessionHeld] = useState(false);
  const [model, setModel] = useState<'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-2.0-flash'>('gemini-1.5-pro');
  const [focusArea, setFocusArea] = useState<'humanize' | 'icons' | 'mobile' | 'contrast'>('humanize');
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem('gemini_api_key');
    } catch {
      /* ignore */
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    setSessionHeld(true);
    setError(null);
  };

  const executeAnalysis = async (customPrompt?: string) => {
    const promptToRun = customPrompt || promptInput;
    if (!promptToRun.trim()) return;
    if (!apiKey.trim()) {
      setError('Please provide a Google Gemini API Key first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResponseOutput(null);

      const client = new GeminiClient(apiKey, model);
      const result = await client.auditUiUx({
        screenName: `KyvonOPS [${focusArea.toUpperCase()}] UI/UX Studio`,
        userFeedbackPrompt: promptToRun,
      });

      setResponseOutput(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gemini UI/UX analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!responseOutput) return;
    navigator.clipboard.writeText(responseOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Gemini 3.8 UI/UX Studio & Design Humanizer
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  UI/UX Exclusive
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Dedicated exclusively to Luxury Industrial design systems, Lucide icon harmony, mobile touch ergonomics, and WCAG AAA accessibility.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-info"
            >
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Design Reasoning)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen Rapid)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra-Fast)</option>
            </select>
          </div>
        </div>

        {/* API Key Configuration */}
        <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-secondary" />
            <input
              type="password"
              placeholder="Enter Google Gemini API Key (e.g. AIzaSy...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-secondary focus:outline-none focus:border-info"
            />
          </div>
          <button
            onClick={handleSaveKey}
            className="px-5 py-2 bg-info hover:bg-info/90 text-background font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{sessionHeld ? 'Held in this window' : 'Use in this window'}</span>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-secondary">
          The key stays in memory for this screen only. It is not written to disk, localStorage, or the OS keychain in this build. Closing the app forgets it.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Focus Area Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          onClick={() => { setFocusArea('humanize'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            focusArea === 'humanize'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Humanized Aesthetic & Polish</span>
        </button>

        <button
          onClick={() => { setFocusArea('icons'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            focusArea === 'icons'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Lucide Icon Harmonizer</span>
        </button>

        <button
          onClick={() => { setFocusArea('mobile'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            focusArea === 'mobile'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile Touch & Safe Area (.apk/.ipa)</span>
        </button>

        <button
          onClick={() => { setFocusArea('contrast'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            focusArea === 'contrast'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>WCAG AAA Contrast & Typography</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input & UI/UX Presets (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Layout className="w-4 h-4 text-cyan-400" />
              Design Studio Prompt & Component Directives
            </h2>

            <textarea
              rows={6}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Paste a component TSX snippet or describe the UI/UX challenge (e.g. improve table readability, mobile bottom sheet ergonomics, or button states)..."
              className="w-full bg-background border border-border rounded-lg p-3 text-xs text-white placeholder-secondary focus:outline-none focus:border-info"
            />

            <div className="mt-3 flex justify-between items-center">
              <button
                onClick={() => setPromptInput('')}
                className="text-xs text-secondary hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
              <button
                onClick={() => executeAnalysis()}
                disabled={loading || !promptInput.trim()}
                className="px-4 py-2 bg-info hover:bg-info/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Consulting Gemini UI/UX...' : 'Generate Design Directives'}</span>
              </button>
            </div>
          </div>

          {/* Quick UI/UX Presets */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Instant UI/UX Directives
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const p = "Review the entire navigation and button system. Replace any emoji or unstyled characters with Lucide React icons (stroke-width 1.75). Provide the exact JSX code.";
                  setPromptInput(p);
                  executeAnalysis(p);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  Lucide Icon System Audit (Stroke 1.75)
                </span>
              </button>

              <button
                onClick={() => {
                  const p = "Audit mobile ergonomics for Android APK and iOS IPA. Ensure all interactive tap targets are at least 48px × 48px and header/footer elements respect env(safe-area-inset-top) and env(safe-area-inset-bottom).";
                  setPromptInput(p);
                  executeAnalysis(p);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  Mobile Touch Targets & Safe-Area Insets
                </span>
              </button>

              <button
                onClick={() => {
                  const p = "Refactor the Outage Risk radar and Digital Twin topology card to follow the Luxury Industrial design language: obsidian background (#090a0f), subtle 1px border (#232738), and high-contrast typography (#f1f5f9).";
                  setPromptInput(p);
                  executeAnalysis(p);
                }}
                className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400 shrink-0" />
                  Luxury Industrial Dashboard Refactor
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Output Window (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-surface border border-border rounded-xl p-5 h-full flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Gemini UI/UX Architectural Output</h3>
              </div>
              {responseOutput && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1 px-3 py-1 bg-elevated hover:bg-hover border border-border rounded text-xs text-white transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy Recommendations'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-secondary space-y-3">
                  <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
                  <p className="text-xs">Gemini 3.8 synthesizing humanized UI/UX architecture...</p>
                </div>
              ) : responseOutput ? (
                <div className="prose prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans text-secondary bg-background/50 p-4 rounded-lg border border-border">
                  {responseOutput}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-secondary space-y-2">
                  <Palette className="w-8 h-8 text-secondary/40" />
                  <p className="text-xs">Select an instant directive on the left or paste your component code.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
