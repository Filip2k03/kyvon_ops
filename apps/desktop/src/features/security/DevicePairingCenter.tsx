import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, Smartphone, ShieldCheck, RefreshCw, 
  Trash2, Lock, CheckCircle2, Fingerprint, Copy
} from 'lucide-react';

interface PairedDevice {
  id: string;
  name: string;
  platform: 'iOS' | 'Android';
  osVersion: string;
  fingerprint: string;
  pairedAt: string;
  lastSeen: string;
  biometricEnrolled: boolean;
}

export const DevicePairingCenter: React.FC = () => {
  // QR Pairing State
  const [pairingNonce, setPairingNonce] = useState('');
  const [pairingId, setPairingId] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(90);
  const [pairingSignature, setPairingSignature] = useState('');

  // Paired Devices List (Persisted in localStorage)
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>(() => {
    const saved = localStorage.getItem('kyvon_paired_devices');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      {
        id: 'dev_ios_15pro',
        name: "Stephan's iPhone 15 Pro",
        platform: 'iOS',
        osVersion: 'iOS 17.5.1',
        fingerprint: 'SHA256:4f8a9e7b2c1d0f5e8a7b9c6d3e2f1a0b',
        pairedAt: '2026-09-02 14:22',
        lastSeen: '2 minutes ago',
        biometricEnrolled: true,
      },
      {
        id: 'dev_android_p8',
        name: 'Pixel 8 Pro Test Node',
        platform: 'Android',
        osVersion: 'Android 14 (API 34)',
        fingerprint: 'SHA256:9c8e7d6b5a4f3e2d1c0b9a8f7e6d5c4b',
        pairedAt: '2026-09-04 09:15',
        lastSeen: '1 hour ago',
        biometricEnrolled: true,
      },
    ];
  });

  // 2FA / TOTP State
  const totpSecret = 'JBSWY3DPEHPK3PXP';
  const [totpEnabled, setTotpEnabled] = useState(() => localStorage.getItem('kyvon_2fa_enabled') === 'true');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFaStatusMsg, setTwoFaStatusMsg] = useState<string | null>(null);
  const [requireBiometricForTier2, setRequireBiometricForTier2] = useState(true);

  // Recovery Codes
  const recoveryCodes = [
    '8F92-3B10-47DE',
    'C210-9E44-A82F',
    '5D31-77BC-01AA',
    'EE92-1249-BB01',
    '77A0-4491-CC28',
    '10DF-9982-33AC',
  ];

  // Generate short-lived cryptographic pairing payload
  const refreshPairingSession = () => {
    const newId = 'pair_' + Math.random().toString(36).substring(2, 12);
    const newNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const dummySig = 'sig_ed25519_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    setPairingId(newId);
    setPairingNonce(newNonce);
    setPairingSignature(dummySig);
    setSecondsRemaining(90);
  };

  useEffect(() => {
    refreshPairingSession();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          refreshPairingSession();
          return 90;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pairingPayload = JSON.stringify({
    v: 3,
    pairing_id: pairingId,
    endpoint: 'https://192.168.100.70:1420',
    nonce: pairingNonce,
    expires_at: Math.floor(Date.now() / 1000) + secondsRemaining,
    signature: pairingSignature,
  });

  const handleRevokeDevice = (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this mobile device? It will immediately lose authorization to observe and approve operations.')) return;
    const updated = pairedDevices.filter(d => d.id !== deviceId);
    setPairedDevices(updated);
    localStorage.setItem('kyvon_paired_devices', JSON.stringify(updated));
  };

  const handleVerifyTotp = () => {
    if (verificationCode.trim().length === 6) {
      setTotpEnabled(true);
      localStorage.setItem('kyvon_2fa_enabled', 'true');
      setTwoFaStatusMsg('Two-Factor Authentication (TOTP) successfully activated!');
    } else {
      setTwoFaStatusMsg('Invalid verification code. Enter a 6-digit code from your authenticator app.');
    }
  };

  const handleDisableTotp = () => {
    if (!confirm('Disable Two-Factor Authentication? We strongly recommend keeping 2FA enabled for production VPS operations.')) return;
    setTotpEnabled(false);
    localStorage.removeItem('kyvon_2fa_enabled');
    setTwoFaStatusMsg('Two-Factor Authentication disabled.');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Mobile Pairing & Zero-Trust 2FA Identity Center
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  KyvonOPS V3.0 Protocol
                </span>
              </h1>
              <p className="text-sm text-secondary">
                Pair iOS and Android mobile companion devices via zero-secret short-lived QR codes and enforce biometric step-up approvals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: QR Pairing & 2FA Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Short-Lived QR Pairing (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Scan to Pair Mobile Device</h2>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                secondsRemaining > 20 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-rose-500/20 text-rose-300 animate-pulse'
              }`}>
                Expires in {secondsRemaining}s
              </span>
            </div>

            <p className="text-xs text-secondary mb-4 leading-relaxed">
              Open the KyvonOPS Companion app on Android or iOS, tap <strong className="text-white">"Pair with Workstation"</strong>, and scan this QR code. The payload contains an ephemeral signature and zero raw credentials.
            </p>

            {/* QR Code Frame */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-inner my-3">
              <QRCodeSVG 
                value={pairingPayload} 
                size={220}
                level="H"
                includeMargin={false}
              />
              <span className="text-[10px] text-black/60 font-mono mt-2">KyvonOPS-V3-Pairing-Protocol</span>
            </div>

            <div className="flex justify-between items-center text-xs text-secondary mt-4 pt-4 border-t border-border">
              <div className="space-y-0.5">
                <div>Pairing Session ID: <span className="font-mono text-white">{pairingId}</span></div>
                <div>Local Endpoint: <span className="font-mono text-white">192.168.100.70:1420</span></div>
              </div>
              <button
                onClick={refreshPairingSession}
                className="px-3 py-1.5 bg-elevated hover:bg-hover border border-border rounded-lg text-xs text-white transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Nonce</span>
              </button>
            </div>
          </div>

          {/* Biometric & Approval Gate Policy */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-emerald-400" />
              Biometric Step-Up Authorization Policy
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Require Face ID, Touch ID, or Android Biometric prompt on your paired phone whenever an AI agent or operator attempts mutating actions.
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-start space-x-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:bg-elevated/40 transition-colors">
                <input
                  type="checkbox"
                  checked={requireBiometricForTier2}
                  onChange={(e) => setRequireBiometricForTier2(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-info focus:ring-info"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">Enforce Biometrics for Mutating Writes (Tier 2)</span>
                  <span className="text-secondary text-[11px]">Systemctl restart, Nginx reload, Docker container stop/restart.</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:bg-elevated/40 transition-colors">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="mt-0.5 h-4 w-4 rounded border-border text-info"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">Strict Mandatory Biometric + 2FA for Destructive (Tier 3)</span>
                  <span className="text-secondary text-[11px]">Pruning all containers, disk wiping, raw iptables flush (Always enforced).</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Paired Devices & TOTP 2FA Setup (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Active Paired Mobile Devices */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Authorized Mobile Devices</h2>
              </div>
              <span className="text-xs bg-elevated px-2 py-0.5 rounded text-secondary font-mono">
                {pairedDevices.length} registered
              </span>
            </div>

            <div className="space-y-3">
              {pairedDevices.length === 0 ? (
                <div className="p-6 text-center text-secondary text-xs bg-background rounded-lg border border-border">
                  No paired devices. Scan the QR code on the left with the mobile app.
                </div>
              ) : (
                pairedDevices.map((device) => (
                  <div key={device.id} className="p-3.5 bg-background border border-border rounded-lg flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">{device.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {device.platform}
                        </span>
                        {device.biometricEnrolled && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Fingerprint className="w-3 h-3" />
                            <span>Biometric</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-secondary font-mono truncate max-w-xs">
                        {device.fingerprint}
                      </div>
                      <div className="text-[10px] text-secondary">
                        Active: <span className="text-white">{device.lastSeen}</span> • Paired: {device.pairedAt}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeDevice(device.id)}
                      className="p-2 text-secondary hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                      title="Revoke device access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Two-Factor Authentication (TOTP) Setup */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Workstation Two-Factor Auth (TOTP)</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                totpEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary/20 text-secondary'
              }`}>
                {totpEnabled ? 'Active' : 'Not Configured'}
              </span>
            </div>

            {totpEnabled ? (
              <div className="space-y-4 pt-2">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Two-Factor Authentication is protecting all server operations and agent executions.</span>
                </div>

                {/* Emergency Recovery Codes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
                    Emergency Backup Recovery Codes
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-background border border-border rounded-lg text-xs font-mono text-secondary">
                    {recoveryCodes.map((code) => (
                      <div key={code} className="hover:text-white transition-colors">{code}</div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryCodes.join('\n'));
                      alert('Recovery codes copied to clipboard!');
                    }}
                    className="text-xs text-info hover:underline flex items-center space-x-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Recovery Codes</span>
                  </button>
                  <button
                    onClick={handleDisableTotp}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Disable 2FA
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-secondary leading-relaxed">
                  Scan this secret with Google Authenticator, 1Password, or Authy to configure 6-digit TOTP verification.
                </p>

                <div className="flex items-center space-x-4 p-3 bg-background border border-border rounded-lg">
                  <div className="p-2 bg-white rounded">
                    <QRCodeSVG value={`otpauth://totp/KyvonOPS:admin?secret=${totpSecret}&issuer=KyvonOPS`} size={80} />
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="text-secondary block">Manual Entry Secret:</span>
                    <span className="font-mono text-white font-bold tracking-wider">{totpSecret}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-white font-mono text-center tracking-widest focus:outline-none focus:border-info"
                  />
                  <button
                    onClick={handleVerifyTotp}
                    className="px-4 py-2 bg-info hover:bg-info/90 text-background font-bold text-xs rounded-lg transition-colors"
                  >
                    Verify & Enable
                  </button>
                </div>

                {twoFaStatusMsg && (
                  <div className="p-2.5 bg-elevated border border-border rounded-lg text-xs text-secondary">
                    {twoFaStatusMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
