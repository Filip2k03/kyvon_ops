import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ArrowRight, Download, Github, Layers, LockKeyhole, Monitor, Server, ShieldCheck } from 'lucide-react';

const repository = 'https://github.com/Filip2k03/kyvon_ops';
const linkStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400';

function Releases() {
  return (
    <section id="downloads" className="scroll-mt-24 py-16">
      <p className="text-sm font-medium text-sky-400">Install on your workstation</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your infrastructure. Your workspace.</h2>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">KyvonOPS V3.0 is in development. Check published releases for available installers and their platform requirements. A web preview does not include SSH access or the native operations engine.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {['macOS', 'Windows', 'Linux'].map(platform => (
          <article key={platform} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <Monitor aria-hidden="true" className="h-6 w-6 text-slate-400" />
            <h3 className="mt-5 text-xl font-medium">{platform}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">Installers and signing status are listed with each release. Availability is not verified by this website.</p>
            <a className={`${linkStyle} mt-5 border border-slate-700 hover:bg-slate-800`} href={`${repository}/releases`} target="_blank" rel="noopener noreferrer" aria-label={`Check ${platform} releases on GitHub`}>
              <Download aria-hidden="true" className="h-4 w-4" /> Check releases
            </a>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm text-slate-400">Android and iOS companion applications are planned. Only install artifacts published and verified by the project.</p>
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
          <span className="rounded-full border border-sky-400/25 bg-sky-400/5 px-3 py-1.5 text-xs font-medium tracking-wide text-sky-300">V3.0 · Development preview</span>
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
      <Releases />
      <GettingStarted />
    </>
  );
}

export function PublicWebsite() {
  return (
    <div className="min-h-screen bg-[#090e17] text-slate-100 selection:bg-sky-800 select-text">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to content</a>
      <header className="border-b border-slate-800">
        <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="flex min-h-11 items-center gap-3 font-semibold tracking-wide"><span className="rounded-lg bg-sky-400 p-2 text-slate-950"><Layers aria-hidden="true" className="h-5 w-5" /></span> KyvonOPS</Link>
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300"><Link className="py-3 hover:text-white" to="/getting-started">Getting started</Link><Link className="py-3 hover:text-white" to="/downloads">Downloads</Link><a className="py-3 hover:text-white" href={repository} target="_blank" rel="noopener noreferrer">GitHub</a></div>
        </nav>
      </header>
      <main id="public-content" className="mx-auto max-w-6xl px-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/downloads" element={<><h1 className="pt-12 text-4xl font-semibold">Get KyvonOPS</h1><Releases /><GettingStarted /></>} />
          <Route path="/getting-started" element={<><h1 className="pt-12 text-4xl font-semibold">Start with your own infrastructure</h1><GettingStarted /></>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-800"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-xs leading-6 text-slate-400"><p>KyvonOPS · Local-first infrastructure operations</p><p>Public website · Server administration belongs in the desktop app.</p></div></footer>
    </div>
  );
}
