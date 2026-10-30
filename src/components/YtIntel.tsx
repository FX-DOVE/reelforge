"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Check, Copy, Flame, Hash, Image as Img, Loader2, Search, Sparkles, Type, Clock, Wand2, FolderPlus } from "lucide-react";

type Kw = { keyword: string; score: number; demand: number; competition: number; inAutocomplete: boolean };
type V = { id: string; title: string; channel: string; views: number; vph?: number; outlier?: number; published?: string; duration?: string; tags?: string[] };
export type Report = { id: string; topic: string; status: "running" | "done" | "error"; error?: string; steps: { t: number; text: string }[]; source?: string; provider?: string; videos?: V[]; channels?: { id: string; name: string; subs?: string; medianViews?: number; sampled: number }[]; timing?: { bestDays: string[]; bestHours: number[]; note: string }; titles?: { title: string; score: number; why: string }[]; script?: { hook: string; body: string; retention: string[] }; thumbnails?: { text: string; composition: string; colors: string; emotion: string; image?: string }[]; hashtags?: string[]; keywords?: Kw[]; description?: string; insights?: string };
const n = (x?: number) => x === undefined ? "–" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "K" : String(x);

function CopyBtn({ text }: { text: string }) { const [ok, setOk] = useState(false); return <button className="btn-ghost h-7 px-2 text-xs" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{ok ? "Copied" : "Copy"}</button>; }
const Sec = ({ icon: I, title, right, children }: { icon: typeof Type; title: string; right?: React.ReactNode; children: React.ReactNode }) => <section className="panel p-4 sm:p-5"><div className="mb-3 flex items-center gap-2"><I className="h-4 w-4 text-brand-400" /><h2 className="text-sm font-semibold text-white">{title}</h2><div className="ml-auto">{right}</div></div>{children}</section>;

export function useReport(id?: string | null) {
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => { if (!id) { setR(null); return; } let stop = false;
    const tick = async () => { const j = await fetch(`/api/ytintel/${id}`).then((x) => x.json()).catch(() => null); if (stop) return; if (j?.id) setR(j); if (!j || j.status === "running") setTimeout(tick, 2000); };
    tick(); return () => { stop = true; }; }, [id]);
  return r;
}

export function ReportView({ r, projectId }: { r: Report; projectId?: string }) {
  const [applied, setApplied] = useState<number | null>(null);
  const apply = async (i: number) => { const x = await fetch(`/api/ytintel/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, titleIndex: i }) }); if (x.ok) setApplied(i); };
  if (r.status === "running") return <div className="panel p-5"><div className="flex items-center gap-2 text-sm font-medium text-white"><Loader2 className="h-4 w-4 animate-spin text-brand-400" /> Studying “{r.topic}”…</div><ol className="mt-3 space-y-1.5 text-sm text-ink-300">{r.steps.map((s, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{s.text}</li>)}</ol></div>;
  if (r.status === "error") return <div className="panel p-5 text-sm text-red-500">⚠ {r.error}</div>;
  const kwText = (r.keywords || []).map((k) => k.keyword).join(", ");
  return <div className="space-y-4">
    {r.insights && <Sec icon={Sparkles} title="What's working in this niche"><p className="text-sm leading-relaxed text-ink-300">{r.insights}</p><p className="mt-2 text-[11px] text-ink-400">Data: {r.source} · Written by {r.provider}</p></Sec>}
    <Sec icon={Type} title="10 ranked titles">
      <ol className="space-y-2">{(r.titles || []).map((t, i) => <li key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] p-3">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${t.score >= 85 ? "bg-emerald-500/15 text-emerald-600" : t.score >= 70 ? "bg-amber-500/15 text-amber-600" : "bg-white/[0.06] text-ink-300"}`}>{t.score}</span>
        <div className="min-w-0 flex-1"><div className="font-medium text-white">{t.title}</div><div className="mt-0.5 text-xs text-ink-400">{t.why}</div></div>
        <div className="flex shrink-0 flex-col items-end gap-1"><CopyBtn text={t.title} />{projectId && <button className="btn-ghost h-7 px-2 text-xs" onClick={() => apply(i)}>{applied === i ? <><Check className="h-3.5 w-3.5" />Applied</> : "Use for project"}</button>}</div></li>)}</ol>
    </Sec>
    <div className="grid gap-4 lg:grid-cols-3">{(r.thumbnails || []).map((t, i) => <Sec key={i} icon={Img} title={`Thumbnail concept ${i + 1}`}>
      {t.image ? <img src={t.image} alt="" className="mb-3 aspect-video w-full rounded-xl object-cover" /> : <div className="mb-3 grid aspect-video w-full place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-fuchsia-500/20 p-4 text-center text-xl font-black uppercase tracking-tight text-white">{t.text}</div>}
      <div className="text-sm text-ink-300"><b className="text-white">“{t.text}”</b><p className="mt-1">{t.composition}</p><p className="mt-1 text-xs text-ink-400">{t.colors} · {t.emotion}</p></div></Sec>)}</div>
    {r.script && <Sec icon={Wand2} title="Script (hook + retention structure)" right={<CopyBtn text={`${r.script.hook}\n\n${r.script.body}`} />}>
      <div className="rounded-xl bg-brand-500/10 p-3 text-sm text-white"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-500">Hook · first 15 s</div>{r.script.hook}</div>
      <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-300">{r.script.body}</pre>
      {!!r.script.retention?.length && <ul className="mt-3 space-y-1 text-xs text-ink-400">{r.script.retention.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
    </Sec>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Sec icon={Search} title="Keywords & tags" right={<CopyBtn text={kwText} />}>
        <div className="space-y-1.5">{(r.keywords || []).slice(0, 18).map((k) => <div key={k.keyword} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate text-white">{k.keyword}{k.inAutocomplete && <span className="ml-1.5 text-[10px] text-emerald-600">autocomplete</span>}</span><span className="w-24 text-right text-[11px] text-ink-400">demand {k.demand} · comp {k.competition}</span><span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${k.score}%` }} /></span><b className="w-7 text-right text-xs text-white">{k.score}</b></div>)}</div>
        <p className="mt-2 text-[11px] text-ink-400">Score = 70% demand (YouTube autocomplete rank + how often top-performing competitors use it) + 30% low competition. Our own estimate, not vidIQ data.</p>
      </Sec>
      <Sec icon={Hash} title="Hashtags & description" right={<CopyBtn text={r.description || ""} />}>
        <div className="mb-3 flex flex-wrap gap-1.5">{(r.hashtags || []).map((h) => <span key={h} className="chip h-7">{h}</span>)}</div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm text-ink-300">{r.description}</pre>
      </Sec>
    </div>
    <Sec icon={Flame} title="Top competing videos (sorted by outlier score)">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="py-1.5 pr-3">Video</th><th className="pr-3">Views</th><th className="pr-3">Views/h</th><th className="pr-3" title="views ÷ the channel's median views">Outlier</th><th>Published</th></tr></thead>
        <tbody>{(r.videos || []).slice(0, 15).map((v) => <tr key={v.id} className="border-t border-white/[0.06]"><td className="max-w-[340px] py-2 pr-3"><a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="line-clamp-1 font-medium text-white hover:underline">{v.title}</a><div className="text-xs text-ink-400">{v.channel}</div></td><td className="pr-3">{n(v.views)}</td><td className="pr-3">{n(v.vph)}</td><td className={`pr-3 font-semibold ${(v.outlier || 0) >= 3 ? "text-emerald-600" : ""}`}>{v.outlier ? v.outlier + "×" : "–"}</td><td className="text-xs text-ink-400">{v.published}</td></tr>)}</tbody></table></div>
    </Sec>
    <div className="grid gap-4 lg:grid-cols-2">
      <Sec icon={BarChart3} title="Channel baselines"><div className="space-y-1.5 text-sm">{(r.channels || []).map((c) => <div key={c.id} className="flex justify-between gap-2"><span className="truncate text-white">{c.name}</span><span className="text-ink-400">{c.subs || "?"} · median {n(c.medianViews)} views</span></div>)}</div></Sec>
      <Sec icon={Clock} title="Upload timing"><p className="text-sm text-ink-300">Best days: <b className="text-white">{r.timing?.bestDays.join(", ") || "–"}</b>{!!r.timing?.bestHours.length && <> · hours (UTC): <b className="text-white">{r.timing.bestHours.map((h) => `${h}:00`).join(", ")}</b></>}</p><p className="mt-1 text-[11px] text-ink-400">{r.timing?.note}</p></Sec>
    </div>
  </div>;
}

export function YtIntelPage() {
  const sp = useSearchParams(); const router = useRouter();
  const [topic, setTopic] = useState(""); const [format, setFormat] = useState<"any" | "long" | "shorts">("any"); const [minutes, setMinutes] = useState(""); const [err, setErr] = useState("");
  const [list, setList] = useState<{ id: string; topic: string; status: string; top?: string; createdAt: string }[]>([]);
  const id = sp.get("r"); const r = useReport(id); const busy = useRef(false);
  useEffect(() => { fetch("/api/ytintel").then((x) => x.json()).then((j) => setList(j.reports || [])).catch(() => {}); }, [id, r?.status]);
  const run = async () => { if (busy.current || topic.trim().length < 2) return; busy.current = true; setErr("");
    try { const x = await fetch("/api/ytintel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, format, minutes: Number(minutes) || undefined }) }); const j = await x.json(); if (!x.ok) throw new Error(j.error); router.push(`/youtube?r=${j.id}`); } catch (e) { setErr((e as Error).message); } finally { busy.current = false; } };
  const newProject = async () => { if (!r) return; const x = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: r.titles?.[0]?.title, mode: "drama", format: r.videos?.some((v) => v.duration && v.duration.split(":").length < 3 && +v.duration.split(":")[0] < 1) ? "yt_shorts" : "yt_long", idea: `${r.titles?.[0]?.title}\n\nHOOK: ${r.script?.hook}\n\n${r.script?.body}`.slice(0, 12000) }) }); const p = await x.json(); if (p.id) { await fetch(`/api/ytintel/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: p.id, titleIndex: 0 }) }); router.push(`/studio/${p.id}`); } };
  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
    <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10"><BarChart3 className="h-5 w-5 text-red-500" /></div><div><h1 className="text-2xl font-semibold tracking-tight text-white">YouTube Intelligence</h1><p className="text-sm text-ink-400">Study the top channels in a niche, then get ranked titles, a script, thumbnails, hashtags and keywords.</p></div></div>
    <div className="panel mt-5 p-4"><div className="flex flex-col gap-2 sm:flex-row">
      <input className="input flex-1" placeholder="Topic or niche, e.g. AI Nollywood drama" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
      <select className="input sm:w-36" value={format} onChange={(e) => setFormat(e.target.value as "any")}><option value="any">Any format</option><option value="long">Long videos</option><option value="shorts">Shorts</option></select>
      <input className="input sm:w-28" placeholder="Minutes" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      <button className="btn-brand h-10 px-5" onClick={run} disabled={topic.trim().length < 2}><Sparkles className="h-4 w-4" />Analyse</button></div>
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
      {!!list.length && <div className="mt-3 flex flex-wrap gap-1.5">{list.slice(0, 8).map((x) => <button key={x.id} className={`chip ${x.id === id ? "chip-on" : ""}`} onClick={() => router.push(`/youtube?r=${x.id}`)}>{x.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}{x.topic}</button>)}</div>}
    </div>
    {r && <div className="mt-5">{r.status === "done" && <div className="mb-3 flex justify-end"><button className="btn-outline h-9" onClick={newProject}><FolderPlus className="h-4 w-4" />Start a project from this</button></div>}<ReportView r={r} /></div>}
  </div>;
}

/** Compact panel for a project (brainstorm / workspace): run on the project's idea and auto-fill its YouTube title, description and tags. */
export function YtProjectPanel({ projectId, seed, yt }: { projectId: string; seed: string; yt?: { reportId: string; title: string; description: string; tags: string[]; hashtags: string[] } }) {
  const [rid, setRid] = useState<string | null>(yt?.reportId || null); const [open, setOpen] = useState(false); const r = useReport(open ? rid : null);
  const run = async () => { const x = await fetch("/api/ytintel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: seed.slice(0, 120), projectId }) }); const j = await x.json(); if (j.id) { setRid(j.id); setOpen(true); } };
  return <div className="panel p-3">
    <div className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-red-500" /><b className="text-white">YouTube Intelligence</b>
      <span className="truncate text-ink-400">{yt ? `Title: ${yt.title}` : "Titles, description, tags & thumbnails from top competitors"}</span>
      <div className="ml-auto flex gap-1">{rid && <button className="btn-ghost h-8 text-xs" onClick={() => setOpen(!open)}>{open ? "Hide" : "View report"}</button>}<button className="btn-outline h-8 text-xs" onClick={run} disabled={!seed.trim()}><Sparkles className="h-3.5 w-3.5" />{yt ? "Re-run" : "Auto-fill"}</button></div></div>
    {yt && !open && <div className="mt-2 flex flex-wrap gap-1">{[...yt.hashtags, ...yt.tags.slice(0, 8)].map((t) => <span key={t} className="chip h-6 text-[11px]">{t}</span>)}</div>}
    {open && r && <div className="mt-3"><ReportView r={r} projectId={projectId} /></div>}
  </div>;
}
