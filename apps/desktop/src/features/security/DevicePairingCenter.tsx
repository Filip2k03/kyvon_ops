import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { NoDataState } from '../../components/ui/NoDataState';

/**
 * Mobile pairing and hosted TOTP are not implemented in V4.1.
 *
 * A previous screen generated QR payloads pointing at a private LAN Vite
 * URL, used Math.random for pairing ids, stored a well-known TOTP demo
 * secret in source, and invented paired devices. That is unsafe to ship.
 */
export const DevicePairingCenter: React.FC = () => {
  useEffect(() => {
    try {
      localStorage.removeItem('kyvon_paired_devices');
      localStorage.removeItem('kyvon_2fa_enabled');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-border bg-elevated p-3 text-info">
          <QrCode className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Device pairing</h1>
          <p className="text-xs text-secondary">Not available in this build</p>
        </div>
      </div>
      <NoDataState
        variant="unavailable"
        title="QR pairing and hosted TOTP are not in V4.1"
        detail="KyvonOPS authenticates to hosts with SSH from this workstation. There is no pairing nonce service, no TOTP enrollment API, and no device ledger. A QR code here would have been a pretend session, so nothing is generated. SSH passwords stay in the OS keychain when you add a server."
        action={
          <Link to="/servers" className="rounded-lg bg-info px-4 py-2 text-xs font-semibold text-white">
            Connect a VPS instead
          </Link>
        }
      />
    </div>
  );
};
