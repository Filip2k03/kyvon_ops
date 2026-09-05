import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server, Shield, Cpu, ArrowRight, Download, Terminal,
  ExternalLink, Sparkles, Smartphone, Heart, Layers,
  Network, Lock, Zap, Apple
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<number>(15);
  const [customDonation, setCustomDonation] = useState<string>('');

  // Interactive 3D Canvas rendering a rotating Holographic Server Rack & Particle Digital Twin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleY = 0;
    let angleX = 0.25;
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse / Touch Drag interaction for 3D rotation
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      angleY += deltaX * 0.008;
      angleX += deltaY * 0.008;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      angleY += deltaX * 0.008;
      angleX += deltaY * 0.008;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // 3D Nodes definition (Isometric Server Chassis Nodes)
    const nodes = [
      { x: 0, y: -90, z: 0, label: 'Cloudflare Ingress', color: '#f59e0b', type: 'edge' },
      { x: 0, y: -30, z: 0, label: 'Nginx Reverse Proxy', color: '#06b6d4', type: 'proxy' },
      { x: -70, y: 40, z: -40, label: 'shop-api (Docker)', color: '#3b82f6', type: 'container' },
      { x: 70, y: 40, z: -40, label: 'shop-web (Nginx)', color: '#3b82f6', type: 'container' },
      { x: -70, y: 110, z: 40, label: 'PostgreSQL 16', color: '#8b5cf6', type: 'database' },
      { x: 70, y: 110, z: 40, label: 'Redis Cache 7.2', color: '#ef4444', type: 'cache' },
      { x: 0, y: 160, z: 0, label: 'cgroups v2 PSI Monitor', color: '#10b981', type: 'kernel' },
    ];

    // Connection beams between nodes
    const links = [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [2, 5],
      [2, 6],
      [3, 6],
      [4, 6],
    ];

    // Starfield / Telemetry particle cloud
    const particles = Array.from({ length: 65 }, () => ({
      x: (Math.random() - 0.5) * 360,
      y: (Math.random() - 0.5) * 360,
      z: (Math.random() - 0.5) * 360,
      speed: 0.2 + Math.random() * 0.4,
      size: 1 + Math.random() * 1.5,
    }));

    let time = 0;

    const render = () => {
      time += 0.015;
      if (!isDragging) {
        angleY += 0.004; // Smooth idle rotation
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 340;

      // Rotate coordinates in 3D space
      const project = (x: number, y: number, z: number) => {
        // Rotate around Y
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;

        // Rotate around X
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;

        const distance = fov / (fov + z2 + 250);
        return {
          px: centerX + x1 * distance,
          py: centerY + y2 * distance,
          scale: distance,
          z: z2,
        };
      };

      // Draw particle dust
      particles.forEach((p) => {
        p.y += p.speed;
        if (p.y > 180) p.y = -180;
        const proj = project(p.x, p.y, p.z);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connection lines
      links.forEach(([fromIdx, toIdx]) => {
        const from = nodes[fromIdx];
        const to = nodes[toIdx];
        const p1 = project(from.x, from.y, from.z);
        const p2 = project(to.x, to.y, to.z);

        const grad = ctx.createLinearGradient(p1.px, p1.py, p2.px, p2.py);
        grad.addColorStop(0, from.color + '88');
        grad.addColorStop(1, to.color + '88');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5 * ((p1.scale + p2.scale) / 2);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();

        // Pulsing data packet traversing beam
        const t = (time * 1.2 + fromIdx * 0.4) % 1;
        const packetX = p1.px + (p2.px - p1.px) * t;
        const packetY = p1.py + (p2.py - p1.py) * t;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(packetX, packetY, 2.5 * p1.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw 3D nodes sorted by Z-index for correct depth
      const projectedNodes = nodes
        .map((n) => ({ ...n, proj: project(n.x, n.y, n.z) }))
        .sort((a, b) => b.proj.z - a.proj.z);

      projectedNodes.forEach((n) => {
        const { px, py, scale } = n.proj;
        const radius = 16 * scale;

        // Glowing node aura
        const glow = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius * 2.2);
        glow.addColorStop(0, n.color + 'aa');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Node circle core
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 2.5 * scale;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Node center LED
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(px, py, 4 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = `${Math.max(9, Math.floor(11 * scale))}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, px, py + radius + 14 * scale);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="space-y-16 max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 text-primary selection:bg-cyan-500/30">
      {/* 1. HERO SECTION WITH INTERACTIVE 3D WEBGL/CANVAS */}
      <div className="relative rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-xl p-6 sm:p-12 overflow-hidden shadow-2xl">
        {/* Glow ambient background */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Hero Content (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Version & Security Pill */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>KYVONOPS V3.0 — PRODUCTION RELEASE</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Sovereign DevOps Control Plane & AI Operations
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-2xl">
              Turn any Linux VPS into an autonomously mapped digital twin. Safely collaborate with{' '}
              <strong className="text-white">Claude Code</strong>, <strong className="text-white">Codex Astra</strong>, and{' '}
              <strong className="text-white">Cursor CLI</strong> through a policy-controlled MCP gateway — with{' '}
              <span className="text-emerald-400 font-semibold">zero private key exposure</span> and human biometric approval.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to="/command-center"
                className="px-6 py-3.5 rounded-xl bg-info hover:bg-info/90 text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-info/20 transition-all"
              >
                <span>Launch Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#download"
                className="px-6 py-3.5 rounded-xl bg-surface border border-border hover:border-info text-white text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download Binaries</span>
              </a>

              <a
                href="https://github.com/Filip2k03/kyvon_ops"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3.5 rounded-xl bg-elevated hover:bg-elevated/80 border border-border text-secondary hover:text-white text-sm font-semibold flex items-center justify-center space-x-1.5 transition-all"
              >
                <Terminal className="w-4 h-4" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Quick Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/60 text-xs text-secondary">
              <div className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Secret Exposure</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-info" />
                <span>Cgroup v2 PSI Telemetry</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span>Android & iOS Companion</span>
              </div>
            </div>
          </div>

          {/* Right Hero Interactive 3D Canvas (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="w-full aspect-square max-w-[440px] relative rounded-2xl border border-border/80 bg-black/40 overflow-hidden shadow-2xl flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
                title="Drag to rotate 3D Digital Twin"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-secondary/80 font-mono pointer-events-none px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-border/40">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Sparkles className="w-3 h-3" /> Drag to Rotate 3D Model
                </span>
                <span>DIGITAL TWIN V3.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE 5 CORE ARCHITECTURAL PILLARS */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Engineered for Modern Sovereign Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-secondary">
            Built from scratch in Rust, Tauri 2, and React. Zero third-party telemetry, zero proprietary SaaS lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Pillar 1 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">1 VPS → Autonomous Digital Twin</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Connect over standard SSH. KyvonOPS inspects `/proc` and `/sys` to map every Nginx reverse proxy, Docker container, systemd unit, and database connection into an interactive topology graph.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Zero-Secret Policy MCP Gateway</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Let Claude Code, Cursor, and Codex assist your SRE workflows. AI models receive typed diagnostics and can propose repairs, but NEVER receive raw SSH keys or unrestricted shell execution.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Cgroup v2 PSI & Outage Risk Engine</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Track real Linux kernel Pressure Stall Information (PSI), TCP listen backlog drops, and inode headroom to forecast saturation and outages before users notice downtime.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Mobile Command Companion</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Native Android APK and iOS companion with offline SQLite caching, streaming log triage, and biometric step-up gates (Face ID / Touch ID / Fingerprint) for emergency rollbacks.
            </p>
          </div>

          {/* Pillar 5 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Cloudflare Free Tier Zero-Open-Port</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Eliminate open firewall ports with automated `cloudflared` edge tunnels, Universal Full Strict TLS termination, and origin cloaking on Cloudflare's free plan.
            </p>
          </div>

          {/* Pillar 6 */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm hover:border-info/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Unified Native CLI (`kyvon`)</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Manage your fleet right from your terminal. Full-featured CLI for nodes, sites, automated rollbacks, incident inspection, and remote Musl probe deployments.
            </p>
          </div>
        </div>
      </div>

      {/* 3. DOWNLOAD PORTAL & MULTI-PLATFORM PACKAGES */}
      <div id="download" className="bg-surface border border-border rounded-3xl p-6 sm:p-10 space-y-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Download className="w-6 h-6 text-info" />
              Download KyvonOPS V3.0 Binaries
            </h2>
            <p className="text-xs sm:text-sm text-secondary mt-1">
              Production builds compiled for macOS, Linux, Windows, Android, and iOS.
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Latest: v3.0.0 (Stable)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* macOS */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Apple className="w-6 h-6 text-white" />
              <span className="text-[10px] font-mono text-secondary">macOS 12+</span>
            </div>
            <h4 className="text-sm font-bold text-white">Apple macOS</h4>
            <p className="text-[11px] text-secondary">Universal DMG (Apple Silicon M1/M2/M3/M4 & Intel x86_64)</p>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .dmg</span>
            </a>
          </div>

          {/* Linux */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Server className="w-6 h-6 text-amber-400" />
              <span className="text-[10px] font-mono text-secondary">Linux x86_64</span>
            </div>
            <h4 className="text-sm font-bold text-white">Linux Desktop</h4>
            <p className="text-[11px] text-secondary">AppImage & Debian .deb package for Ubuntu, Debian, Fedora, Arch</p>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2 rounded-lg bg-surface border border-border hover:border-info text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download .AppImage</span>
            </a>
          </div>

          {/* Windows */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Layers className="w-6 h-6 text-blue-400" />
              <span className="text-[10px] font-mono text-secondary">Windows 10/11</span>
            </div>
            <h4 className="text-sm font-bold text-white">Windows 64-bit</h4>
            <p className="text-[11px] text-secondary">Native MSI Installer & Executable signed for Windows x64</p>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2 rounded-lg bg-surface border border-border hover:border-info text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download .msi</span>
            </a>
          </div>

          {/* Android APK */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Smartphone className="w-6 h-6 text-emerald-400" />
              <span className="text-[10px] font-mono text-secondary">Android 9.0+</span>
            </div>
            <h4 className="text-sm font-bold text-white">Android Companion</h4>
            <p className="text-[11px] text-secondary">Signed release APK with offline SQLite cache & 2FA biometrics</p>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2 rounded-lg bg-surface border border-border hover:border-emerald-500 text-emerald-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .apk</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. DEVELOPER QUICKSTART & INSTALLATION */}
      <div className="bg-surface border border-border rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-6 h-6 text-cyan-400" />
          Developer Quickstart & Self-Hosting
        </h2>
        <p className="text-xs sm:text-sm text-secondary">
          Any developer or team can clone, run, and self-host KyvonOPS locally in under two minutes:
        </p>

        <div className="bg-black/80 border border-border rounded-xl p-4 font-mono text-xs text-white space-y-2 overflow-x-auto">
          <div className="text-secondary"># 1. Clone the sovereign monorepo</div>
          <div className="text-cyan-300">git clone https://github.com/Filip2k03/kyvon_ops.git && cd kyvon_ops</div>
          <div className="text-secondary pt-2"># 2. Run the full Rust test suite (170+ tests passing)</div>
          <div className="text-cyan-300">cargo test --workspace --all-features</div>
          <div className="text-secondary pt-2"># 3. Start the Desktop/Web development environment</div>
          <div className="text-cyan-300">cd apps/desktop && bun install && bun run dev</div>
          <div className="text-secondary pt-2"># 4. Compile the unified `kyvon` CLI binary</div>
          <div className="text-cyan-300">cargo build --release -p kyvon-cli && ./target/release/kyvon --help</div>
        </div>
      </div>

      {/* 5. STRIPE COMMUNITY SPONSORSHIP & DONATION */}
      <div className="bg-gradient-to-br from-surface to-elevated border border-emerald-500/30 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Heart className="w-6 h-6 text-rose-400 fill-rose-400/20" />
              Support Sovereign Open-Source DevOps Tooling
            </h2>
            <p className="text-xs sm:text-sm text-secondary">
              KyvonOPS is independent software built for engineers who value infrastructure sovereignty.
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Stripe Secure Checkout
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs text-secondary leading-relaxed">
              Your contribution goes directly toward cross-platform build servers, bare-metal VPS test nodes, and continuous mobile integration testing. Every backer receives direct GitHub recognition in our release notes.
            </p>

            <div className="grid grid-cols-4 gap-2.5">
              {[5, 10, 15, 25].map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setSelectedDonation(amt);
                    setCustomDonation('');
                  }}
                  className={`py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    selectedDonation === amt && !customDonation
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-background border border-border text-secondary hover:text-white'
                  }`}
                >
                  ${amt} USD
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-3 text-secondary text-xs">$</span>
              <input
                type="number"
                value={customDonation}
                onChange={(e) => {
                  setCustomDonation(e.target.value);
                  setSelectedDonation(0);
                }}
                placeholder="Or enter a custom donation amount..."
                className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-secondary focus:outline-none focus:border-emerald-500 min-h-[44px]"
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <a
              href={`https://donate.stripe.com/test_kyvonops?amount=${customDonation || selectedDonation}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-xl shadow-emerald-900/20 min-h-[48px]"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Sponsor ${customDonation || selectedDonation} via Stripe</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* 6. FOOTER */}
      <footer className="pt-8 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary">
        <div>
          © 2026 KyvonOPS. Licensed under MIT & Apache 2.0. Sovereign & Independent.
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/command-center" className="hover:text-white transition-colors">
            App
          </Link>
          <Link to="/companion" className="hover:text-white transition-colors">
            Companion
          </Link>
          <Link to="/twin" className="hover:text-white transition-colors">
            Digital Twin
          </Link>
          <Link to="/promotions" className="hover:text-white transition-colors">
            Share
          </Link>
          <a
            href="https://github.com/Filip2k03/kyvon_ops"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};
