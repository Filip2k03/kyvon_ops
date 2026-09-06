/**
 * Reader-controlled appearance: text size, contrast, motion, and palette warmth.
 *
 * Two principles shape this module.
 *
 * **The operating system is the default, not the fallback.** Someone who has
 * already told their OS they want reduced motion or higher contrast should not
 * have to say it again here. The stored settings therefore express a
 * *deviation* the reader chose deliberately; anything they have not touched
 * follows the system and keeps following it when the system changes.
 *
 * **Nothing here claims a health benefit.** The warmth control reduces blue in
 * the palette, and that is exactly how it is labelled. Whether that reduces
 * eye strain is genuinely unsettled, and this codebase does not assert things
 * it cannot demonstrate — the honest claim is that a warmer, dimmer screen is
 * more comfortable for many people at night, which is a preference, not a
 * medical outcome.
 */

/** Body text scale. 1 is the design size; the range is a readability aid. */
export type TextScale = 0.9 | 1 | 1.15 | 1.3;

/**
 * Contrast between text and its background.
 *
 * `standard` targets WCAG AA (4.5:1 for body text). `high` raises foreground
 * and border tokens toward AAA (7:1) and is what `prefers-contrast: more`
 * selects automatically.
 */
export type Contrast = 'standard' | 'high';

/** Whether non-essential animation runs. */
export type Motion = 'full' | 'reduced';

/**
 * How much blue is removed from the palette, 0 (none) to 3 (most).
 *
 * Applied as a colour shift on the surface tokens rather than a screen-wide
 * filter, so status colours keep their meaning — a warm overlay across the
 * whole window would drag `critical` red and `warning` amber toward each other,
 * and those two must stay tellable apart.
 */
export type Warmth = 0 | 1 | 2 | 3;

export interface AppearanceSettings {
  version: 1;
  textScale: TextScale;
  contrast: Contrast;
  motion: Motion;
  warmth: Warmth;
}

export const TEXT_SCALES: TextScale[] = [0.9, 1, 1.15, 1.3];
export const WARMTH_LEVELS: Warmth[] = [0, 1, 2, 3];

export const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  0.9: 'Compact',
  1: 'Default',
  1.15: 'Large',
  1.3: 'Largest',
};

export const WARMTH_LABELS: Record<Warmth, string> = {
  0: 'Neutral',
  1: 'Slightly warm',
  2: 'Warm',
  3: 'Warmest',
};

const STORAGE_KEY = 'kyvon.appearance.v1';

/** What the operating system is asking for, where it says anything. */
export function systemPreferences(): Pick<AppearanceSettings, 'contrast' | 'motion'> {
  const query = (q: string) => {
    try {
      return typeof window !== 'undefined' && window.matchMedia?.(q).matches === true;
    } catch {
      // Some embedded webviews throw rather than return false.
      return false;
    }
  };
  return {
    contrast: query('(prefers-contrast: more)') ? 'high' : 'standard',
    motion: query('(prefers-reduced-motion: reduce)') ? 'reduced' : 'full',
  };
}

export function defaultSettings(): AppearanceSettings {
  return { version: 1, textScale: 1, warmth: 0, ...systemPreferences() };
}

export function isValidSettings(value: unknown): value is AppearanceSettings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    s.version === 1 &&
    TEXT_SCALES.includes(s.textScale as TextScale) &&
    (s.contrast === 'standard' || s.contrast === 'high') &&
    (s.motion === 'full' || s.motion === 'reduced') &&
    WARMTH_LEVELS.includes(s.warmth as Warmth)
  );
}

/**
 * Read stored settings, falling back to the system defaults.
 *
 * A stored value that fails validation is discarded rather than repaired: a
 * half-understood settings object would apply some fields and silently ignore
 * others, which is harder to diagnose than starting clean.
 */
export function loadSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed: unknown = JSON.parse(raw);
    return isValidSettings(parsed) ? parsed : defaultSettings();
  } catch {
    // Private windows, cleared site data, or storage disabled entirely.
    return defaultSettings();
  }
}

export function saveSettings(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage being unavailable must not stop the setting taking effect for
    // this session, so this is deliberately silent.
  }
}

/**
 * The CSS custom properties a given set of settings produces.
 *
 * Returned as data rather than written directly so the mapping is testable
 * without a DOM — the values are the contract, and a regression in them is a
 * visual bug that no snapshot would catch clearly.
 */
export function cssVariables(settings: AppearanceSettings): Record<string, string> {
  // Warmth shifts surfaces toward amber by lifting red and dropping blue.
  // Small numbers: at level 3 the background moves about 5% of the way, which
  // is visible without disturbing which token is which.
  const warm = settings.warmth;

  const surfaces =
    settings.contrast === 'high'
      ? { bg: [3, 4, 6], surface: [8, 10, 13], elevated: [18, 21, 26], border: [64, 71, 82] }
      : { bg: [8, 9, 11], surface: [14, 16, 20], elevated: [20, 23, 28], border: [37, 42, 50] };

  const shift = ([r, g, b]: number[]) =>
    `rgb(${Math.round(r + warm * 2.2)} ${Math.round(g + warm * 0.9)} ${Math.max(0, Math.round(b - warm * 1.1))})`;

  return {
    '--kyvon-text-scale': String(settings.textScale),
    '--kyvon-bg': shift(surfaces.bg),
    '--kyvon-surface': shift(surfaces.surface),
    '--kyvon-elevated': shift(surfaces.elevated),
    '--kyvon-border': shift(surfaces.border),
    // Foreground lifts with contrast; secondary text is what fails WCAG first.
    '--kyvon-fg': settings.contrast === 'high' ? '#FFFFFF' : '#F1F3F5',
    '--kyvon-fg-secondary': settings.contrast === 'high' ? '#C9CFD8' : '#8B929D',
    // Motion is a duration, so a component need not branch on the setting:
    // every transition multiplies by this and reduced motion makes it zero.
    '--kyvon-motion': settings.motion === 'reduced' ? '0ms' : '150ms',
  };
}

/** Write the settings onto the document. */
export function applyAppearance(
  settings: AppearanceSettings,
  root: HTMLElement | undefined = typeof document === 'undefined' ? undefined : document.documentElement,
): void {
  if (!root) return;
  for (const [name, value] of Object.entries(cssVariables(settings))) {
    root.style.setProperty(name, value);
  }
  // Exposed as attributes so CSS and tests can select on them, and so
  // assistive tooling inspecting the DOM can see the active mode.
  root.dataset.contrast = settings.contrast;
  root.dataset.motion = settings.motion;
}
