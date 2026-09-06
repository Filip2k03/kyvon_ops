# Design system

What KyvonOPS looks like, and why. Verified against commit `b606469`.

This is a description of what the code does, not an aspiration. Where a rule is
enforced by a test, the test is named.

## The intent

An operations console for people who are usually looking at it because
something is wrong. That single fact drives most of the decisions below: the
interface should be quiet when the system is quiet, legible at 2am, and utterly
unambiguous about what is measured versus what is inferred.

It should feel expensive because of precision — spacing, hierarchy, restraint —
not because of gradients and glow.

## Tokens

Colour lives in two places, and they serve different purposes.

**Tailwind theme colours** (`tailwind.config.js`) are the fixed brand and status
palette. Status colours never move:

| Token | Value | Meaning |
| --- | --- | --- |
| `healthy` | `#10b981` | Measured, within limits |
| `warning` | `#f59e0b` | Measured, approaching a limit |
| `critical` | `#ef4444` | Measured, past a limit |
| `info` | `#3b82f6` | Interaction, focus, selection |

**CSS custom properties** (`src/styles/globals.css`) are the surfaces, and the
reader controls them:

| Variable | Purpose |
| --- | --- |
| `--kyvon-bg` / `--kyvon-surface` / `--kyvon-elevated` | Ground, panel, raised panel |
| `--kyvon-border` | Dividers and outlines |
| `--kyvon-fg` / `--kyvon-fg-secondary` | Primary and secondary text |
| `--kyvon-text-scale` | Multiplies the root font size |
| `--kyvon-motion` | Transition duration; `0ms` under reduced motion |

Anything painting a surface reads the variable rather than the Tailwind literal,
so a preference change reaches it without a rebuild.

### Why status colours are exempt from warmth

The warmth control shifts surfaces toward amber. It deliberately does **not**
apply a screen-wide filter, because a warm overlay drags `critical` red and
`warning` amber toward each other — and those two must stay tellable apart when
someone is deciding whether to wake a colleague.

`warmth never drives a channel below zero` and `warmth adds red and removes
blue, monotonically` in `tests/appearance.test.ts` pin the shift itself.

## Reader-controlled display

`src/features/settings/appearance.ts` holds the model;
`AppearancePanel.tsx` is the floating control, reachable from any page.

It floats because these are settings you reach for *while reading something
that is hard to read*. Burying them behind a settings route means losing your
place to fix the thing that made you lose your place.

| Setting | Options | Default |
| --- | --- | --- |
| Text size | Compact, Default, Large, Largest | Default |
| Contrast | Standard, High | `prefers-contrast: more` |
| Motion | Full, Reduced | `prefers-reduced-motion` |
| Warmth | Neutral … Warmest | Neutral |

**The operating system is the default, not the fallback.** Someone who has
already told their OS they want reduced motion should not have to say it again.
Stored settings express a deviation the reader chose deliberately.

**Warmth is labelled as what it is.** It removes blue from surfaces. Whether
that reduces eye strain is genuinely unsettled, so the interface does not claim
it does — the honest claim is that a warmer screen is more comfortable for many
people at night, which is a preference, not a medical outcome. This codebase
does not assert what it cannot demonstrate.

Settings are stored in `localStorage`, on that device only, and a stored value
that fails validation is discarded rather than repaired — a half-understood
settings object applies some fields and silently ignores others, which is harder
to diagnose than starting clean.

## Accessibility rules

These are enforced, not aspirational:

- **Touch targets are at least 44px.** `every control clears a 44px touch
  target` in `e2e/appearance.spec.ts` measures the rendered boxes.
- **Focus is always visible.** A single `:focus-visible` rule in `globals.css`
  covers every interactive element, rather than relying on each component.
- **Reduced motion is enforced centrally.** One rule zeroes every animation and
  transition; `reduced motion actually zeroes transition duration` verifies it
  against a live computed style, not the setting.
- **Escape closes and returns focus.** `the panel is operable and dismissible
  from the keyboard` checks the trigger is refocused, or a keyboard user is
  stranded at the end of the document.
- **Status never depends on colour alone.** Every state carries a text label
  and a spoken announcement; `every state carries a label and a spoken
  announcement` in `tests/kyvon-character.test.ts` pins it.
- **Grouped choices use radio semantics**, so a screen reader announces "2 of 4
  selected" rather than reading four unrelated buttons.

## Typography

Inter for interface text, JetBrains Mono for anything an operator might copy,
type, or compare character by character — IP addresses, ports, commands,
hashes, ids, timestamps. Monospace is a signal that a value is exact, so using
it decoratively costs that signal.

The root font size is `calc(16px * var(--kyvon-text-scale))`, which scales
rem-based type without fighting the browser's own zoom.

## What is not settled

The visual direction of the KYVON character experience is an open question.
`PROMPTS.md` and the V4 brief call for aerospace-console restraint; the
character artwork is anime-styled. Both are coherent products, but they are
different ones, and the hero art is currently a drop-in slot so the decision
does not block anything else.
