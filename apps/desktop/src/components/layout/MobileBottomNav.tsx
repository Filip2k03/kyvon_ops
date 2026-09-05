import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Server, Radio, Network, Menu } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import clsx from 'clsx';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { toggleMobileDrawer, mobileDrawerOpen } = useUiStore();

  const navItems = [
    { path: '/command-center', icon: Activity, label: 'Home' },
    { path: '/servers', icon: Server, label: 'Servers' },
    { path: '/companion', icon: Radio, label: 'Companion' },
    { path: '/twin', icon: Network, label: 'Twin' },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border shadow-2xl safe-area-pb"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto items-center px-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors rounded-lg',
                isActive ? 'text-info font-bold' : 'text-secondary hover:text-white'
              )}
            >
              <Icon className={clsx('w-5 h-5', isActive && 'stroke-[2.2]')} strokeWidth={1.75} />
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu / Drawer Toggle */}
        <button
          onClick={toggleMobileDrawer}
          className={clsx(
            'flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors rounded-lg',
            mobileDrawerOpen ? 'text-info font-bold' : 'text-secondary hover:text-white'
          )}
          aria-label="Toggle All Tools Menu"
        >
          <Menu className={clsx('w-5 h-5', mobileDrawerOpen && 'stroke-[2.2]')} strokeWidth={1.75} />
          <span className="text-[10px] tracking-tight mt-0.5">More</span>
        </button>
      </div>
    </nav>
  );
};
