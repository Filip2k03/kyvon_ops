import { ExternalLink, Heart } from 'lucide-react';

type SponsorBannerProps = {
  placement: 'public' | 'downloads';
};

function configuredSponsor(): { url: string; label: string; copy: string } | null {
  const enabled = import.meta.env.VITE_SPONSOR_BANNER_ENABLED === 'true';
  const url = import.meta.env.VITE_SPONSOR_URL?.trim() ?? '';
  if (!enabled || !/^https:\/\/[^\s]+$/i.test(url)) return null;

  return {
    url,
    label: import.meta.env.VITE_SPONSOR_LABEL?.trim() || 'Community sponsor',
    copy:
      import.meta.env.VITE_SPONSOR_COPY?.trim() ||
      'Support the tools and infrastructure that keep KyvonOPS maintained.',
  };
}

/**
 * A deliberately small, explicit sponsor placement.
 *
 * It is disabled unless the deployment owner supplies an HTTPS sponsor URL and
 * enables it. No ad network script, iframe, cookie, or operational telemetry
 * is loaded. Never mount this component inside the control-plane shell.
 */
export function SponsorBanner({ placement }: SponsorBannerProps) {
  const sponsor = configuredSponsor();
  if (!sponsor) return null;

  return (
    <aside
      aria-label={`${sponsor.label} sponsorship`}
      data-sponsor-placement={placement}
      className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Heart aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
              {sponsor.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{sponsor.copy}</p>
          </div>
        </div>
        <a
          href={sponsor.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-400/30 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          Learn more <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>
      </div>
    </aside>
  );
}
