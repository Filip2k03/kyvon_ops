import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyAppearance,
  defaultSettings,
  loadSettings,
  saveSettings,
  TEXT_SCALES,
  TEXT_SCALE_LABELS,
  WARMTH_LABELS,
  WARMTH_LEVELS,
  type AppearanceSettings,
  type Contrast,
  type Motion,
  type TextScale,
  type Warmth,
} from './appearance';

/**
 * A floating control for the reader's own display preferences.
 *
 * It floats because these are settings you reach for *while reading something
 * that is hard to read* — burying them behind a settings route would mean
 * losing your place to fix the thing making you lose your place.
 *
 * Every control is a real button or radio with a visible label. Nothing here
 * depends on colour alone, every target clears 44px, and the panel closes on
 * Escape and returns focus to the trigger, so a keyboard user is never stranded
 * inside it.
 */

const OPTION =
  'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info';
const SELECTED = 'border-info/50 bg-info/10 text-primary';
const UNSELECTED = 'border-border bg-elevated text-secondary hover:text-primary';

function Choice<T extends string | number>({
  legend,
  hint,
  options,
  value,
  onChange,
  labelFor,
}: {
  legend: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (option: T) => string;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-xs font-semibold uppercase tracking-wide text-secondary">
        {legend}
      </legend>
      {hint && <p className="mt-1 text-xs leading-5 text-secondary/80">{hint}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              // Radio semantics, so a screen reader announces "2 of 4 selected"
              // rather than reading four unrelated buttons.
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={`${OPTION} ${active ? SELECTED : UNSELECTED}`}
            >
              {labelFor(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AppearancePanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>(() => defaultSettings());
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Stored preferences are read after mount rather than during render, so the
  // server-rendered markup and the first client render agree.
  useEffect(() => {
    const stored = loadSettings();
    setSettings(stored);
    applyAppearance(stored);
  }, []);

  const update = useCallback((patch: Partial<AppearanceSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      applyAppearance(next);
      saveSettings(next);
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, close]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Display settings"
          className="w-[min(20rem,calc(100vw-3rem))] space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-primary">Display</h2>
              <p className="mt-1 text-xs leading-5 text-secondary">
                Saved on this device only.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close display settings"
              className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-lg text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <Choice<TextScale>
            legend="Text size"
            options={TEXT_SCALES}
            value={settings.textScale}
            onChange={(textScale) => update({ textScale })}
            labelFor={(s) => TEXT_SCALE_LABELS[s]}
          />

          <Choice<Contrast>
            legend="Contrast"
            hint="Higher contrast raises text and borders toward WCAG AAA."
            options={['standard', 'high'] as const}
            value={settings.contrast}
            onChange={(contrast) => update({ contrast })}
            labelFor={(c) => (c === 'high' ? 'High' : 'Standard')}
          />

          <Choice<Motion>
            legend="Motion"
            hint="Follows your system setting until you change it here."
            options={['full', 'reduced'] as const}
            value={settings.motion}
            onChange={(motion) => update({ motion })}
            labelFor={(m) => (m === 'reduced' ? 'Reduced' : 'Full')}
          />

          <Choice<Warmth>
            legend="Warmth"
            // Deliberately not "eye protection": a warmer palette is more
            // comfortable for many people at night, which is a preference.
            // Whether it reduces strain is unsettled, and this project does not
            // assert what it cannot demonstrate.
            hint="Removes blue from surfaces. Status colours are left alone so they stay distinguishable."
            options={WARMTH_LEVELS}
            value={settings.warmth}
            onChange={(warmth) => update({ warmth })}
            labelFor={(w) => WARMTH_LABELS[w]}
          />

          <button
            type="button"
            onClick={() => {
              const reset = defaultSettings();
              setSettings(reset);
              applyAppearance(reset);
              saveSettings(reset);
            }}
            className="min-h-11 w-full rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
          >
            Reset to system defaults
          </button>
        </div>
      )}

      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Display settings"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-elevated text-primary shadow-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
      >
        {/* Decorative: the accessible name comes from aria-label. */}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
