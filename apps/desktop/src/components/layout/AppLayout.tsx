import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { CommandPalette } from '../ui/CommandPalette';

export const AppLayout = () => {
  return (
    <div className="flex h-screen bg-background text-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto bg-background p-3.5 sm:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <CommandPalette />
    </div>
  );
};