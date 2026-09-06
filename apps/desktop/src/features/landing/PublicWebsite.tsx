import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Github, Layers, LockKeyhole, Monitor, Server, ShieldCheck } from 'lucide-react';
import { Downloads } from './Downloads';
import { SponsorBanner } from '../../components/monetization/SponsorBanner';
import { AdSenseBanner } from '../../components/monetization/AdSenseBanner';
import { AppearancePanel } from '../settings/AppearancePanel';
import { KyvonLanding, KyvonPets, KyvonSecurity } from '../kyvon/KyvonPages';

const repository = 'https://github.com/Filip2k03/kyvon_ops';
const linkStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400';

const walkthrough = [
  { name: 'Server inventory', title: 'Start with the servers you own.', description: 'Create a local connection profile with your hostname, SSH username, and authentication method. The installed app stores the profile on your workstation.', steps: ['Add a server profile', 'Review the SSH host fingerprint', 'Connect and collect available host data'], note: 'Saving a profile does not prove connectivity. Host access must be verified separately.' },
  { name: 'Diagnostics', title: 'Follow the evidence to the affected service.', description: 'The V4.1 design connects host telemetry, applications, and dependencies so you can investigate an incident with context.', steps: ['Select the affected host or application', 'Review available measurements and recent changes', 'Evaluate possible causes and confidence'], note: 'Diagnostics are under development. Missing measurements must be shown as unavailable.' },
  { name: 'AI approvals', title: 'Review an operation before it changes a host.', description: 'Codex Astra, Claude Opus, and Agy Gemini 3.8 are intended to use the same typed MCP tools, target scopes, and policy rules.', steps: ['Inspect the requested action and exact target', 'Review risk, expected impact, and permissions', 'Approve through a trusted flow, then verify the result'], note: 'The public preview cannot approve or execute operations. The full approval-to-execution flow still requires release validation.' },
];

function AppPreview() {
  const [selected, setSelected] = useState(0);
  const item = walkthrough[selected];
  return (
    <section id="app-preview" className="scroll-mt-24 border-t border-slate-800 py-16">
      <p className="text-sm font-medium text-sky-400">Explore the desktop concept</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">See where your next operation begins.</h2>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">An interactive product walkthrough, with no server connection or live metrics. It explains the experience being developed for installed KyvonOPS users.</p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
        <div className="flex flex-wrap justify-between gap-3 border-b border-slate-800 px-6 py-4 text-xs"><span className="font-semibold tracking-wider">KYVONOPS / WORKSPACE</span><span className="text-amber-300">Illustrative interface preview</span></div>
        <div className="grid md:grid-cols-[210px_1fr]">
          <div aria-label="Preview topics" className="flex flex-wrap gap-2 border-b border-slate-800 p-4 md:flex-col md:border-b-0 md:border-r">
            {walkthrough.map((topic, index) => <button key={topic.name} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`min-h-11 rounded-lg px-4 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${selected === index ? 'bg-sky-400/10 text-sky-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{topic.name}</button>)}
          </div>
          <div className="p-6 sm:p-8" aria-live="polite">
            <h3 className="text-2xl font-medium">{item.title}</h3>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{item.description}</p>
            <ol className="mt-6 space-y-3">{item.steps.map((step, index) => <li key={step} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950/30 p-4 text-sm"><span className="font-mono text-sky-400">0{index + 1}</span>{step}</li>)}</ol>
            <p className="mt-5 text-xs leading-6 text-slate-400">{item.note}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><Link className={`${linkStyle} border border-slate-700 hover:bg-slate-800`} to="/getting-started">How installation works <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><a href={`${repository}/blob/main/PROMPTS.md`} target="_blank" rel="noopener noreferrer" className={`${linkStyle} text-slate-400 hover:text-white`}>Read the product specification</a></div>
    </section>
  );
}

function GettingStarted() {
  return (
    <section id="getting-started" className="scroll-mt-24 border-t border-slate-800 py-16">
      <h2 className="text-3xl font-semibold tracking-tight">Built for more than one workstation.</h2>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">The intended installation flow gives every operator a separate local workspace. You bring your own server access; no project-owner account should be required.</p>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {[
          ['Choose a release', 'Review the release notes, supported operating system, checksums, and known limitations before installing.'],
          ['Connect your servers', 'In a supported desktop release, add your own server address and SSH identity, then verify its host key.'],
          ['Review before acting', 'Check collected evidence, target scope, and approval requirements before making infrastructure changes.'],
        ].map(([title, description], index) => (
          <li key={title}><span className="font-mono text-sm text-sky-400">0{index + 1}</span><h3 className="mt-3 text-lg font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p></li>
        ))}
      </ol>
      <a className={`${linkStyle} mt-8 border border-slate-700 hover:bg-slate-800`} href={`${repository}#readme`} target="_blank" rel="noopener noreferrer">Read setup and development notes <ArrowRight aria-hidden="true" className="h-4 w-4" /></a>
    </section>
  );
}

function Overview() {
  return (
    <>
      <section className="grid items-center gap-12 py-20 md:grid-cols-[1.2fr_1fr] md:py-28">
        <div>
          <span className="rounded-full border border-sky-400/25 bg-sky-400/5 px-3 py-1.5 text-xs font-medium tracking-wide text-sky-300">V4.1 · Development preview</span>
          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">A clearer view of<br /><span className="text-slate-400">your infrastructure.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">A local-first desktop control plane for developers and infrastructure teams. Explore the project, follow its progress, and install available releases on your own machine.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/downloads" className={`${linkStyle} bg-sky-400 text-slate-950 hover:bg-sky-300`}>Explore downloads <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            <a href={repository} className={`${linkStyle} border border-slate-700 hover:bg-slate-800`} target="_blank" rel="noopener noreferrer"><Github aria-hidden="true" className="h-4 w-4" /> View source</a>
          </div>
        </div>
        <figure className="rounded-3xl border border-slate-800 bg-slate-900/40 p-7 sm:p-9">
          <figcaption className="mb-7 text-xs font-medium uppercase tracking-widest text-slate-500">Architecture direction</figcaption>
          {[
            [Monitor, 'Your workstation', 'Desktop interface and local storage'],
            [ShieldCheck, 'Controlled operations', 'Policy, approval, and audit boundaries'],
            [Server, 'Your infrastructure', 'Direct SSH to your Linux servers'],
          ].map(([Icon, title, subtitle], index) => {
            const Illustration = Icon as typeof Monitor;
            return <div key={String(title)}>{index > 0 && <div aria-hidden="true" className="ml-5 h-8 border-l border-slate-700" />}<div className="flex items-center gap-4"><Illustration aria-hidden="true" className="h-10 w-10 rounded-xl border border-slate-700 p-2 text-sky-300" /><div><p className="font-medium">{String(title)}</p><p className="mt-1 text-xs text-slate-400">{String(subtitle)}</p></div></div></div>;
          })}
          <p className="mt-8 text-xs leading-5 text-slate-500">Conceptual architecture — no live infrastructure data is displayed on this website.</p>
        </figure>
      </section>
      <section id="approach" className="grid scroll-mt-24 gap-8 border-y border-slate-800 py-12 md:grid-cols-3">
        {[
          [LockKeyhole, 'Local-first by design', 'Keep infrastructure access on your workstation. The public website never asks for SSH keys or cloud credentials.'],
          [Layers, 'Context for operations', 'The project is developing topology, diagnostics, and resource attribution to connect host signals with applications.'],
          [ShieldCheck, 'AI with boundaries', 'The MCP gateway is designed around typed tools and policy controls for Codex Astra, Claude Opus, and Agy Gemini 3.8.'],
        ].map(([Icon, title, description]) => {
          const FeatureIcon = Icon as typeof Monitor;
          return <article key={String(title)}><FeatureIcon aria-hidden="true" className="h-6 w-6 text-sky-400" /><h2 className="mt-5 text-lg font-medium">{String(title)}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{String(description)}</p></article>;
        })}
      </section>
      <AppPreview />
      <Downloads />
      <GettingStarted />
    </>
  );
}

export function PublicWebsite() {
  return (
    <>
    <div className="min-h-screen bg-[#090e17] text-slate-100 selection:bg-sky-800 select-text">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
      <header className="border-b border-slate-800">
        <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="flex min-h-11 items-center gap-3 font-semibold tracking-wide"><span className="rounded-lg bg-sky-400 p-2 text-slate-950"><Layers aria-hidden="true" className="h-5 w-5" /></span> KyvonOPS</Link>
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300"><Link className="py-3 hover:text-white" to="/preview">App preview</Link><Link className="py-3 hover:text-white" to="/getting-started">Getting started</Link><Link className="py-3 hover:text-white" to="/kyvon">KYVON</Link><Link className="py-3 hover:text-white" to="/downloads">Downloads</Link><a className="py-3 hover:text-white" href={repository} target="_blank" rel="noopener noreferrer">GitHub</a></div>
        </nav>
      </header>
      <main id="public-content" className="mx-auto max-w-6xl px-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/preview" element={<><h1 className="pt-12 text-4xl font-semibold">Inside the KyvonOPS app</h1><AppPreview /></>} />
          <Route path="/kyvon" element={<KyvonLanding />} />
          <Route path="/kyvon/pets" element={<KyvonPets />} />
          <Route path="/kyvon/characters" element={<KyvonPets />} />
          <Route path="/kyvon/security" element={<KyvonSecurity />} />
          <Route path="/downloads" element={<><h1 className="pt-12 text-4xl font-semibold">Get KyvonOPS</h1><Downloads /><GettingStarted /></>} />
          <Route path="/getting-started" element={<><h1 className="pt-12 text-4xl font-semibold">Start with your own infrastructure</h1><GettingStarted /></>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <AdSenseBanner />
        <div className="mt-4" />
        <SponsorBanner placement="public" />
      </div>
      <footer className="border-t border-slate-800"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-xs leading-6 text-slate-400"><p>KyvonOPS · Local-first infrastructure operations</p><p>Public website · Server administration belongs in the desktop app.</p></div></footer>
    </div>
      <AppearancePanel />
    </>
  );
}
