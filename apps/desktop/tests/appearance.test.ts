import { describe, expect, test } from 'bun:test';
import {
  applyAppearance,
  cssVariables,
  defaultSettings,
  isValidSettings,
  TEXT_SCALES,
  WARMTH_LEVELS,
  type AppearanceSettings,
} from '../src/features/settings/appearance';

const base: AppearanceSettings = {
  version: 1,
  textScale: 1,
  contrast: 'standard',
  motion: 'full',
  warmth: 0,
};

/** Parse `rgb(r g b)` back into numbers so the shift can be asserted. */
function rgb(value: string): [number, number, number] {
  const m = value.match(/rgb\((\d+) (\d+) (\d+)\)/);
  if (!m) throw new Error(`not an rgb() value: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe('settings validation', () => {
  test('the defaults validate', () => {
    expect(isValidSettings(defaultSettings())).toBe(true);
  });

  test('an out-of-range value is rejected rather than clamped', () => {
    // Clamping would apply a size the reader never chose and give no signal
    // that their stored preference was wrong.
    expect(isValidSettings({ ...base, textScale: 2 })).toBe(false);
    expect(isValidSettings({ ...base, warmth: 9 })).toBe(false);
    expect(isValidSettings({ ...base, contrast: 'ultra' })).toBe(false);
    expect(isValidSettings({ ...base, motion: 'none' })).toBe(false);
  });

  test('a future version is refused', () => {
    expect(isValidSettings({ ...base, version: 2 })).toBe(false);
  });

  test('non-objects are refused rather than throwing', () => {
    for (const bad of [null, undefined, 'settings', 7, []]) {
      expect(isValidSettings(bad)).toBe(false);
    }
  });
});

describe('the CSS mapping', () => {
  test('reduced motion produces a zero duration', () => {
    // Components multiply by this rather than branching, so zero here is what
    // actually disables animation across the app.
    expect(cssVariables({ ...base, motion: 'reduced' })['--kyvon-motion']).toBe('0ms');
    expect(cssVariables(base)['--kyvon-motion']).not.toBe('0ms');
  });

  test('high contrast lightens text and darkens ground', () => {
    const standard = cssVariables(base);
    const high = cssVariables({ ...base, contrast: 'high' });
    expect(high['--kyvon-fg']).toBe('#FFFFFF');
    // Secondary text is what fails a contrast check first, so it must move.
    expect(high['--kyvon-fg-secondary']).not.toBe(standard['--kyvon-fg-secondary']);
    expect(rgb(high['--kyvon-bg'])[0]).toBeLessThan(rgb(standard['--kyvon-bg'])[0]);
  });

  test('warmth adds red and removes blue, monotonically', () => {
    let previous = rgb(cssVariables({ ...base, warmth: 0 })['--kyvon-surface']);
    for (const warmth of WARMTH_LEVELS.slice(1)) {
      const next = rgb(cssVariables({ ...base, warmth })['--kyvon-surface']);
      expect(next[0]).toBeGreaterThan(previous[0]);
      expect(next[2]).toBeLessThanOrEqual(previous[2]);
      previous = next;
    }
  });

  test('warmth never drives a channel below zero', () => {
    // The darkest surface at the warmest setting is where this would break.
    for (const warmth of WARMTH_LEVELS) {
      for (const value of Object.values(cssVariables({ ...base, warmth }))) {
        if (value.startsWith('rgb(')) {
          for (const channel of rgb(value)) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });

  test('every text scale produces a usable number', () => {
    for (const textScale of TEXT_SCALES) {
      const scale = Number(cssVariables({ ...base, textScale })['--kyvon-text-scale']);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0.5);
    }
  });
});

describe('applying settings to a document', () => {
  test('variables and data attributes both land on the element', () => {
    // A fake element rather than a DOM: the contract is that every variable is
    // written and the mode is exposed for CSS and assistive tooling to select.
    const written: Record<string, string> = {};
    const element = {
      style: { setProperty: (k: string, v: string) => void (written[k] = v) },
      dataset: {} as Record<string, string>,
    } as unknown as HTMLElement;

    applyAppearance({ ...base, contrast: 'high', motion: 'reduced' }, element);

    expect(Object.keys(written)).toEqual(Object.keys(cssVariables(base)));
    expect(element.dataset.contrast).toBe('high');
    expect(element.dataset.motion).toBe('reduced');
  });

  test('applying without a document is a no-op, not a crash', () => {
    // Server-side rendering reaches this before any document exists.
    expect(() => applyAppearance(base, undefined)).not.toThrow();
  });
});
