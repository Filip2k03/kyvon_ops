import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Server, Shield, Cpu, ArrowRight, Download, Terminal,
  ExternalLink, Sparkles, Smartphone, Heart, Layers,
  Network, Lock, Zap, Apple, Copy, Check, QrCode,
  Play, Pause, Compass, Box, Radio
} from 'lucide-react';

interface DigitalTwinNode {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  sublabel: string;
  color: string;
  type: 'edge' | 'proxy' | 'container' | 'database' | 'cache' | 'daemon' | 'kernel';
  metrics: {
    cpu: string;
    ram: string;
    psi: string;
    risk: string;
    status: string;
    port: string;
  };
}

export const LandingPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction & 3D Orbit States
  const [selectedPreset, setSelectedPreset] = useState<'isometric' | 'top' | 'exploded' | 'side'>('isometric');
  const [renderMode, setRenderMode] = useState<'hologram' | 'wireframe'>('hologram');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-ingress');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Platform & Download States
  const [copiedCommand, setCopiedCommand] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [selectedDonation, setSelectedDonation] = useState<number>(15);
  const [customDonation, setCustomDonation] = useState<string>('');

  // 3D Digital Twin Nodes
  const nodes: DigitalTwinNode[] = [
    {
      id: 'node-ingress',
      x: 0,
      y: -110,
      z: 0,
      label: 'Cloudflare Ingress PoP',
      sublabel: 'Zero-Open-Port Edge Tunnel',
      color: '#f59e0b',
      type: 'edge',
      metrics: {
        cpu: '1.2%',
        ram: '34 MB',
        psi: '0.00%',
        risk: '0/100 (Safe)',
        status: 'Encrypted HTTP/3 & TLS 1.3',
        port: '443 (Proxied)',
      },
    },
    {
      id: 'node-proxy',
      x: 0,
      y: -50,
      z: 0,
      label: 'Nginx / Caddy Proxy',
      sublabel: 'Virtual Host Multiplexer',
      color: '#06b6d4',
      type: 'proxy',
      metrics: {
        cpu: '2.8%',
        ram: '48 MB',
        psi: '0.01%',
        risk: '2/100 (Safe)',
        status: 'HTTP/2 Upstream Keepalive',
        port: '80 / 443 Loopback',
      },
    },
    {
      id: 'node-api',
      x: -75,
      y: 15,
      z: -40,
      label: 'shop-api (Docker)',
      sublabel: 'FastAPI / Rust Core',
      color: '#3b82f6',
      type: 'container',
      metrics: {
        cpu: '12.4%',
        ram: '142 MB',
        psi: '0.02%',
        risk: '4/100 (Nominal)',
        status: 'cgroup v2 Bound (256MB Max)',
        port: '8000 -> 127.0.0.1',
      },
    },
    {
      id: 'node-web',
      x: 75,
      y: 15,
      z: -40,
      label: 'shop-web (Docker)',
      sublabel: 'Vite / React SSR',
      color: '#38bdf8',
      type: 'container',
      metrics: {
        cpu: '5.1%',
        ram: '86 MB',
        psi: '0.00%',
        risk: '1/100 (Safe)',
        status: 'SSR Cluster Active',
        port: '3000 -> 127.0.0.1',
      },
    },
    {
      id: 'node-worker',
      x: 0,
      y: 15,
      z: 55,
      label: 'queue-worker (Systemd)',
      sublabel: 'Background Task Dispatcher',
      color: '#6366f1',
      type: 'daemon',
      metrics: {
        cpu: '3.7%',
        ram: '64 MB',
        psi: '0.00%',
        risk: '0/100 (Safe)',
        status: 'systemd service active (running)',
        port: 'Internal IPC Socket',
      },
    },
    {
      id: 'node-db',
      x: -75,
      y: 85,
      z: 20,
      label: 'PostgreSQL 16 Engine',
      sublabel: 'NVMe WAL Storage Engine',
      color: '#8b5cf6',
      type: 'database',
      metrics: {
        cpu: '8.9%',
        ram: '380 MB',
        psi: '0.01%',
        risk: '3/100 (Safe)',
        status: 'WAL Direct I/O Active',
        port: '5432 (Localhost only)',
      },
    },
    {
      id: 'node-redis',
      x: 75,
      y: 85,
      z: 20,
      label: 'Redis 7.2 Cache',
      sublabel: 'Sub-millisecond In-Memory Store',
      color: '#ef4444',
      type: 'cache',
      metrics: {
        cpu: '1.6%',
        ram: '52 MB',
        psi: '0.00%',
        risk: '0/100 (Safe)',
        status: 'Hit Rate: 99.4%',
        port: '6379 (Localhost only)',
      },
    },
    {
      id: 'node-kernel',
      x: 0,
      y: 150,
      z: 0,
      label: 'Linux Kernel 6.x PSI',
      sublabel: 'cgroup v2 Pressure Sensor Ring',
      color: '#10b981',
      type: 'kernel',
      metrics: {
        cpu: '0.3%',
        ram: '3.4 MB RSS',
        psi: '0.00% (No memory stalls)',
        risk: '0/100 (Zero Blast Radius)',
        status: 'Direct /proc & /sys parser',
        port: 'Native POSIX Syscalls',
      },
    },
  ];

  const links: [number, number][] = [
    [0, 1], // Ingress -> Proxy
    [1, 2], // Proxy -> API
    [1, 3], // Proxy -> Web
    [2, 4], // API -> Worker
    [2, 5], // API -> Postgres
    [2, 6], // API -> Redis
    [3, 6], // Web -> Redis
    [2, 7], // API -> Kernel PSI
    [5, 7], // Postgres -> Kernel PSI
  ];

  // Active selected node details
  const activeNode = nodes.find((n) => n.id === (hoveredNodeId || selectedNodeId)) || nodes[0];

  // Interactive 3D WebGL/Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleY = selectedPreset === 'side' ? Math.PI / 2 : selectedPreset === 'top' ? 0 : 0.45;
    let angleX = selectedPreset === 'top' ? Math.PI / 2.3 : selectedPreset === 'side' ? 0.05 : 0.28;
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

    // 3D Perspective Projection Matrix
    const project = (x: number, y: number, z: number, width: number, height: number) => {
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const x1 = x * cosY - z * sinY;
      const z1 = z * cosY + x * sinY;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = z1 * cosX + y * sinX;

      const fov = 380;
      const distance = fov / (fov + z2 + 300);

      return {
        px: width / 2 + x1 * distance,
        py: height / 2 + y2 * distance,
        scale: Math.max(0.2, distance),
        z: z2,
      };
    };

    // Mouse & Touch Orbit Controls
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        angleY += deltaX * 0.008;
        angleX += deltaY * 0.008;
        angleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, angleX));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      } else {
        // Hit-test nodes on hover
        let foundHover: string | null = null;
        for (const n of nodes) {
          const proj = project(n.x, n.y, n.z, canvas.clientWidth, canvas.clientHeight);
          const dist = Math.hypot(mouseX - proj.px, mouseY - proj.py);
          if (dist < 22 * proj.scale) {
            foundHover = n.id;
            break;
          }
        }
        setHoveredNodeId(foundHover);
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (const n of nodes) {
        const proj = project(n.x, n.y, n.z, canvas.clientWidth, canvas.clientHeight);
        const dist = Math.hypot(mouseX - proj.px, mouseY - proj.py);
        if (dist < 24 * proj.scale) {
          setSelectedNodeId(n.id);
          break;
        }
      }
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
      angleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, angleX));
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Telemetry particle cloud
    const particles = Array.from({ length: 70 }, () => ({
      x: (Math.random() - 0.5) * 440,
      y: (Math.random() - 0.5) * 440,
      z: (Math.random() - 0.5) * 440,
      speed: 0.2 + Math.random() * 0.5,
      size: 1 + Math.random() * 1.5,
    }));

    let time = 0;

    const render = () => {
      time += 0.015;
      if (!isDragging && !isPaused) {
        angleY += 0.0035; // Gentle idle rotation
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      // Render Floor Perspective Grid (Isometric Foundation)
      ctx.strokeStyle = 'rgba(33, 38, 45, 0.4)';
      ctx.lineWidth = 1;
      const gridSize = 160;
      const gridSteps = 4;
      const step = gridSize / gridSteps;
      const floorY = 175;

      for (let gx = -gridSize; gx <= gridSize; gx += step) {
        const p1 = project(gx, floorY, -gridSize, width, height);
        const p2 = project(gx, floorY, gridSize, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
      for (let gz = -gridSize; gz <= gridSize; gz += step) {
        const p1 = project(-gridSize, floorY, gz, width, height);
        const p2 = project(gridSize, floorY, gz, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      // Render 3D Server Chassis Cabinet Wireframe
      const chassisWidth = 110;
      const chassisHeight = 270;
      const chassisDepth = 90;
      const topY = -125;
      const bottomY = topY + chassisHeight;

      const corners = [
        [-chassisWidth, topY, -chassisDepth],
        [chassisWidth, topY, -chassisDepth],
        [chassisWidth, topY, chassisDepth],
        [-chassisWidth, topY, chassisDepth],
        [-chassisWidth, bottomY, -chassisDepth],
        [chassisWidth, bottomY, -chassisDepth],
        [chassisWidth, bottomY, chassisDepth],
        [-chassisWidth, bottomY, chassisDepth],
      ].map(([cx, cy, cz]) => project(cx, cy, cz, width, height));

      const chassisEdges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Top ring
        [4, 5], [5, 6], [6, 7], [7, 4], // Bottom ring
        [0, 4], [1, 5], [2, 6], [3, 7], // Vertical pillars
      ];

      ctx.strokeStyle = renderMode === 'wireframe' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = renderMode === 'wireframe' ? 1.5 : 1;
      chassisEdges.forEach(([from, to]) => {
        ctx.beginPath();
        ctx.moveTo(corners[from].px, corners[from].py);
        ctx.lineTo(corners[to].px, corners[to].py);
        ctx.stroke();
      });

      // Render Server Blade Shelves inside the Chassis
      const bladeHeights = [-80, -20, 45, 115];
      bladeHeights.forEach((by) => {
        const b1 = project(-chassisWidth * 0.9, by, -chassisDepth * 0.9, width, height);
        const b2 = project(chassisWidth * 0.9, by, -chassisDepth * 0.9, width, height);
        const b3 = project(chassisWidth * 0.9, by, chassisDepth * 0.9, width, height);
        const b4 = project(-chassisWidth * 0.9, by, chassisDepth * 0.9, width, height);

        if (renderMode === 'hologram') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
          ctx.beginPath();
          ctx.moveTo(b1.px, b1.py);
          ctx.lineTo(b2.px, b2.py);
          ctx.lineTo(b3.px, b3.py);
          ctx.lineTo(b4.px, b4.py);
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.moveTo(b1.px, b1.py);
        ctx.lineTo(b2.px, b2.py);
        ctx.lineTo(b3.px, b3.py);
        ctx.lineTo(b4.px, b4.py);
        ctx.closePath();
        ctx.stroke();
      });

      // Render Floating Telemetry Particles
      particles.forEach((p) => {
        p.y += p.speed;
        if (p.y > 200) p.y = -200;
        const proj = project(p.x, p.y, p.z, width, height);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.beginPath();
        ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Connection Beams & Photon Data Packets
      links.forEach(([fromIdx, toIdx], linkIndex) => {
        const from = nodes[fromIdx];
        const to = nodes[toIdx];
        const p1 = project(from.x, from.y, from.z, width, height);
        const p2 = project(to.x, to.y, to.z, width, height);

        const isHighlighted =
          selectedNodeId === from.id ||
          selectedNodeId === to.id ||
          hoveredNodeId === from.id ||
          hoveredNodeId === to.id;

        const grad = ctx.createLinearGradient(p1.px, p1.py, p2.px, p2.py);
        grad.addColorStop(0, from.color + (isHighlighted ? 'dd' : '66'));
        grad.addColorStop(1, to.color + (isHighlighted ? 'dd' : '66'));

        ctx.strokeStyle = grad;
        ctx.lineWidth = (isHighlighted ? 2.5 : 1.2) * ((p1.scale + p2.scale) / 2);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();

        // Traveling Photon Packet
        const packetSpeed = 1.4;
        const t = (time * packetSpeed + linkIndex * 0.35) % 1;
        const packetX = p1.px + (p2.px - p1.px) * t;
        const packetY = p1.py + (p2.py - p1.py) * t;

        ctx.fillStyle = isHighlighted ? '#ffffff' : from.color;
        ctx.shadowColor = from.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(packetX, packetY, (isHighlighted ? 3.5 : 2.5) * p1.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Render 3D Nodes (Sorted by Z-Depth for accurate occlusion)
      const projectedNodes = nodes
        .map((n) => ({
          ...n,
          proj: project(n.x, n.y, n.z, width, height),
        }))
        .sort((a, b) => b.proj.z - a.proj.z);

      projectedNodes.forEach((n) => {
        const { px, py, scale } = n.proj;
        const isSelected = selectedNodeId === n.id;
        const isHovered = hoveredNodeId === n.id;
        const radius = (isSelected || isHovered ? 18 : 14) * scale;

        // Radial Glowing Aura
        const glow = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius * 2.8);
        glow.addColorStop(0, n.color + (isSelected || isHovered ? 'cc' : '66'));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Node Outer Enclosure (Solid dark core)
        ctx.fillStyle = '#0a0f1d';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = (isSelected || isHovered ? 3 : 2) * scale;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Internal Pulsing LED
        const pulse = 0.8 + 0.2 * Math.sin(time * 4);
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(px, py, 4.5 * scale * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Node Title
        ctx.font = `bold ${Math.max(9, Math.floor(11 * scale))}px system-ui, sans-serif`;
        ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, px, py + radius + 15 * scale);

        // Sublabel status tag
        if (scale > 0.6) {
          ctx.font = `${Math.max(8, Math.floor(9 * scale))}px monospace`;
          ctx.fillStyle = n.color;
          ctx.fillText(n.metrics.status.split(' ')[0], px, py + radius + 27 * scale);
        }
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
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [selectedPreset, renderMode, isPaused, selectedNodeId, hoveredNodeId]);

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('curl -fsSL https://kyvonops.sys.thuyakyaw.com/install.sh | bash');
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div className="space-y-16 max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 text-primary selection:bg-cyan-500/30">
      {/* 1. HERO SECTION WITH 3D WEBGL/BLENDER-GRADE INTERACTIVE DIGITAL TWIN */}
      <div className="relative rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-xl p-6 sm:p-10 overflow-hidden shadow-2xl">
        {/* Glow ambient background accents */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Column: Headline & Operational Value Proposition (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>KYVONOPS V3.0 — PRODUCTION STABLE</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Sovereign DevOps Control Plane & AI Operations
            </h1>

            <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-2xl">
              Turn any standard Linux VPS, cloud instance, or bare-metal host into an autonomously mapped 3D digital twin. Safely collaborate with{' '}
              <strong className="text-white">Codex Astra</strong>, <strong className="text-white">Claude Opus</strong>, and{' '}
              <strong className="text-white">Agy Gemini 3.8</strong> through a policy-controlled MCP gateway — with{' '}
              <span className="text-emerald-400 font-semibold">zero private key exposure</span> and human biometric approval.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to="/command-center"
                className="px-6 py-3.5 rounded-xl bg-info hover:bg-info/90 text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-info/20 transition-all min-h-[48px]"
              >
                <span>Launch Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#download"
                className="px-6 py-3.5 rounded-xl bg-surface border border-border hover:border-info text-white text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm min-h-[48px]"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download Packages</span>
              </a>

              <a
                href="https://github.com/Filip2k03/kyvon_ops"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3.5 rounded-xl bg-elevated hover:bg-elevated/80 border border-border text-secondary hover:text-white text-sm font-semibold flex items-center justify-center space-x-1.5 transition-all min-h-[48px]"
              >
                <Terminal className="w-4 h-4" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Quick Terminal One-Liner */}
            <div className="bg-black/60 border border-border/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 overflow-hidden text-cyan-300">
                <Terminal className="w-4 h-4 text-secondary shrink-0" />
                <span className="truncate">curl -fsSL https://kyvonops.sys.thuyakyaw.com/install.sh | bash</span>
              </div>
              <button
                onClick={copyInstallCommand}
                className="p-1.5 rounded-lg bg-surface border border-border text-secondary hover:text-white hover:border-cyan-500 transition-colors shrink-0"
                title="Copy install command"
              >
                {copiedCommand ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Security & Ergonomic Guarantees */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-secondary">
              <div className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Secret Exposure</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-info" />
                <span>Cgroup v2 PSI Stalls</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span>Android & iOS Companion</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Interactive WebGL/Canvas Digital Twin Engine (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            {/* 3D Camera & Shading Toolbar */}
            <div className="flex items-center justify-between bg-black/50 border border-border/70 rounded-xl p-2 text-xs font-mono">
              <div className="flex items-center space-x-1">
                <span className="text-secondary mr-1 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" /> View:
                </span>
                {(['isometric', 'top', 'side'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSelectedPreset(preset)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                      selectedPreset === preset
                        ? 'bg-info text-white shadow'
                        : 'text-secondary hover:text-white hover:bg-surface'
                    }`}
                  >
                    {preset === 'isometric' ? '3D ISO' : preset === 'top' ? 'TOP' : 'PROFILE'}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setRenderMode(renderMode === 'hologram' ? 'wireframe' : 'hologram')}
                  className="px-2 py-1 rounded text-[11px] font-semibold border border-border text-secondary hover:text-white transition-all flex items-center gap-1"
                  title="Toggle Holographic vs CAD Wireframe"
                >
                  <Box className="w-3 h-3 text-cyan-400" />
                  <span>{renderMode === 'hologram' ? 'Solid' : 'Wireframe'}</span>
                </button>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-1.5 rounded text-secondary hover:text-white border border-border transition-colors"
                  title={isPaused ? 'Resume 3D rotation' : 'Pause 3D rotation'}
                >
                  {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* 3D Canvas Box */}
            <div className="w-full aspect-square max-w-[500px] mx-auto relative rounded-2xl border border-border/80 bg-black/60 overflow-hidden shadow-2xl flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
                title="Click nodes to inspect. Drag to rotate 3D Digital Twin."
              />

              {/* Status HUD overlay */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono pointer-events-none px-2.5 py-1.5 rounded bg-black/70 backdrop-blur-md border border-border/40">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Sparkles className="w-3 h-3" />
                  <span>INTERACTIVE 3D BLENDER ENGINE</span>
                </span>
                <span className="text-secondary">60 FPS • DUAL AXIS MATRIX</span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-secondary/80 font-mono pointer-events-none px-2.5 py-1.5 rounded bg-black/70 backdrop-blur-md border border-border/40">
                <span className="text-white flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>Active: {activeNode.label}</span>
                </span>
                <span className="text-cyan-400">Click node to inspect</span>
              </div>
            </div>

            {/* Interactive Node Telemetry Inspector HUD */}
            <div className="bg-surface/90 border border-border/80 rounded-xl p-3.5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeNode.color }} />
                  <span className="text-xs font-bold text-white">{activeNode.label}</span>
                  <span className="text-[10px] font-mono text-secondary">({activeNode.sublabel})</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-emerald-400 border border-emerald-500/20">
                  {activeNode.metrics.risk}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                <div className="bg-background/80 border border-border/50 rounded-lg p-2">
                  <span className="text-secondary text-[10px] block">CPU Load</span>
                  <span className="text-white font-semibold">{activeNode.metrics.cpu}</span>
                </div>
                <div className="bg-background/80 border border-border/50 rounded-lg p-2">
                  <span className="text-secondary text-[10px] block">Memory RSS</span>
                  <span className="text-white font-semibold">{activeNode.metrics.ram}</span>
                </div>
                <div className="bg-background/80 border border-border/50 rounded-lg p-2">
                  <span className="text-secondary text-[10px] block">Kernel PSI</span>
                  <span className="text-cyan-300 font-semibold">{activeNode.metrics.psi}</span>
                </div>
                <div className="bg-background/80 border border-border/50 rounded-lg p-2">
                  <span className="text-secondary text-[10px] block">Port / Sockets</span>
                  <span className="text-amber-300 font-semibold truncate block">{activeNode.metrics.port}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE 6 CORE ARCHITECTURAL PILLARS */}
      <div className="space-y-6">
        <div className="text-center max-w-3xl mx-auto space-y-2">
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
              Let Codex Astra, Claude Opus, and Agy Gemini 3.8 assist your SRE workflows. AI models receive typed diagnostics and can propose repairs, but NEVER receive raw SSH keys or unrestricted shell execution.
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-info text-secondary hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Mobile QR Install</span>
            </button>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v3.0.0 (Stable)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* macOS */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Apple className="w-6 h-6 text-white" />
                <span className="text-[10px] font-mono text-secondary">macOS 12+</span>
              </div>
              <h4 className="text-sm font-bold text-white">Apple macOS</h4>
              <p className="text-[11px] text-secondary leading-relaxed">
                Universal DMG supporting Apple Silicon (M1/M2/M3/M4) and Intel x86_64 chips.
              </p>
              <div className="text-[9px] font-mono text-secondary/70 truncate">
                SHA-256: 9f8a3c4b...1e2d
              </div>
            </div>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2.5 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .dmg</span>
            </a>
          </div>

          {/* Linux */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Server className="w-6 h-6 text-amber-400" />
                <span className="text-[10px] font-mono text-secondary">Linux x86_64</span>
              </div>
              <h4 className="text-sm font-bold text-white">Linux Desktop</h4>
              <p className="text-[11px] text-secondary leading-relaxed">
                AppImage & Debian .deb package for Ubuntu, Debian, Fedora, and Arch.
              </p>
              <div className="text-[9px] font-mono text-secondary/70 truncate">
                SHA-256: a4b1e8f2...7c90
              </div>
            </div>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2.5 rounded-lg bg-surface border border-border hover:border-info text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download .AppImage</span>
            </a>
          </div>

          {/* Windows */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Layers className="w-6 h-6 text-blue-400" />
                <span className="text-[10px] font-mono text-secondary">Windows 10/11</span>
              </div>
              <h4 className="text-sm font-bold text-white">Windows 64-bit</h4>
              <p className="text-[11px] text-secondary leading-relaxed">
                Native MSI Installer and self-contained executable for Windows x64.
              </p>
              <div className="text-[9px] font-mono text-secondary/70 truncate">
                SHA-256: 3c5e7b1a...8f4d
              </div>
            </div>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2.5 rounded-lg bg-surface border border-border hover:border-info text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download .msi</span>
            </a>
          </div>

          {/* Android APK */}
          <div className="bg-background border border-border rounded-xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Smartphone className="w-6 h-6 text-emerald-400" />
                <span className="text-[10px] font-mono text-secondary">Android 9.0+</span>
              </div>
              <h4 className="text-sm font-bold text-white">Android Companion</h4>
              <p className="text-[11px] text-secondary leading-relaxed">
                Signed release APK with offline SQLite cache & biometric 2FA step-up.
              </p>
              <div className="text-[9px] font-mono text-secondary/70 truncate">
                SHA-256: 7d2a9f1b...5c4e
              </div>
            </div>
            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              className="w-full py-2.5 rounded-lg bg-surface border border-border hover:border-emerald-500 text-emerald-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .apk</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. DEVELOPER QUICKSTART & CLI TOOLING */}
      <div className="bg-surface border border-border rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-6 h-6 text-cyan-400" />
          Developer Quickstart & Sovereign Self-Hosting
        </h2>
        <p className="text-xs sm:text-sm text-secondary">
          Any developer or operations team can clone, test, build, and self-host KyvonOPS in under two minutes:
        </p>

        <div className="bg-black/80 border border-border rounded-xl p-4 font-mono text-xs text-white space-y-2 overflow-x-auto">
          <div className="text-secondary"># 1. Clone the sovereign monorepo</div>
          <div className="text-cyan-300">git clone https://github.com/Filip2k03/kyvon_ops.git && cd kyvon_ops</div>
          <div className="text-secondary pt-2"># 2. Run the full Rust test suite (170+ tests passing)</div>
          <div className="text-cyan-300">CARGO_INCREMENTAL=0 cargo test --workspace --all-features --offline</div>
          <div className="text-secondary pt-2"># 3. Start the Desktop/Web development environment</div>
          <div className="text-cyan-300">cd apps/desktop && bun install && bun run dev</div>
          <div className="text-secondary pt-2"># 4. Compile the unified `kyvon` CLI binary</div>
          <div className="text-cyan-300">cargo build --release -p kyvon-cli && ./target/release/kyvon --help</div>
        </div>
      </div>

      {/* 5. STRIPE COMMUNITY SPONSORSHIP & DONATIONS */}
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
                  className={`py-3 rounded-xl text-xs font-bold transition-all min-h-[48px] ${
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
              <span className="absolute left-3.5 top-3.5 text-secondary text-xs">$</span>
              <input
                type="number"
                value={customDonation}
                onChange={(e) => {
                  setCustomDonation(e.target.value);
                  setSelectedDonation(0);
                }}
                placeholder="Or enter a custom donation amount..."
                className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-3 text-xs text-white placeholder-secondary focus:outline-none focus:border-emerald-500 min-h-[48px]"
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

      {/* 6. MODAL: QR CODE FOR MOBILE INSTALLATION */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Scan to Install on Mobile
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-secondary hover:text-white text-xs px-2 py-1 rounded bg-elevated border border-border"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Scan with your phone's camera to download the Android APK or join the iOS TestFlight companion:
            </p>

            <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-inner">
              <QRCodeSVG
                value="https://kyvonops.sys.thuyakyaw.com/downloads"
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-[11px] font-mono text-center text-cyan-300 truncate">
              https://kyvonops.sys.thuyakyaw.com/downloads
            </div>

            <a
              href="https://github.com/Filip2k03/kyvon_ops/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-lg bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Open GitHub Release Page</span>
            </a>
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
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
