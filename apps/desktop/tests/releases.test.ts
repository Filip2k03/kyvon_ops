import { describe, expect, test } from 'bun:test';
import { detectPlatform, formatSize, toVariants, type ReleaseAsset } from '../src/lib/releases';

/** Asset names as `tauri-action` and the mobile scripts actually produce them. */
const asset = (name: string, size = 1024): ReleaseAsset => ({
  name,
  browser_download_url: `https://example.invalid/${name}`,
  size,
  download_count: 0,
});

describe('classifying release assets', () => {
  test('places each installer on the right platform', () => {
    const variants = toVariants([
      asset('KyvonOPS_3.0.0_universal.dmg'),
      asset('KyvonOPS_3.0.0_x64_en-US.msi'),
      asset('KyvonOPS_3.0.0_x64-setup.exe'),
      asset('kyvon-ops_3.0.0_amd64.AppImage'),
      asset('kyvon-ops_3.0.0_amd64.deb'),
      asset('app-release.apk'),
    ]);

    const byFormat = Object.fromEntries(variants.map((v) => [v.format, v.platform]));
    expect(byFormat).toEqual({
      DMG: 'macOS',
      MSI: 'Windows',
      Installer: 'Windows',
      AppImage: 'Linux',
      DEB: 'Linux',
      APK: 'Android',
    });
  });

  test('reads the architecture out of the filename', () => {
    const variants = toVariants([
      asset('kyvon-agent-aarch64-unknown-linux-musl.tar.gz'),
      asset('kyvon-ops_3.0.0_amd64.deb'),
      asset('kyvon-agent-armv7-unknown-linux-musleabi.tar.gz'),
    ]);
    expect(variants.map((v) => v.arch).sort()).toEqual(['ARM64', 'ARMv7', 'Intel']);
  });

  test('a macOS build with no architecture in its name is universal, not unknown', () => {
    // Every macOS bundle this project ships is a universal binary, so
    // "Unknown" would be less accurate here rather than more cautious.
    const [dmg] = toVariants([asset('KyvonOPS_3.0.0_aarch64.dmg')]);
    expect(dmg.arch).toBe('ARM64');
    const [plain] = toVariants([asset('KyvonOPS.dmg')]);
    expect(plain.arch).toBe('Universal');
  });

  test('signatures and checksums are evidence, not downloads', () => {
    const variants = toVariants([
      asset('KyvonOPS_3.0.0_universal.dmg'),
      asset('KyvonOPS_3.0.0_universal.dmg.sig'),
      asset('kyvon-ops_3.0.0_amd64.deb'),
    ]);

    expect(variants).toHaveLength(2);
    expect(variants.find((v) => v.format === 'DMG')?.verifiable).toBe(true);
    // Not signed, and the page must say so rather than implying every
    // download can be verified.
    expect(variants.find((v) => v.format === 'DEB')?.verifiable).toBe(false);
  });

  test('an unrecognised asset is surfaced, never guessed onto a platform', () => {
    // Offering someone the wrong binary is worse than telling them a file
    // could not be classified.
    const [unknown] = toVariants([asset('some-new-artifact.bin')]);
    expect(unknown.platform).toBe('Other');
    expect(unknown.format).toBe('Archive');
  });

  test('an empty release yields no variants rather than placeholder rows', () => {
    expect(toVariants([])).toEqual([]);
  });
});

describe('detecting the visitor platform', () => {
  test.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iOS'],
  ])('%s', (ua, expected) => {
    expect(detectPlatform(ua)).toBe(expected);
  });

  test('android is not mistaken for linux, and ios not for macos', () => {
    // Both contain the desktop token, so ordering in the matcher matters.
    expect(detectPlatform('Linux; Android 14')).toBe('Android');
    expect(detectPlatform('iPhone; CPU iPhone OS like Mac OS X')).toBe('iOS');
  });

  test('an unknown agent is Other, so no tab is preselected wrongly', () => {
    expect(detectPlatform('curl/8.4.0')).toBe('Other');
  });
});

describe('formatting sizes', () => {
  test('scales to a readable unit', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(12 * 1024 * 1024)).toBe('12.0 MB');
  });

  test('a missing size says so instead of showing 0', () => {
    expect(formatSize(0)).toBe('unknown size');
  });
});
