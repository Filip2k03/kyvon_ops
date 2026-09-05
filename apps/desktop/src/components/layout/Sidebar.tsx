import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, Server, Terminal, Cpu, HardDrive, Shield, FileText, 
  Settings, Network, Boxes, Zap, Globe, Sparkles, Smartphone, Download,
  Monitor, QrCode, Briefcase, Radio, Share2, X
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import clsx from 'clsx';

const navItems = [
  { path: '/landing', icon: Sparkles, label: 'Landing & 3D Tour' },
  { path: '/command-center', icon: Activity, label: 'Command Center' },
  { path: '/companion', icon: Radio, label: 'Mobile Companion' },
  { path: '/servers', icon: Server, label: 'Servers' },
  { path: '/clients', icon: Briefcase, label: 'Client Workspaces' },
  { path: '/vps-matrix', icon: Monitor, label: 'VPS Health Matrix' },
  { path: '/twin', icon: Network, label: 'Digital Twin & Risk' },
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
  { path: '/promotions', icon: Share2, label: 'Promotions Engine' },
  { path: '/downloads', icon: Download, label: 'Downloads & Donate' },
];

export const Sidebar = () => {
  const { sidebarCollapsed, mobileDrawerOpen, setMobileDrawerOpen } = useUiStore();
  const location = useLocation();

  const handleLinkClick = () => {
    if (mobileDrawerOpen) {
      setMobileDrawerOpen(false);
    }
  };

  const navContent = (
    <>
      <div className="p-4 flex items-center justify-between h-14 border-b border-border">
        <div className="flex items-center">
          <Server className="text-info w-6 h-6 shrink-0" />
          {(!sidebarCollapsed || mobileDrawerOpen) && <span className="ml-3 font-bold text-white">KyvonOPS</span>}
        </div>
        {mobileDrawerOpen && (
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden text-secondary hover:text-white p-1 rounded-lg hover:bg-elevated transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={handleLinkClick}
                className={clsx(
                  'flex items-center rounded-md px-3 py-2.5 min-h-[44px] hover:bg-elevated transition-colors text-xs font-medium',
                  location.pathname.startsWith(item.path) ? 'bg-elevated text-white font-bold' : 'text-secondary'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                {(!sidebarCollapsed || mobileDrawerOpen) && <span className="ml-3 text-sm">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={clsx(
          'hidden md:flex bg-surface border-r border-border flex-col transition-all duration-300',
          sidebarCollapsed ? 'w-14' : 'w-56'
        )}
      >
        {navContent}
      </aside>

      {/* Mobile Slide-over Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Pane */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-surface border-r border-border shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};