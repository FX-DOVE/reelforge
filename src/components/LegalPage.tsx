import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/PublicSite";
import { CONTACT_EMAIL, TERMS_VERSION } from "@/lib/terms";
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: [string, React.ReactNode][] }) {
  return (
    <main className="overflow-x-hidden">
      <PublicNav />
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-500">Version {TERMS_VERSION} · Last updated 30 October 2026</p>
        <p className="mt-6 text-base leading-relaxed text-ink-300 sm:text-lg">{intro}</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-400">This document is a template provided for the ReelForge beta. It is not legal advice; have it reviewed by a qualified lawyer before relying on it.</div>
        <nav className="mt-8 flex flex-wrap gap-2 text-sm">{sections.map(([h], i) => <a key={h} href={`#s${i + 1}`} className="rounded-full border border-white/10 px-3 py-1 text-ink-300 hover:text-white">{i + 1}. {h}</a>)}</nav>
        {sections.map(([h, b], i) => (
          <section key={h} id={`s${i + 1}`} className="mt-10 scroll-mt-24 border-t border-white/10 pt-6">
            <h2 className="text-xl font-medium">{i + 1}. {h}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-300 [&_li]:ml-5 [&_li]:list-disc">{b}</div>
          </section>
        ))}
        <p className="mt-12 text-sm text-ink-400">Questions? Email <a className="text-brand-300 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also <Link className="text-brand-300 underline" href={title.startsWith("Terms") ? "/privacy" : "/terms"}>{title.startsWith("Terms") ? "Privacy Policy" : "Terms & Conditions"}</Link>.</p>
      </article>
      <PublicFooter />
    </main>
  );
}
