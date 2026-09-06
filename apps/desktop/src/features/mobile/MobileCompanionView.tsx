import React from 'react';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { NoDataState } from '../../components/ui/NoDataState';
import { hasBackend } from '../../lib/backend';

/**
 * Companion UI previously invented servers, incidents, and biometric approvals.
 * V4.1 has no companion API, so this route stays honest.
 */
export const MobileCompanionView: React.FC = () => {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-border bg-elevated p-3 text-info">
          <Smartphone className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Mobile companion</h1>
          <p className="text-xs text-secondary">No companion session in this build</p>
        </div>
      </div>
      <NoDataState
        variant="unavailable"
        title="Companion metrics and remote approvals are not available"
        detail={
          hasBackend()
            ? 'There is no paired-device ledger or biometric approval channel. Host operations stay on this workstation over SSH.'
            : 'The public website cannot operate a VPS. Use the desktop app on a machine that can reach the host.'
        }
        action={
          <Link to={hasBackend() ? '/servers' : '/downloads'} className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            {hasBackend() ? 'Open servers' : 'Downloads'}
          </Link>
        }
      />
    </div>
  );
};
