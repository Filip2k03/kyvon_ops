import { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  CheckCircle2,
  Download,
  Github,
  Loader2,
  Monitor,
  Package,
  ShieldAlert,
  Smartphone,
  Terminal,
} from 'lucide-react';
import {
  detectPlatform,
  fetchLatestRelease,
  formatSize,
  type Platform,
  type ReleaseState,
  type Variant,
} from '../../lib/releases';

const repository = 'https://github.com/Filip2k03/kyvon_ops';
const installScript =
  'https://raw.githubusercontent.com/Filip2k03/kyvon_ops/main/scripts/install.sh';
const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400';

const PLATFORM_ICON: Record<Platform, typeof Monitor> = {
  macOS: Apple,
  Windows: Monitor,
  Linux: Terminal,
  Android: Smartphone,
  iOS: Smartphone,
  Other: Package,
};

const ORDER: Platform[] = ['macOS', 'Windows', 'Linux', 'Android', 'iOS', 'Other'];

/**
 * The public download page.
 *
 * Everything here comes from the GitHub releases API at view time. Nothing is
 * hardcoded, because a hardcoded download button is a promise the project
 * cannot keep: the repository has no releases until a tag is pushed, and a
 * page offering installers that do not exist is the same class of fabrication
 * as a dashboard showing invented metrics.
 *
 * So there are four distinct renderings — loading, a real release, no release
 * yet, and a failed lookup — and a visitor can always tell which one they are
 * looking at.
 */
export function Downloads() {
  const [state, setState] = useState<ReleaseState>({ state: 'loading' });
  const [selected, setSelected] = useState<Platform | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLatestRelease(controller.signal).then((result) => {
      if (!controller.signal.aborted) setState(result);
    });
    return () => controller.abort();
  }, []);

  const variants = state.state === 'ok' ? state.variants : [];

  const platforms = useMemo(() => {
    const present = new Set(variants.map((v) => v.platform));
    return ORDER.filter((p) => present.has(p));
  }, [variants]);

  // Preselect the visitor's own platform when this release actually ships for
  // it; otherwise leave the first tab, rather than showing an empty panel.
  const active =
    selected ??
    (() => {
      const guess = detectPlatform(navigator.userAgent, navigator.platform);
      return platforms.includes(guess) ? guess : (platforms[0] ?? null);
    })();

  const shown = variants.filter((v) => v.platform === active);

  return (
    <section id="downloads" className="scroll-mt-24 py-16">
      <p className="text-sm font-medium text-sky-400">Install on your workstation</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">Get KyvonOPS</h2>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">
        Every build below is read from the project&rsquo;s published releases when this page loads.
        KyvonOPS is local-first: it runs on your machine and connects to your own servers, so
        nothing here asks for credentials or account sign-up.
      </p>

      {state.state === 'loading' && (
        <p role="status" className="mt-8 flex items-center gap-3 text-sm text-slate-400">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Checking published releases&hellip;
        </p>
      )}

      {/*
        Rendered in every state, including before the fetch resolves and when
        it fails. GitHub's own releases page is the canonical list, and a
        visitor must always be able to reach it — the availability and signing
        status of any build are properties of the release, not of this page,
        and are not verified here.
      */}
      <p className="mt-6 text-sm leading-6 text-slate-400">
        Every build is published on GitHub with its release notes and checksums.{' '}
        <a
          className="text-sky-400 underline underline-offset-4 hover:text-sky-300"
          href={`${repository}/releases`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Browse all releases
        </a>
        . Availability is not verified by this website — install only artifacts published by the
        project, and check the signature where one is provided.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/5 p-6">
          <div className="flex items-center gap-3">
            <Monitor aria-hidden="true" className="h-5 w-5 text-sky-300" />
            <h3 className="text-lg font-medium">Recommended: desktop app</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use a published, signed release for normal workstation use. The desktop app keeps your
            server profiles and credentials on your machine.
          </p>
          <a
            className={`${button} mt-5 border border-sky-400/40 text-sky-200 hover:bg-sky-400/10`}
            href={`${repository}/releases`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github aria-hidden="true" className="h-4 w-4" /> Browse desktop releases
          </a>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
          <div className="flex items-center gap-3">
            <Terminal aria-hidden="true" className="h-5 w-5 text-slate-300" />
            <h3 className="text-lg font-medium">Source setup helper</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            For contributors without a published installer, clone the repository, inspect the reviewed
            script, then run the locked dependency setup. It does not configure a server or handle secrets.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950/70 p-3 text-xs leading-6 text-slate-300"><code>{`git clone ${repository}.git
cd kyvon_ops
./scripts/install.sh --check
./scripts/install.sh --frontend`}</code></pre>
          <a
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-sky-300 underline underline-offset-4 hover:text-sky-200"
            href={installScript}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download aria-hidden="true" className="h-4 w-4" /> Inspect install.sh
          </a>
        </div>
      </div>

      {state.state === 'none' && (
        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/50 p-6 sm:p-8">
          <Package aria-hidden="true" className="h-6 w-6 text-sky-400" />
          <h3 className="mt-4 text-xl font-medium">No release published yet</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{state.detail}</p>
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Build it yourself
            </p>
            <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-300">
              <code>{`git clone ${repository}.git
cd kyvon_ops/apps/desktop
bun install
bun run tauri build`}</code>
            </pre>
            <p className="mt-3 text-xs leading-6 text-slate-400">
              Requires Rust and the Tauri prerequisites for your platform. The Rust workspace and
              its tests run with <code className="text-slate-300">cargo test --workspace</code>.
            </p>
          </div>
          <a
            className={`${button} mt-6 border border-slate-700 hover:bg-slate-800`}
            href={`${repository}/releases`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github aria-hidden="true" className="h-4 w-4" /> Watch for releases
          </a>
        </div>
      )}

      {state.state === 'failed' && (
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <ShieldAlert aria-hidden="true" className="h-6 w-6 text-amber-400" />
          <h3 className="mt-4 text-xl font-medium">Could not check for releases</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{state.detail}</p>
          <a
            className={`${button} mt-5 border border-slate-700 hover:bg-slate-800`}
            href={`${repository}/releases`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github aria-hidden="true" className="h-4 w-4" /> Open releases on GitHub
          </a>
        </div>
      )}

      {state.state === 'ok' && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-sky-400/25 bg-sky-400/5 px-3 py-1 font-mono text-sky-300">
              {state.release.tag_name}
            </span>
            {state.release.prerelease && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1 text-amber-300">
                Pre-release
              </span>
            )}
            <span className="text-slate-400">
              Published {new Date(state.release.published_at).toLocaleDateString()}
            </span>
          </div>

          {platforms.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
              <h3 className="text-xl font-medium">This release has no downloadable builds</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                The release <code className="text-slate-300">{state.release.tag_name}</code> was
                published without installer assets, so there is nothing to offer here yet.
              </p>
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Choose your platform"
                className="mt-8 flex flex-wrap gap-2"
              >
                {platforms.map((platform) => {
                  const Icon = PLATFORM_ICON[platform];
                  const isActive = platform === active;
                  return (
                    <button
                      key={platform}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      onClick={() => setSelected(platform)}
                      className={`${button} border ${
                        isActive
                          ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" /> {platform}
                    </button>
                  );
                })}
              </div>

              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {shown.map((variant) => (
                  <VariantCard key={variant.asset.name} variant={variant} />
                ))}
              </ul>
            </>
          )}

          <a
            className={`${button} mt-8 text-slate-400 hover:text-white`}
            href={state.release.html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github aria-hidden="true" className="h-4 w-4" /> Release notes and every asset
          </a>
        </>
      )}
    </section>
  );
}

function VariantCard({ variant }: { variant: Variant }) {
  const { asset, arch, format, verifiable } = variant;
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-medium">{format}</h3>
        <span className="rounded border border-slate-700 px-2 py-0.5 font-mono text-xs text-slate-400">
          {arch}
        </span>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-slate-500">{asset.name}</p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
        <div className="flex gap-1.5">
          <dt>Size</dt>
          <dd className="text-slate-300">{formatSize(asset.size)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Downloads</dt>
          <dd className="text-slate-300">{asset.download_count.toLocaleString()}</dd>
        </div>
      </dl>

      {/*
        Verification is stated either way. Implying a signature exists when it
        does not would encourage someone to skip the check they think they made.
      */}
      <p
        className={`mt-4 flex items-center gap-2 text-xs ${
          verifiable ? 'text-emerald-400' : 'text-slate-500'
        }`}
      >
        {verifiable ? (
          <>
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            A signature is published alongside this file
          </>
        ) : (
          <>
            <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
            No signature published for this file
          </>
        )}
      </p>

      <a
        className={`${button} mt-5 w-full bg-sky-400 text-slate-950 hover:bg-sky-300`}
        href={asset.browser_download_url}
      >
        <Download aria-hidden="true" className="h-4 w-4" /> Download
      </a>
    </li>
  );
}
