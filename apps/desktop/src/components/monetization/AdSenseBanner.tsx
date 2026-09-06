import { useEffect, useId } from 'react';

type AdSenseWindow = Window & {
  adsbygoogle?: Array<Record<string, unknown>>;
};

type AdSenseBannerProps = {
  slotId?: string;
};

function config() {
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.trim() ?? '';
  const configuredSlot = import.meta.env.VITE_ADSENSE_SLOT_ID?.trim() ?? '';
  const enabled = import.meta.env.VITE_ADSENSE_ENABLED === 'true';
  if (!enabled || !/^ca-pub-\d{10,}$/.test(publisherId)) return null;
  return { publisherId, slotId: configuredSlot };
}

/**
 * Public-site-only AdSense placement. It stays disabled until the site is
 * approved, a slot ID exists, and regional consent messaging is configured.
 */
export function AdSenseBanner({ slotId }: AdSenseBannerProps) {
  const elementId = useId().replace(/:/g, '');
  const settings = config();
  const resolvedSlot = slotId?.trim() || settings?.slotId || '';

  useEffect(() => {
    if (!settings || !resolvedSlot) return;

    const scriptId = 'kyvonops-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.publisherId}`;
      document.head.appendChild(script);
    }

    const ads = (window as AdSenseWindow).adsbygoogle || [];
    (window as AdSenseWindow).adsbygoogle = ads;
    try {
      ads.push({});
    } catch {
      // AdSense may be blocked by consent or an extension; the public page
      // remains usable and does not report an ad as successfully loaded.
    }
  }, [resolvedSlot, settings]);

  if (!settings || !resolvedSlot) return null;

  return (
    <aside aria-label="Advertisement" className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Advertisement</p>
      <ins
        id={`adsense-${elementId}`}
        className="adsbygoogle block min-h-[90px]"
        style={{ display: 'block' }}
        data-ad-client={settings.publisherId}
        data-ad-slot={resolvedSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
