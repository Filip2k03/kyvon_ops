/**
 * How KYVON reaches a language model — and why it usually cannot.
 *
 * The architecture is a provider interface rather than a call to one vendor,
 * so adding a second provider is a new implementation rather than a rewrite of
 * everything that touches conversation (§16).
 *
 * The security rule shapes the whole design: **a privileged provider key must
 * never exist in this bundle.** Anything a browser can read, every visitor can
 * read, so `VITE_*`-style keys are not merely discouraged here — there is no
 * code path that would consume one. A provider becomes available only where a
 * key can be held safely: the desktop app's OS keychain, or a server-side
 * gateway that holds it and is never handed to the client.
 *
 * The consequence is that on the public website `resolveProvider()` returns
 * `unconfigured`, and the UI says so plainly instead of offering a button that
 * cannot work.
 */

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'local';

/** Where a provider's credential lives. Only these are acceptable. */
export type CredentialSource =
  /** Desktop only: the OS keychain, reached over Tauri IPC. */
  | 'os-keychain'
  /** A gateway that holds the key server-side and is never given to the client. */
  | 'server-gateway';

export interface ProviderCapabilities {
  chat: boolean;
  /** Token-by-token responses. */
  stream: boolean;
  /** Speech to text. */
  transcribe: boolean;
  /** Text to speech. */
  synthesize: boolean;
  /** Real-time bidirectional media. Distinct from `stream`, which is text. */
  realtime: boolean;
}

export interface Provider {
  id: ProviderId;
  label: string;
  credential: CredentialSource;
  capabilities: ProviderCapabilities;
}

/**
 * Why conversation is unavailable, specifically.
 *
 * Collapsing these into one "unavailable" would leave a user unable to tell a
 * missing key from an unreachable service, and the fix for each is different
 * (§118).
 */
export type ProviderState =
  | { state: 'ready'; provider: Provider }
  | {
      /** Running somewhere a key cannot be held safely — the public website. */
      state: 'unsupported-runtime';
      reason: string;
      detail: string;
    }
  | {
      /** The runtime could hold a key, but none has been configured. */
      state: 'unconfigured';
      reason: string;
      detail: string;
    }
  | { state: 'unreachable'; reason: string; detail: string };

/**
 * Providers this build knows how to talk to.
 *
 * Listing one here does not make it usable — it declares the shape of what a
 * configured instance would offer, so the settings UI can describe the choice
 * before a key exists. `resolveProvider` decides what is actually available.
 */
export const KNOWN_PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    credential: 'os-keychain',
    capabilities: { chat: true, stream: true, transcribe: false, synthesize: false, realtime: false },
  },
  {
    id: 'openai',
    label: 'OpenAI-compatible',
    credential: 'os-keychain',
    capabilities: { chat: true, stream: true, transcribe: true, synthesize: true, realtime: true },
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    credential: 'os-keychain',
    capabilities: { chat: true, stream: true, transcribe: false, synthesize: true, realtime: true },
  },
  {
    id: 'local',
    label: 'Local model',
    credential: 'server-gateway',
    capabilities: { chat: true, stream: true, transcribe: false, synthesize: false, realtime: false },
  },
];

/**
 * What conversation support exists right now.
 *
 * `hasBackend` is the honest test: only the desktop shell can reach a keychain.
 * A browser cannot, so it is reported as an unsupported runtime rather than as
 * a configuration the user could fix — telling someone to add a key that would
 * be readable by every visitor would be worse than saying nothing.
 */
export function resolveProvider(hasBackend: boolean, configured?: ProviderId | null): ProviderState {
  if (!hasBackend) {
    return {
      state: 'unsupported-runtime',
      reason: 'Conversation is not available on the public website',
      detail:
        'Talking to KYVON needs a language-model provider, and a provider key cannot be held safely in a web page — anything this page can read, every visitor can read. Conversation runs in the desktop application, against a key stored in your operating system’s keychain.',
    };
  }

  const provider = KNOWN_PROVIDERS.find((p) => p.id === configured);
  if (!provider) {
    return {
      state: 'unconfigured',
      reason: 'No AI provider is configured',
      detail:
        'Add a provider key in Settings. It is written to your OS keychain, never to the local database, and never sent anywhere except the provider you chose.',
    };
  }

  return { state: 'ready', provider };
}

/** Whether a capability is usable, given the resolved state. */
export function supports(state: ProviderState, capability: keyof ProviderCapabilities): boolean {
  return state.state === 'ready' && state.provider.capabilities[capability];
}
