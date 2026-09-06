import { lazy, Suspense } from 'react';
import { hasBackend } from './lib/backend';
import { PublicWebsite } from './features/landing/PublicWebsite';

const DesktopApp = lazy(() => import('./DesktopApp'));

export default function App() {
  if (!hasBackend()) return <PublicWebsite />;

  return (
    <Suspense fallback={<p role="status" className="p-8">Opening your local workspace…</p>}>
      <DesktopApp />
    </Suspense>
  );
}
