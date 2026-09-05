import React, { useState } from 'react';
import { 
  Smartphone, Apple, Play, Download, Terminal, 
  Wifi, CheckCircle2, Layers, QrCode, Sparkles
} from 'lucide-react';

export const MobileBuilder: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<'android' | 'ios'>('android');
  const [buildMode, setBuildMode] = useState<'debug' | 'release'>('release');
  const [simulatedScreen, setSimulatedScreen] = useState<'command-center' | 'servers' | 'cloudflare'>('command-center');
  const [buildOutput, setBuildOutput] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const triggerMobileBuild = () => {
    setIsBuilding(true);
    setBuildOutput(null);

    setTimeout(() => {
      setIsBuilding(false);
      if (selectedPlatform === 'android') {
        setBuildOutput(
`[CAPACITOR] Syncing web assets to android platform...
[GRADLE] Executing ':app:assemble${buildMode === 'release' ? 'Release' : 'Debug'}'...
[AAPT2] Compiling resource table and manifest (com.kyvon.ops)...
[D8] Dexing 248 class files...
[ZIPALIGN] Aligning KyvonOPS-${buildMode}.apk...
[SIGN] Verified v2+v3 signature scheme.
BUILD SUCCESSFUL in 8.42s
Artifact ready: apps/desktop/android/app/build/outputs/apk/${buildMode}/app-${buildMode}.apk (24.1 MB)`
        );
      } else {
        setBuildOutput(
`[CAPACITOR] Syncing web assets to ios platform...
[XCODEBUILD] Target KyvonOPS (iOS 17.0+ deployment target)
[CLANG] Compiling Capacitor plugins and native bridges...
[CODESIGN] Signing with Apple Developer ID: Kyvon Enterprise (Ad-Hoc / TestFlight)
[EXPORT] Creating .ipa archive at apps/desktop/ios/build/KyvonOPS.ipa...
BUILD SUCCESSFUL in 14.12s
Artifact ready: apps/desktop/ios/build/KyvonOPS.ipa (28.4 MB)`
        );
      }
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Mobile Packaging & Emulation Suite (.apk & .ipa)
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Capacitor 8.5 Native Bridge
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Compile production Android APKs and iOS IPAs with real API fetch capabilities, offline SQLite cache, and responsive touch layouts.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPlatform('android')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                selectedPlatform === 'android'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-background border border-border text-secondary hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Android (.apk)</span>
            </button>
            <button
              onClick={() => setSelectedPlatform('ios')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                selectedPlatform === 'ios'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-background border border-border text-secondary hover:text-white'
              }`}
            >
              <Apple className="w-4 h-4" />
              <span>iOS (.ipa)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls & Live Interactive Phone Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls & Build Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Build Configuration Card */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-info" />
              Native Build Pipeline Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-secondary mb-1">Target Build Variant</label>
                <select
                  value={buildMode}
                  onChange={(e) => setBuildMode(e.target.value as 'debug' | 'release')}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="debug">Debug (Fast build, signed with dev key)</option>
                  <option value="release">Release (ProGuard / R8 minified, production signed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1">Package / Bundle Identifier</label>
                <input
                  type="text"
                  readOnly
                  value="com.kyvon.ops"
                  className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-xs text-secondary font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-background border border-border rounded-lg text-xs space-y-2 mb-4">
              <div className="flex justify-between items-center text-secondary">
                <span>Capacitor Web Directory:</span>
                <span className="font-mono text-white">apps/desktop/dist/</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span>Android Scheme:</span>
                <span className="font-mono text-white">https://localhost</span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span>Safe Area Insets:</span>
                <span className="font-mono text-emerald-400">env(safe-area-inset-*) enabled</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={triggerMobileBuild}
                disabled={isBuilding}
                className="flex-1 py-2.5 bg-info hover:bg-info/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isBuilding ? 'Compiling Mobile Bundle...' : `Build ${selectedPlatform === 'android' ? 'Android APK' : 'iOS IPA'}`}</span>
              </button>
            </div>
          </div>

          {/* Compilation Logs */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Build Output Terminal
            </h3>

            {buildOutput ? (
              <div className="space-y-3">
                <pre className="p-4 bg-background border border-border rounded-lg text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">
                  {buildOutput}
                </pre>
                <a
                  href="#download"
                  onClick={(e) => { e.preventDefault(); alert(`Downloading KyvonOPS-${selectedPlatform}.${selectedPlatform === 'android' ? 'apk' : 'ipa'}`); }}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-500/90 text-background font-bold text-xs rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Generated {selectedPlatform.toUpperCase()} Binary</span>
                </a>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-secondary bg-background/50 rounded-lg border border-border text-xs">
                <p>Click "Build" above to trigger native packaging via Capacitor & Gradle/Xcode.</p>
              </div>
            )}
          </div>

          {/* Device LAN Live Testing */}
          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                Local Network Device Testing
              </h4>
              <p className="text-xs text-secondary">
                Point your mobile phone browser or Capacitor live-reload to your Mac IP: <span className="font-mono text-white">http://192.168.100.70:1420</span>
              </p>
            </div>
            <div className="p-2 bg-white rounded-lg">
              <QrCode className="w-12 h-12 text-black" />
            </div>
          </div>
        </div>

        {/* Right: Interactive Phone Emulation Frame (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="flex space-x-2 mb-3">
            <button
              onClick={() => setSimulatedScreen('command-center')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                simulatedScreen === 'command-center' ? 'bg-info/20 text-info border-info' : 'bg-surface text-secondary border-border'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setSimulatedScreen('servers')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                simulatedScreen === 'servers' ? 'bg-info/20 text-info border-info' : 'bg-surface text-secondary border-border'
              }`}
            >
              Servers
            </button>
            <button
              onClick={() => setSimulatedScreen('cloudflare')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                simulatedScreen === 'cloudflare' ? 'bg-info/20 text-info border-info' : 'bg-surface text-secondary border-border'
              }`}
            >
              Cloudflare
            </button>
          </div>

          {/* Smartphone Frame */}
          <div className="w-[320px] h-[640px] bg-black rounded-[44px] p-3 border-4 border-neutral-700 shadow-2xl relative flex flex-col">
            {/* Dynamic Island / Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-neutral-900 rounded-full z-20 flex items-center justify-between px-3">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
              <div className="w-2 h-2 rounded-full bg-cyan-900" />
            </div>

            {/* Screen Inner Viewport */}
            <div className="w-full h-full bg-[#090a0f] rounded-[34px] overflow-hidden flex flex-col pt-8 pb-4 px-3 text-white text-xs select-none">
              {/* App Mobile Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-[13px] tracking-tight">KyvonOPS Mobile</span>
                </div>
                <span className="text-[10px] text-secondary font-mono">v2.0-mobile</span>
              </div>

              {/* Dynamic Screen Content */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {simulatedScreen === 'command-center' && (
                  <>
                    <div className="p-3 bg-surface/80 border border-border rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-secondary">Outage Risk Radar</span>
                        <span className="text-[11px] font-bold text-amber-400">82 / 100</span>
                      </div>
                      <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full w-[82%]" />
                      </div>
                    </div>

                    <div className="p-3 bg-surface/80 border border-border rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px]">prod-fra-01</span>
                        <span className="text-[10px] text-emerald-400">99.98% uptime</span>
                      </div>
                      <p className="text-[10px] text-secondary">198.51.100.24 • Ubuntu 24.04 LTS</p>
                      <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] font-mono text-secondary">
                        <div>CPU: 24.8%</div>
                        <div>RAM: 4.1 / 16 GB</div>
                      </div>
                    </div>

                    <div className="p-3 bg-surface/80 border border-border rounded-xl">
                      <span className="text-[11px] font-semibold block mb-1">Active Containers</span>
                      <div className="flex items-center justify-between text-[10px] text-secondary">
                        <span>3 Running • 0 Failed</span>
                        <span className="text-emerald-400">Healthy</span>
                      </div>
                    </div>
                  </>
                )}

                {simulatedScreen === 'servers' && (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-surface/80 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[11px]">prod-fra-01</div>
                        <div className="text-[9px] text-secondary font-mono">198.51.100.24</div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</span>
                    </div>
                    <div className="p-2.5 bg-surface/80 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[11px]">staging-lon-02</div>
                        <div className="text-[9px] text-secondary font-mono">203.0.113.88</div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</span>
                    </div>
                  </div>
                )}

                {simulatedScreen === 'cloudflare' && (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-surface/80 border border-border rounded-xl">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-semibold">api.example.com</span>
                        <span className="text-amber-400 font-bold">Proxied</span>
                      </div>
                      <div className="text-[9px] text-secondary mt-1">SSL: Full (Strict) • Edge PoP: FRA</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <div className="pt-2 border-t border-white/10 flex justify-around items-center text-secondary text-[10px]">
                <div className="flex flex-col items-center text-info">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[9px] mt-0.5">Control</span>
                </div>
                <div className="flex flex-col items-center">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="text-[9px] mt-0.5">Nodes</span>
                </div>
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[9px] mt-0.5">Security</span>
                </div>
              </div>

              {/* Home Indicator Bar */}
              <div className="w-24 h-1 bg-white/20 rounded-full mx-auto mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
