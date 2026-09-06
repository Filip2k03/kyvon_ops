/**
 * Turning a GitHub release into download variants a visitor can choose from.
 *
 * The public site must not invent a download. Until a tag is pushed the
 * repository has no releases at all, and a page showing platform buttons that
 * lead nowhere is the same fabrication as a dashboard showing invented CPU —
 * so every outcome here is explicit, and the UI renders each one differently.
 *
 * Classification is done on the asset filename because that is all the API
 * gives us. It is therefore best-effort by nature, and an asset it cannot
 * place is surfaced as `Other` rather than guessed into a platform where it
 * would offer someone the wrong binary.
 */

export type Platform = 'macOS' | 'Windows' | 'Linux' | 'Android' | 'iOS' | 'Other';
export type Arch = 'Apple silicon' | 'Intel' | 'Universal' | 'ARM64' | 'ARMv7' | 'Unknown';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  /** GitHub's own download counter; shown as evidence, never invented. */
  download_count: number;
}

export interface Release {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  body: string | null;
  assets: ReleaseAsset[];
}

/** One downloadable artifact, classified for display. */
export interface Variant {
  asset: ReleaseAsset;
  platform: Platform;
  arch: Arch;
  /** Installer kind as a visitor would name it: "DMG", "MSI", "AppImage". */
  format: string;
  /**
   * True when a detached signature or checksum for this asset is also
   * published, so the page can tell someone whether verification is possible
   * rather than implying it always is.
   */
  verifiable: boolean;
}

export type ReleaseState =
  | { state: 'loading' }
  | { state: 'ok'; release: Release; variants: Variant[] }
  | { state: 'none'; detail: string }
  | { state: 'failed'; detail: string };

const EXTENSION_FORMATS: Array<[RegExp, string, Platform]> = [
  [/\.dmg$/i, 'DMG', 'macOS'],
  [/\.app\.tar\.gz$/i, 'App bundle', 'macOS'],
  [/\.msi$/i, 'MSI', 'Windows'],
  [/-setup\.exe$/i, 'Installer', 'Windows'],
  [/\.exe$/i, 'Executable', 'Windows'],
  [/\.appimage$/i, 'AppImage', 'Linux'],
  [/\.deb$/i, 'DEB', 'Linux'],
  [/\.rpm$/i, 'RPM', 'Linux'],
  [/\.apk$/i, 'APK', 'Android'],
  [/\.aab$/i, 'App Bundle', 'Android'],
  [/\.ipa$/i, 'IPA', 'iOS'],
];

/** Files that accompany a download rather than being one. */
function isCompanion(name: string): boolean {
  return /\.(sig|asc|sha256|sha512|sbom\.json)$/i.test(name);
}

function detectArch(name: string): Arch {
  const n = name.toLowerCase();
  if (/universal/.test(n)) return 'Universal';
  if (/aarch64|arm64/.test(n)) return 'ARM64';
  if (/armv7|armhf/.test(n)) return 'ARMv7';
  if (/x86_64|x64|amd64/.test(n)) return 'Intel';
  return 'Unknown';
}

/**
 * Classify a release's assets into variants.
 *
 * Companion files (`.sig`, `.sha256`) are not variants; they are evidence that
 * a variant can be verified, which is what `verifiable` records.
 */
export function toVariants(assets: ReleaseAsset[]): Variant[] {
  const companions = new Set(
    assets.filter((a) => isCompanion(a.name)).map((a) => a.name.replace(/\.[^.]+$/, '')),
  );

  return assets
    .filter((a) => !isCompanion(a.name))
    .map((asset) => {
      const match = EXTENSION_FORMATS.find(([pattern]) => pattern.test(asset.name));
      const [, format, platform] = match ?? [null, 'Archive', 'Other' as Platform];
      let arch = detectArch(asset.name);
      // A macOS .dmg with no architecture in its name is a universal build in
      // every configuration this project ships; saying "Unknown" there would
      // be less accurate, not more.
      if (platform === 'macOS' && arch === 'Unknown') arch = 'Universal';
      return {
        asset,
        platform,
        arch,
        format,
        verifiable: companions.has(asset.name),
      };
    })
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.arch.localeCompare(b.arch));
}

/** Best guess at the visitor's platform, for preselecting a tab. */
export function detectPlatform(userAgent: string, platformHint = ''): Platform {
  const ua = `${userAgent} ${platformHint}`.toLowerCase();
  if (/android/.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/mac/.test(ua)) return 'macOS';
  if (/win/.test(ua)) return 'Windows';
  if (/linux|x11/.test(ua)) return 'Linux';
  return 'Other';
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return 'unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const RELEASES_API = 'https://api.github.com/repos/Filip2k03/kyvon_ops/releases/latest';

/**
 * Fetch the latest published release.
 *
 * A 404 means no release has been tagged yet, which is a legitimate state and
 * not an error — the page explains how to build from source instead. Anything
 * else is reported as a failure with the status, so a rate limit is
 * distinguishable from an outage (§118).
 */
export async function fetchLatestRelease(signal?: AbortSignal): Promise<ReleaseState> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    });

    if (response.status === 404) {
      return {
        state: 'none',
        detail:
          'No release has been published yet. KyvonOPS V3.0 is still in development, so there is nothing to install from this page — you can build it from source, or watch the repository to be notified when the first release is tagged.',
      };
    }
    if (!response.ok) {
      return {
        state: 'failed',
        detail: `GitHub returned ${response.status} ${response.statusText}. This is usually a rate limit on unauthenticated requests; the releases page on GitHub always works.`,
      };
    }

    const release = (await response.json()) as Release;
    return { state: 'ok', release, variants: toVariants(release.assets ?? []) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { state: 'loading' };
    }
    return {
      state: 'failed',
      detail: `Could not reach the GitHub releases API: ${
        error instanceof Error ? error.message : String(error)
      }. Check your network, or open the releases page directly.`,
    };
  }
}
