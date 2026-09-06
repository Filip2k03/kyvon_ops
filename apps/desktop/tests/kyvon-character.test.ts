import { describe, expect, test } from 'bun:test';
import {
  CHARACTERS,
  DEFAULT_PRESET,
  PETS,
  STATES,
  AVAILABLE_CLIPS,
  isSafePreset,
  type CharacterPreset,
} from '../src/features/kyvon/character';

describe('character presets carry appearance and nothing else', () => {
  test('the default preset is accepted', () => {
    expect(isSafePreset(DEFAULT_PRESET)).toBe(true);
  });

  test('a preset carrying a credential is refused, not sanitised', () => {
    // Presets are exportable and shareable, so a secret smuggled into one
    // escapes the moment a user shares their KYVON. Dropping the field
    // silently would let a crafted preset round-trip through a share link.
    for (const field of [
      'apiKey',
      'sshKey',
      'password',
      'token',
      'serverId',
      'authorization',
      'hostname',
    ]) {
      expect(isSafePreset({ ...DEFAULT_PRESET, [field]: 'x' })).toBe(false);
    }
  });

  test('an unknown field is refused even when it looks harmless', () => {
    expect(isSafePreset({ ...DEFAULT_PRESET, nickname: 'friend' })).toBe(false);
  });

  test('references must resolve to something that exists', () => {
    expect(isSafePreset({ ...DEFAULT_PRESET, petId: 'k99' })).toBe(false);
    expect(isSafePreset({ ...DEFAULT_PRESET, characterId: 'kyvon-x' })).toBe(false);
    expect(isSafePreset({ ...DEFAULT_PRESET, expression: 'dancing' })).toBe(false);
  });

  test('the accent colour is a hex literal, never arbitrary CSS', () => {
    // It reaches a style attribute, so `url(...)` or an expression here would
    // be an injection point.
    expect(isSafePreset({ ...DEFAULT_PRESET, accentColor: 'red' })).toBe(false);
    expect(isSafePreset({ ...DEFAULT_PRESET, accentColor: 'url(javascript:1)' })).toBe(false);
    expect(isSafePreset({ ...DEFAULT_PRESET, accentColor: '#38bdf8' })).toBe(true);
  });

  test('non-objects are refused rather than throwing', () => {
    for (const bad of [null, undefined, 'preset', 42, []]) {
      expect(isSafePreset(bad)).toBe(false);
    }
  });

  test('a version from a future format is refused', () => {
    // Accepting it would mean guessing at fields this build cannot validate.
    expect(isSafePreset({ ...DEFAULT_PRESET, version: 2 } as unknown as CharacterPreset)).toBe(
      false,
    );
  });
});

describe('the character roster', () => {
  test('every pet points at a model this repository generates', () => {
    for (const pet of PETS) {
      expect(pet.model).toMatch(/^\/models\/[a-z0-9]+\.glb$/);
    }
    expect(new Set(PETS.map((p) => p.id)).size).toBe(PETS.length);
  });

  test('both character variants are described equally', () => {
    // Neither variant may be a lesser citizen: same fields populated, same
    // role. A recoloured second option would show up here as a missing role
    // or an empty personality.
    expect(CHARACTERS).toHaveLength(2);
    for (const c of CHARACTERS) {
      expect(c.role.length).toBeGreaterThan(0);
      expect(c.personality.length).toBeGreaterThan(0);
    }
    expect(CHARACTERS[0].personality.length).toBe(CHARACTERS[1].personality.length);
  });

  test('no state references an animation clip that was not exported', () => {
    // A missing clip renders as a T-pose with no error, which reads as a
    // broken model rather than a missing feature.
    for (const [state, presentation] of Object.entries(STATES)) {
      expect(AVAILABLE_CLIPS, `state "${state}" references a missing clip`).toContain(
        presentation.clip,
      );
    }
  });

  test('every state carries a label and a spoken announcement', () => {
    // Status must not depend on colour alone.
    for (const [state, p] of Object.entries(STATES)) {
      expect(p.label.length, state).toBeGreaterThan(0);
      expect(p.announce.length, state).toBeGreaterThan(0);
    }
  });

  test('offline and error are distinct states, not folded into idle', () => {
    expect(STATES.offline.tone).not.toBe(STATES.idle.tone);
    expect(STATES.error.tone).toBe('danger');
  });
});
