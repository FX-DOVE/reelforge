"use client";
import { useEffect, useState } from "react";
import { Download, ExternalLink, Globe, LayoutTemplate, Trash2, Upload } from "lucide-react";
type S = { id: string; name: string; versions: number; updatedAt: string; preview: string; published: string | null; prompt: string };
export function SitesPage() {
  const [sites, setSites] = useState<S[] | null>(null); const [sel, setSel] = useState<string | null>(null); const [msg, setMsg] = useState("");
  const load = () => fetch("/api/sites").then((r) => r.json()).then((j) => { setSites(j.sites || []); setSel((x) => x || j.sites?.[0]?.id || null); });
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: string) => { if (action === "delete" && !confirm("Delete this site?")) return; const r = await fetch(`/api/sites/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const j = await r.json(); setMsg(j.error || (j.url ? `Live at ${location.origin}${j.url}` : "")); if (action === "delete") setSel(null); load(); };
  const s = sites?.find((x) => x.id === sel);
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10"><LayoutTemplate className="h-5 w-5 text-brand-500" /></div><div><h1 className="text-2xl font-semibold tracking-tight text-white">Sites</h1><p className="text-sm text-ink-400">Websites your agents built. Ask any agent “build me a landing page for …” to make one.</p></div></div>
    {sites && !sites.length && <div className="panel mt-6 p-8 text-center text-sm text-ink-400">No sites yet. Open the agent chat and say “build me a landing page for my film”.</div>}
    {!!sites?.length && <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-1.5">{sites.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`panel w-full p-3 text-left ${x.id === sel ? "ring-2 ring-brand-500/40" : ""}`}><div className="truncate text-sm font-medium text-white">{x.name}</div><div className="text-[11px] text-ink-400">v{x.versions} · {new Date(x.updatedAt).toLocaleString()}{x.published ? " · live" : ""}</div></button>)}</div>
      {s && <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3"><b className="mr-auto truncate text-sm text-white">{s.name}</b>
          <a className="btn-ghost h-8 text-xs" href={s.preview} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open</a>
          <a className="btn-ghost h-8 text-xs" href={`/api/sites/${s.id}/zip`}><Download className="h-3.5 w-3.5" />Zip</a>
          {s.published ? <><a className="btn-ghost h-8 text-xs" href={s.published} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" />Live</a><button className="btn-ghost h-8 text-xs" onClick={() => act(s.id, "unpublish")}>Unpublish</button></> : <button className="btn-brand h-8 text-xs" onClick={() => act(s.id, "publish")}><Upload className="h-3.5 w-3.5" />Publish</button>}
          <button className="btn-ghost h-8 text-xs text-red-500" onClick={() => act(s.id, "delete")}><Trash2 className="h-3.5 w-3.5" /></button></div>
        {msg && <div className="border-b border-white/[0.06] px-3 py-2 text-xs text-emerald-600">{msg}</div>}
        <iframe key={s.id + s.versions} src={s.preview} className="h-[70vh] w-full bg-white" sandbox="allow-scripts allow-forms allow-popups" title={s.name} />
      </div>}
    </div>}
  </div>;
}
