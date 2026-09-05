import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, Server, Terminal, Cpu, HardDrive, Shield, FileText, 
  Settings, Network, Boxes, Zap, Globe, Sparkles, Smartphone, Download,
  Monitor, QrCode
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import clsx from 'clsx';

const navItems = [
  { path: '/command-center', icon: Activity, label: 'Command Center' },
  { path: '/servers', icon: Server, label: 'Servers' },
  { path: '/vps-matrix', icon: Monitor, label: 'VPS Health Matrix' },
  { path: '/pairing', icon: QrCode, label: 'QR Device Pairing & 2FA' },
  { path: '/cloudflare', icon: Globe, label: 'Cloudflare & Ingress' },
  { path: '/gemini', icon: Sparkles, label: 'Gemini 3.8 UI/UX Studio' },
  { path: '/mobile', icon: Smartphone, label: 'Mobile (.apk / .ipa)' },
  { path: '/terminal', icon: Terminal, label: 'Terminal' },
  { path: '/docker', icon: Boxes, label: 'Docker & Compose' },
  { path: '/diagnostics', icon: Zap, label: 'Diagnostics' },
  { path: '/processes', icon: Cpu, label: 'Processes' },
  { path: '/services', icon: Settings, label: 'Services' },
  { path: '/network', icon: Network, label: 'Network' },
  { path: '/storage', icon: HardDrive, label: 'Storage' },
  { path: '/security', icon: Shield, label: 'Security' },
  { path: '/logs', icon: FileText, label: 'Logs' },
  { path: '/downloads', icon: Download, label: 'Downloads & Donate' },
];

export const Sidebar = () => {
  const { sidebarCollapsed } = useUiStore();
  const location = useLocation();

  return (
    <aside className={clsx('bg-surface border-r border-border flex flex-col transition-all duration-300', sidebarCollapsed ? 'w-14' : 'w-56')}>
      <div className="p-4 flex items-center h-14 border-b border-border">
        <Server className="text-info w-6 h-6 shrink-0" />
        {!sidebarCollapsed && <span className="ml-3 font-bold">KyvonOPS</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={clsx(
                  'flex items-center rounded-md px-2 py-2 hover:bg-elevated transition-colors',
                  location.pathname.startsWith(item.path) ? 'bg-elevated text-white' : 'text-secondary'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 text-sm">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};