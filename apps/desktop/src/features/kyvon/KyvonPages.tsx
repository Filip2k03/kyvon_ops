import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHARACTERS, PETS, STATES, type CharacterState } from './character';

// The 3D bundle is split out: a visitor reading /kyvon should not download
// three.js before deciding whether they care about the character at all.
const PetViewer = lazy(() =>
  import('./PetViewer').then((m) => ({ default: m.PetViewer })),
);

const link =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400';

export function KyvonLanding() {
  return (
    <section className="py-16">
      <p className="text-sm font-medium text-sky-400">KYVON</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Your AI DevOps companion.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
        An interface for understanding, monitoring and safely operating your infrastructure. KYVON
        reads what KyvonOPS has measured and explains it. It cannot change anything on its own.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/kyvon/pets" className={`${link} bg-sky-400 text-slate-950 hover:bg-sky-300`}>
          Meet the companions
        </Link>
        <Link to="/kyvon/security" className={`${link} border border-slate-700 hover:bg-slate-800`}>
          How it stays safe
        </Link>
      </div>

      {/*
        Conversation is not offered as a button because no AI provider is
        configured for this site. Advertising a "Talk to KYVON" control that
        cannot talk would be the same broken promise as a download button with
        no installer behind it.
      */}
      <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-medium">Conversation is not enabled here</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Voice and video sessions need an AI provider, and this public site has none — by design.
          A privileged provider key must never ship in public frontend JavaScript, where anyone can
          read it. When conversation arrives it will run from the desktop app, using a key held in
          your operating system&rsquo;s keychain.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {CHARACTERS.map((character) => (
          <article key={character.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-xl font-medium">{character.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{character.role}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {character.personality.map((trait) => (
                <li
                  key={trait}
                  className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
                >
                  {trait}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              {character.model
                ? 'Character model available.'
                : 'No character model yet — the pipeline that builds these is in assets/blender/.'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KyvonPets() {
  const [selected, setSelected] = useState(PETS[0]);
  const [state, setState] = useState<CharacterState>('idle');

  return (
    <section className="py-16">
      <p className="text-sm font-medium text-sky-400">Companions</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose your companion</h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">
        Each companion reflects system state — calm while your infrastructure is calm. They are
        visual only: a companion never decides or performs an operation.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <Suspense
            fallback={
              <div className="aspect-square w-full animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
            }
          >
            <PetViewer pet={selected} state={state} />
          </Suspense>

          <div className="mt-4">
            <label htmlFor="kyvon-state" className="text-xs font-medium text-slate-400">
              Preview state
            </label>
            <select
              id="kyvon-state"
              value={state}
              onChange={(e) => setState(e.target.value as CharacterState)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              {Object.entries(STATES).map(([key, presentation]) => (
                <option key={key} value={key}>
                  {presentation.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {PETS.map((pet) => {
            const active = pet.id === selected.id;
            return (
              <li key={pet.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(pet)}
                  className={`w-full rounded-2xl border p-5 text-left transition-colors ${
                    active
                      ? 'border-sky-400/40 bg-sky-400/5'
                      : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-medium">{pet.name}</h2>
                    <span className="text-xs text-slate-400">{pet.species}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pet.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {pet.personality.map((trait) => (
                      <li
                        key={trait}
                        className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300"
                      >
                        {trait}
                      </li>
                    ))}
                  </ul>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function KyvonSecurity() {
  const points: Array<[string, string]> = [
    [
      'Appearance is not permission',
      'A character preset stores appearance only. It is validated on load and on save, and any field naming a server, key or token is refused outright — presets are shareable, so a secret inside one would leak the moment someone shared it.',
    ],
    [
      'Conversation is not control',
      'Talking to KYVON does not grant it server access. Reading infrastructure state and changing it are separate capabilities, and KYVON holds only the first.',
    ],
    [
      'No provider key in this page',
      'A key shipped in public JavaScript is readable by everyone who loads the page. This site has none. Conversation runs from the desktop app against a key in your OS keychain.',
    ],
    [
      'Operations still require approval',
      'Asking KYVON to restart a service produces a preview — the exact command, its risk tier and its expected impact — and waits. Execution is verified afterwards and written to the audit ledger.',
    ],
    [
      'One security model, not two',
      'KYVON uses the same capability and approval system as every other client. There is no separate path that skips it.',
    ],
  ];

  return (
    <section className="py-16">
      <p className="text-sm font-medium text-sky-400">Security</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        What KYVON can and cannot do
      </h1>
      <dl className="mt-10 grid gap-6 md:grid-cols-2">
        {points.map(([title, detail]) => (
          <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <dt className="text-lg font-medium">{title}</dt>
            <dd className="mt-3 text-sm leading-6 text-slate-400">{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
