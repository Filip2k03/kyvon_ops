import React, { useState } from 'react';
import { 
  Sparkles, Key, Layout, Activity, Send, CheckCircle, AlertCircle, 
  Terminal, ShieldCheck, Cpu, Smartphone, Palette, Copy, RotateCcw
} from 'lucide-react';
import { GeminiClient } from '../../lib/api/gemini';

export const GeminiOperations: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [model, setModel] = useState<'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash'>('gemini-1.5-flash');
  const [activeTab, setActiveTab] = useState<'uiux' | 'devops'>('uiux');
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem('gemini_api_key', apiKey.trim());
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

      let result = '';
      if (activeTab === 'uiux') {
        result = await client.auditUiUx({
          screenName: 'KyvonOPS Production Dashboard',
          userFeedbackPrompt: promptToRun,
        });
      } else {
        result = await client.triageDevOpsIncident({
          serverAlias: 'prod-fra-01',
          riskScore: 78,
          activeAnomalies: ['Kernel Memory PSI stall avg10 > 15.0', 'Nginx 502 Upstream Gateway Timeout'],
          recentLogsExcerpt: promptToRun,
        });
      }

      setResponseOutput(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gemini analysis failed');
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
                Gemini AI Operations & UI/UX Co-pilot
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Real v1beta API
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Autonomous UI/UX design reviews, responsive mobile layout optimization, and zero-guesswork DevOps root cause analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-info"
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra-fast)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen)</option>
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
            <span>Save Key</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex space-x-3 border-b border-border pb-3">
        <button
          onClick={() => { setActiveTab('uiux'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'uiux'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>UI/UX & Mobile Humanizer</span>
        </button>
        <button
          onClick={() => { setActiveTab('devops'); setResponseOutput(null); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'devops'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-secondary hover:text-white hover:bg-elevated'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>DevOps & Root Cause Radar</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input & Preset Prompts (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              {activeTab === 'uiux' ? <Layout className="w-4 h-4 text-cyan-400" /> : <Cpu className="w-4 h-4 text-amber-400" />}
              {activeTab === 'uiux' ? 'UI/UX Enhancement Directives' : 'Server Diagnostic Context / Logs'}
            </h2>

            <textarea
              rows={6}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                activeTab === 'uiux'
                  ? 'Describe what UI/UX aspect you want to improve (e.g. mobile responsiveness for .apk, WCAG AAA color contrast, Lucide icons alignment, or micro-animations)...'
                  : 'Paste recent journalctl, Nginx error.log, or cgroup memory stall output here...'
              }
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
                <span>{loading ? 'Analyzing with Gemini...' : 'Run Gemini Analysis'}</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Prompts */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">
              One-Click Intelligence Presets
            </h3>
            <div className="space-y-2">
              {activeTab === 'uiux' ? (
                <>
                  <button
                    onClick={() => {
                      const p = "Review mobile safe-area insets, touch target sizing (min 48px), and bottom navigation layout for Android APK and iOS IPA packaging.";
                      setPromptInput(p);
                      executeAnalysis(p);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-info" />
                      Mobile Safe Area & Touch Target Audit (.apk / .ipa)
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const p = "Audit the icon usage across KyvonOPS. Ensure all raw glyphs and emojis are eliminated in favor of clean, accessible Lucide React icons with consistent stroke widths (stroke-width 1.75).";
                      setPromptInput(p);
                      executeAnalysis(p);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Icon Consistency & Lucide Token Audit
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const p = "nginx: [error] 1482#1482: *491 connect() failed (111: Connection refused) while connecting to upstream, client: 172.68.22.1, server: api.example.com, request: 'GET /api/v1/health HTTP/1.1', upstream: 'http://127.0.0.1:3000/api/v1/health'";
                      setPromptInput(p);
                      executeAnalysis(p);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      Nginx 502 Upstream Connection Refused Triage
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const p = "kernel: [12948.112] oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=docker-7f91,mems_allowed=0,oom_memcg=/system.slice/docker-7f91.scope,task_memcg=/system.slice/docker-7f91.scope,task=node,pid=8412,uid=1000";
                      setPromptInput(p);
                      executeAnalysis(p);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-background hover:bg-elevated border border-border text-xs text-white transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      Docker cgroups v2 OOM-Kill Recovery
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Response Output Window (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-surface border border-border rounded-xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Gemini Synthesis & Recommendations</h3>
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
                  <p className="text-xs">Consulting {model} with live context...</p>
                </div>
              ) : responseOutput ? (
                <div className="prose prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans text-secondary bg-background/50 p-4 rounded-lg border border-border">
                  {responseOutput}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-secondary space-y-2">
                  <Layout className="w-8 h-8 text-secondary/40" />
                  <p className="text-xs">No analysis run yet. Enter a directive or click a preset above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
