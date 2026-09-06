import { describe, expect, test } from 'bun:test';
import {
  KNOWN_PROVIDERS,
  resolveProvider,
  supports,
  type ProviderId,
} from '../src/features/kyvon/provider';

describe('provider resolution refuses to pretend', () => {
  test('a browser is an unsupported runtime, not a fixable configuration', () => {
    // Telling a website visitor to "add your key" would invite them to put a
    // credential somewhere every other visitor can read it.
    const state = resolveProvider(false, 'anthropic');
    expect(state.state).toBe('unsupported-runtime');
    if (state.state !== 'ready') {
      expect(state.detail).toContain('keychain');
    }
  });

  test('a configured provider on the desktop is ready', () => {
    const state = resolveProvider(true, 'anthropic');
    expect(state.state).toBe('ready');
  });

  test('the desktop with no key is unconfigured, which is a different problem', () => {
    for (const configured of [null, undefined]) {
      expect(resolveProvider(true, configured).state).toBe('unconfigured');
    }
  });

  test('an unknown provider id is not silently accepted', () => {
    expect(resolveProvider(true, 'totally-made-up' as ProviderId).state).toBe('unconfigured');
  });

  test('capabilities are false unless a provider is actually ready', () => {
    // A UI gated on `supports` cannot offer voice from an unresolved provider.
    for (const state of [resolveProvider(false, 'openai'), resolveProvider(true, null)]) {
      for (const cap of ['chat', 'stream', 'transcribe', 'synthesize', 'realtime'] as const) {
        expect(supports(state, cap)).toBe(false);
      }
    }
  });

  test('a ready provider reports only what it actually offers', () => {
    const anthropic = resolveProvider(true, 'anthropic');
    expect(supports(anthropic, 'chat')).toBe(true);
    // Not claimed, so not offered — the UI must not show a microphone here.
    expect(supports(anthropic, 'transcribe')).toBe(false);
    expect(supports(anthropic, 'realtime')).toBe(false);
  });
});

describe('credential handling is structurally safe', () => {
  test('no provider expects its key to live in the browser', () => {
    // The only acceptable homes are the OS keychain and a server-side gateway.
    for (const provider of KNOWN_PROVIDERS) {
      expect(['os-keychain', 'server-gateway']).toContain(provider.credential);
    }
  });

  test('no build-time key is read from the bundle', async () => {
    // A `VITE_`-prefixed variable is inlined into public JavaScript at build
    // time. There must be no code path that consumes one.
    const source = await Bun.file('src/features/kyvon/provider.ts').text();
    expect(source).not.toContain('import.meta.env');
    expect(source).not.toMatch(/VITE_[A-Z_]*KEY/);
    expect(source).not.toMatch(/process\.env/);
  });
});
