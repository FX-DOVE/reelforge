import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { DATA_DIR } from "./db";
import { getConfig } from "./config";
import { chatP, generateImage, llmLive, parseJson } from "./providers/meta";
import { suggest } from "./youtube";
import { UA } from "./research";

/**
 * YouTube Intelligence — a vidIQ-style competitor + SEO report we compute ourselves (vidIQ has no public API and is never scraped).
 * Data: YouTube Data API v3 when YOUTUBE_API_KEY is set, otherwise YouTube's public search/watch/channel pages (the same JSON the
 * website renders) + YouTube autocomplete. Generation: Meta Muse Spark (titles, script, thumbnails, tags, description) and
 * optionally Muse Image (thumbnail mockup). Reports are per-user files under DATA_DIR/ytintel/<owner>/.
 */
export interface YtVideo { id: string; title: string; channel: string; channelId?: string; views: number; published?: string; ageHours?: number; vph?: number; duration?: string; outlier?: number; tags?: string[]; description?: string; uploadHour?: number; uploadDay?: string }
export interface YtChannel { id: string; name: string; subs?: string; medianViews?: number; sampled: number; topTitle?: string }
export interface Kw { keyword: string; score: number; demand: number; competition: number; inAutocomplete: boolean }
export interface YtReport {
  id: string; ownerId: string; topic: string; format: "long" | "shorts" | "any"; status: "running" | "done" | "error"; error?: string; steps: { t: number; text: string }[];
  source?: string; createdAt: string; finishedAt?: string;
  videos?: YtVideo[]; channels?: YtChannel[]; timing?: { bestDays: string[]; bestHours: number[]; note: string }; autocomplete?: string[];
  titles?: { title: string; score: number; why: string }[]; script?: { hook: string; body: string; retention: string[] }; thumbnails?: { text: string; composition: string; colors: string; emotion: string; image?: string }[];
  hashtags?: string[]; keywords?: Kw[]; description?: string; insights?: string; provider?: string; projectId?: string;
}
const ROOT = path.join(DATA_DIR, "ytintel");
const safe = (s: string) => s.replace(/[^\w-]/g, "_");
const dir = (owner: string) => path.join(ROOT, safe(owner));
const file = (owner: string, id: string) => path.join(dir(owner), safe(id) + ".json");
const live: Set<string> = ((globalThis as unknown as { __yti?: Set<string> }).__yti ??= new Set());
function save(r: YtReport) { fs.mkdirSync(dir(r.ownerId), { recursive: true }); fs.writeFileSync(file(r.ownerId, r.id) + ".tmp", JSON.stringify(r)); fs.renameSync(file(r.ownerId, r.id) + ".tmp", file(r.ownerId, r.id)); }
export function getReport(owner: string, id: string): YtReport | null {
  try { const r: YtReport = JSON.parse(fs.readFileSync(file(owner, id), "utf8")); if (r.status === "running" && !live.has(r.id)) { r.status = "error"; r.error = "The server restarted while this report was running — run it again."; } return r; } catch { return null; }
}
export function listReports(owner: string) {
  try { return fs.readdirSync(dir(owner)).filter((f) => f.endsWith(".json")).map((f) => getReport(owner, f.slice(0, -5))).filter(Boolean).sort((a, b) => b!.createdAt.localeCompare(a!.createdAt)).slice(0, 30).map((r) => ({ id: r!.id, topic: r!.topic, status: r!.status, createdAt: r!.createdAt, top: r!.titles?.[0]?.title })); } catch { return []; }
}
export const thumbPath = (owner: string, id: string, n: number) => path.join(dir(owner), `${safe(id)}-thumb${n}.png`);

// ---------- data collection ----------
const hdr = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1; SOCS=CAI" };
const num = (s?: string) => { if (!s) return 0; const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i); if (!m) return 0; return Math.round(parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase() as "K"] || 1)); };
const relHours = (s?: string) => { const m = s?.match(/(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|mo|min|hr|[smhdwy])\b/i); if (!m) return undefined; const u = m[2].toLowerCase(); const k = u.startsWith("mo") ? 730 : u.startsWith("mi") ? 1 / 60 : ({ s: 1 / 3600, m: 1 / 60, h: 1, d: 24, w: 168, y: 8760 } as Record<string, number>)[u[0]]; return k ? +m[1] * k : undefined; };
const txt = (o: any) => o?.simpleText ?? o?.runs?.map((r: any) => r.text).join("") ?? ""; // eslint-disable-line @typescript-eslint/no-explicit-any
function walk(o: any, key: string, out: any[] = []): any[] { if (!o || typeof o !== "object") return out; if (o[key]) out.push(o[key]); for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, key, out); return out; } // eslint-disable-line @typescript-eslint/no-explicit-any
async function initialData(url: string) {
  const html = await (await fetch(url, { headers: hdr, signal: AbortSignal.timeout(15000) })).text();
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});<\/script/) || html.match(/ytInitialData"?\]?\s*=\s*(\{[\s\S]+?\});/);
  return { data: m ? JSON.parse(m[1]) : null, html };
}
function fromRenderer(v: any): YtVideo { // eslint-disable-line @typescript-eslint/no-explicit-any
  const owner = v.ownerText?.runs?.[0] || v.longBylineText?.runs?.[0];
  const pub = txt(v.publishedTimeText); const age = relHours(pub); const views = num(txt(v.viewCountText));
  return { id: v.videoId, title: txt(v.title), channel: owner?.text || "", channelId: owner?.navigationEndpoint?.browseEndpoint?.browseId, views, published: pub, ageHours: age, vph: age ? Math.round(views / Math.max(1, age)) : undefined, duration: txt(v.lengthText) };
}
async function publicSearch(q: string, sp?: string): Promise<YtVideo[]> {
  const { data } = await initialData(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en${sp ? "&sp=" + sp : ""}`);
  return walk(data, "videoRenderer").map(fromRenderer).filter((v) => v.id && v.title);
}
async function publicChannel(id: string): Promise<{ views: number[]; subs?: string; name?: string; top?: string }> {
  const { data, html } = await initialData(`https://www.youtube.com/channel/${id}/videos?hl=en`);
  const vids = walk(data, "videoRenderer").map(fromRenderer);
  for (const l of walk(data, "lockupViewModel")) { // 2025+ channel grid layout
    const md = l.metadata?.lockupMetadataViewModel; const parts = walk(md, "metadataParts").flat(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const vp = parts.find((p: any) => /views?/i.test(p?.accessibilityLabel || p?.text?.content || "")); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (md?.title?.content && vp) vids.push({ id: l.contentId, title: md.title.content, channel: "", views: num(vp.text?.content || vp.accessibilityLabel), published: parts.map((p: any) => p?.text?.content || "").find((t: string) => /ago/.test(t)) }); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  const subs = html.match(/"subscriberCountText":\{[^}]*?"simpleText":"([^"]+)"/)?.[1] || html.match(/"content":"([\d.,]+[KMB]? subscribers)"/)?.[1];
  return { views: vids.map((v) => v.views).filter((n) => n > 0), subs, top: vids.sort((a, b) => b.views - a.views)[0]?.title };
}
async function publicWatch(id: string): Promise<{ tags: string[]; description: string; publishDate?: string; views?: number }> {
  const html = await (await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: hdr, signal: AbortSignal.timeout(15000) })).text();
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});(?:var|<\/script)/); let pr: any = null; try { pr = m ? JSON.parse(m[1]) : null; } catch { /* partial match */ } // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = pr?.videoDetails, mf = pr?.microformat?.playerMicroformatRenderer;
  return { tags: d?.keywords || (html.match(/<meta name="keywords" content="([^"]*)"/)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean), description: d?.shortDescription || "", publishDate: mf?.publishDate || mf?.uploadDate || html.match(/"publishDate":"([^"]+)"/)?.[1] || html.match(/itemprop="datePublished" content="([^"]+)"/)?.[1], views: d?.viewCount ? +d.viewCount : undefined };
}
async function apiCollect(key: string, q: string, fmt: YtReport["format"]) {
  const g = async (p: string) => { const r = await fetch(`https://www.googleapis.com/youtube/v3/${p}&key=${key}`, { signal: AbortSignal.timeout(15000) }); const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || "YouTube API " + r.status); return j; };
  const dur = fmt === "shorts" ? "&videoDuration=short" : fmt === "long" ? "&videoDuration=medium" : "";
  const ids = new Set<string>();
  for (const order of ["relevance", "viewCount"]) { const j = await g(`search?part=snippet&type=video&maxResults=25&order=${order}${dur}&q=${encodeURIComponent(q)}&publishedAfter=${new Date(Date.now() - 365 * 864e5).toISOString()}`); for (const it of j.items || []) ids.add(it.id.videoId); }
  const vj = await g(`videos?part=snippet,statistics,contentDetails&id=${[...ids].slice(0, 50).join(",")}`);
  const vids: YtVideo[] = (vj.items || []).map((it: any) => { const pub = it.snippet.publishedAt; const age = (Date.now() - Date.parse(pub)) / 36e5; const views = +it.statistics.viewCount || 0; const d = new Date(pub); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle, channelId: it.snippet.channelId, views, published: pub.slice(0, 10), ageHours: age, vph: Math.round(views / Math.max(1, age)), duration: it.contentDetails.duration, tags: it.snippet.tags || [], description: it.snippet.description, uploadHour: d.getUTCHours(), uploadDay: d.toUTCString().slice(0, 3) }; });
  const chIds = [...new Set(vids.map((v) => v.channelId!))].slice(0, 12);
  const cj = await g(`channels?part=snippet,statistics&id=${chIds.join(",")}`);
  const channels: YtChannel[] = (cj.items || []).map((c: any) => ({ id: c.id, name: c.snippet.title, subs: c.statistics.hiddenSubscriberCount ? "hidden" : Number(c.statistics.subscriberCount).toLocaleString("en"), medianViews: +c.statistics.videoCount ? Math.round(+c.statistics.viewCount / +c.statistics.videoCount) : undefined, sampled: +c.statistics.videoCount })); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { vids, channels, source: "YouTube Data API v3 (channel average = lifetime views ÷ videos)" };
}
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function publicCollect(q: string, fmt: YtReport["format"], step: (t: string) => void) {
  const mod = fmt === "shorts" ? " #shorts" : "";
  const lists = await Promise.all([publicSearch(q + mod).catch(() => []), publicSearch(q + mod, "CAM%3D").catch(() => []), publicSearch(q + mod, "EgIIBA%3D%3D").catch(() => [])]); // relevance, most viewed, this month
  const seen = new Map<string, YtVideo>(); for (const l of lists) for (const v of l) if (!seen.has(v.id)) seen.set(v.id, v);
  let vids = [...seen.values()];
  if (fmt === "shorts") vids = vids.filter((v) => !v.duration || /^0?:?\d{1,2}$|^0:\d\d$|^1:00$/.test(v.duration));
  if (fmt === "long") vids = vids.filter((v) => !v.duration || v.duration.split(":").length > 2 || +v.duration.split(":")[0] >= 4);
  step(`Found ${vids.length} competing videos on public YouTube search`);
  // channel baselines for the channels that appear most / rank highest
  const byCh = new Map<string, YtVideo[]>(); for (const v of vids) if (v.channelId) byCh.set(v.channelId, [...(byCh.get(v.channelId) || []), v]);
  const chIds = [...byCh.entries()].sort((a, b) => b[1].reduce((s, v) => s + v.views, 0) - a[1].reduce((s, v) => s + v.views, 0)).slice(0, 8).map(([k]) => k);
  const channels: YtChannel[] = [];
  for (const id of chIds) { try { const c = await publicChannel(id); channels.push({ id, name: byCh.get(id)![0].channel, subs: c.subs, medianViews: median(c.views), sampled: c.views.length, topTitle: c.top }); step(`Channel baseline: ${byCh.get(id)![0].channel} — median ${median(c.views).toLocaleString("en")} views over ${c.views.length} recent uploads`); } catch { /* skip */ } }
  // tags/description/upload time for the strongest videos
  const top = [...vids].sort((a, b) => (b.vph || 0) - (a.vph || 0)).slice(0, 8);
  await Promise.all(top.map(async (v) => { try { const w = await publicWatch(v.id); v.tags = w.tags; v.description = w.description.slice(0, 1500); if (w.views) v.views = w.views; if (w.publishDate) { const d = new Date(w.publishDate); v.uploadDay = d.toUTCString().slice(0, 3); if (/T\d/.test(w.publishDate)) v.uploadHour = d.getUTCHours(); } } catch { /* gated */ } }));
  step(`Read tags + descriptions of ${top.filter((v) => v.tags?.length || v.description).length} top videos`);
  return { vids, channels, source: "Public YouTube search / channel / watch pages (no API key set — add one in Admin → Research agent for exact upload times and lifetime channel averages)" };
}

// ---------- scoring ----------
function scoreKeywords(cands: string[], vids: YtVideo[], ac: string[]): Kw[] {
  const corpus = vids.map((v) => ({ t: `${v.title} ${(v.tags || []).join(" ")}`.toLowerCase(), w: Math.log10(10 + (v.vph || 0)) * (v.outlier ? Math.min(3, 0.5 + v.outlier / 2) : 1) }));
  const maxW = corpus.reduce((s, c) => s + c.w, 0) || 1;
  const out = [...new Set(cands.map((k) => k.toLowerCase().replace(/^#/, "").trim()).filter((k) => k.length > 2))].map((k) => {
    const hits = corpus.filter((c) => c.t.includes(k)); const acI = ac.findIndex((a) => a.toLowerCase().includes(k));
    const demand = Math.min(100, Math.round((acI >= 0 ? 55 - acI * 3 : 10) + (hits.reduce((s, c) => s + c.w, 0) / maxW) * 60));
    const competition = Math.min(100, Math.round((hits.length / Math.max(1, corpus.length)) * 100));
    return { keyword: k, demand, competition, inAutocomplete: acI >= 0, score: Math.max(1, Math.min(100, Math.round(demand * 0.7 + (100 - competition) * 0.3))) };
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 25);
}

// ---------- the job ----------
export function startReport(o: { ownerId: string; topic: string; format?: YtReport["format"]; audience?: string; minutes?: number; mockup?: boolean; projectId?: string }): YtReport {
  const r: YtReport = { id: nanoid(10), ownerId: o.ownerId, topic: o.topic.slice(0, 200), format: o.format || "any", status: "running", steps: [], createdAt: new Date().toISOString(), projectId: o.projectId };
  save(r); live.add(r.id);
  runReport(r, o).catch((e) => { r.status = "error"; r.error = (e as Error).message.slice(0, 300); }).finally(() => { r.finishedAt = new Date().toISOString(); live.delete(r.id); save(r); });
  return r;
}
export async function waitReport(owner: string, id: string, ms = 600_000) { const t = Date.now(); for (;;) { const r = getReport(owner, id); if (!r || r.status !== "running" || Date.now() - t > ms) return r; await new Promise((x) => setTimeout(x, 2000)); } }

async function runReport(r: YtReport, o: { topic: string; audience?: string; minutes?: number; mockup?: boolean }) {
  const step = (text: string) => { r.steps.push({ t: Date.now(), text }); save(r); };
  step(`Researching “${r.topic}”…`);
  const key = getConfig("YOUTUBE_API_KEY");
  let c: { vids: YtVideo[]; channels: YtChannel[]; source: string };
  if (key) { try { c = await apiCollect(key, r.topic, r.format); step(`YouTube Data API: ${c.vids.length} videos, ${c.channels.length} channels`); } catch (e) { step(`YouTube Data API failed (${(e as Error).message.slice(0, 80)}) — using public search`); c = await publicCollect(r.topic, r.format, step); } }
  else c = await publicCollect(r.topic, r.format, step);
  if (!c.vids.length) throw new Error("YouTube returned no videos for this topic (search may be blocked from the server right now).");
  const base = new Map(c.channels.map((x) => [x.id, x.medianViews || 0]));
  for (const v of c.vids) { const b = v.channelId ? base.get(v.channelId) : 0; if (b) v.outlier = Math.round((v.views / b) * 10) / 10; }
  c.vids.sort((a, b) => (b.outlier || 0) * 1e6 + (b.vph || 0) - ((a.outlier || 0) * 1e6 + (a.vph || 0)));
  r.videos = c.vids.slice(0, 40); r.channels = c.channels; r.source = c.source;
  // upload timing from the videos that report it
  const tv = c.vids.filter((v) => v.uploadDay); const days = Object.entries(tv.reduce<Record<string, number>>((a, v) => ((a[v.uploadDay!] = (a[v.uploadDay!] || 0) + (v.vph || 1)), a), {})).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  const hrs = Object.entries(tv.filter((v) => v.uploadHour !== undefined).reduce<Record<number, number>>((a, v) => ((a[v.uploadHour!] = (a[v.uploadHour!] || 0) + (v.vph || 1)), a), {})).sort((a, b) => b[1] - a[1]).map(([h]) => +h);
  r.timing = { bestDays: days.slice(0, 3), bestHours: hrs.slice(0, 3), note: tv.length ? `From ${tv.length} top videos' publish dates (weighted by views/hour)${hrs.length ? ", hours in UTC" : "; exact hours need the YouTube API key"}.` : "Publish dates unavailable." };
  // autocomplete demand
  const ac = [...new Set([...(await suggest(r.topic)), ...(await suggest(r.topic.split(" ").slice(0, 2).join(" ")))])];
  r.autocomplete = ac; step(`${ac.length} YouTube autocomplete phrases`); save(r);
  if (!llmLive()) throw new Error("No Meta key — add it in Admin to generate titles and scripts.");
  const brief = c.vids.slice(0, 25).map((v, i) => `${i + 1}. "${v.title}" — ${v.channel} · ${v.views.toLocaleString("en")} views · ${v.vph ?? "?"} views/h · outlier ${v.outlier ?? "?"}x · ${v.published || ""}${v.tags?.length ? ` · tags: ${v.tags.slice(0, 10).join(", ")}` : ""}`).join("\n");
  step("Muse Spark is comparing titles and hooks across the competitors…");
  const mins = o.minutes || (r.format === "shorts" ? 1 : 8);
  const res = await chatP([{ role: "system", content: `You are a YouTube growth strategist (like vidIQ / 1of10) for the niche given. Study ONLY the competitor data provided: which title patterns, emotional triggers, numbers, curiosity gaps and keywords drive the highest views/hour and outlier scores. Return JSON only:
{"insights":"4-6 sentences: what is working in this niche and why, citing specific competitor titles/outliers",
"titles":[10 objects {"title": original title (<=70 chars, never copy a competitor), "score": 0-100 predicted CTR strength, "why": one sentence referencing the pattern it borrows}] ranked best first,
"thumbnails":[3 objects {"text":"2-4 word overlay","composition":"subject, framing, background, focal point","colors":"palette","emotion":"facial expression/mood"}],
"hashtags":[5-8 hashtags with #],
"keywords":[20 candidate search keywords/tags, mixing broad and long-tail, taken from the data],
"description":"a ready-to-paste YouTube description: 2-line hook paragraph with the main keyword, a 3-5 line summary, chapter placeholders, a CTA and the hashtags at the end"}` }, { role: "user", content: `Niche/topic: ${r.topic}\nFormat: ${r.format}${o.audience ? `\nAudience: ${o.audience}` : ""}\n\nCOMPETITORS (sorted by outlier score):\n${brief}\n\nCHANNEL BASELINES:\n${c.channels.map((x) => `${x.name}: ${x.subs || "?"} subs, median ${x.medianViews?.toLocaleString("en") || "?"} views`).join("\n")}\n\nYOUTUBE AUTOCOMPLETE:\n${ac.join(" | ")}` }], { json: true, temperature: 0.5, task: "director" });
  const j = parseJson<{ insights: string; titles: YtReport["titles"]; thumbnails: YtReport["thumbnails"]; hashtags: string[]; keywords: string[]; description: string }>(res.text);
  r.provider = `${res.provider} · ${res.model}`;
  r.insights = j.insights; r.titles = (j.titles || []).slice(0, 10); r.thumbnails = (j.thumbnails || []).slice(0, 3); r.hashtags = (j.hashtags || []).map((h) => (h.startsWith("#") ? h : "#" + h).replace(/\s+/g, ""));
  r.keywords = scoreKeywords([...(j.keywords || []), ...ac.slice(0, 10)], c.vids, ac); r.description = j.description;
  step(`10 titles, 3 thumbnail concepts and ${r.keywords.length} scored keywords ready — writing the script…`); save(r);
  const sres = await chatP([{ role: "system", content: `You are a YouTube scriptwriter who maximises audience retention. Write an ORIGINAL ${mins}-minute script (~${Math.round(mins * 150)} spoken words) for the chosen title. Return JSON only: {"hook":"the first 15 seconds verbatim — a pattern interrupt + open loop that pays off the title promise","body":"the full script after the hook, with [SCENE]/[B-ROLL]/[ON SCREEN] cues and speaker names where characters talk; re-hooks every ~60-90s; ends with a CTA","retention":["5-8 short notes naming each retention device you used and where"]}` }, { role: "user", content: `Title: ${r.titles[0]?.title || r.topic}\nNiche: ${r.topic}\nWhat works in the niche: ${r.insights}\nTop competitor titles: ${c.vids.slice(0, 8).map((v) => v.title).join(" | ")}` }], { json: true, temperature: 0.7, task: "director" });
  r.script = parseJson(sres.text); step("Script written"); save(r);
  if (o.mockup !== false && r.thumbnails?.length) {
    step("Muse Image is drawing a thumbnail mockup for concept 1…");
    const t = r.thumbnails[0];
    try { const how = await generateImage({ prompt: `YouTube thumbnail, 16:9, high contrast, bold readable large text "${t.text}". ${t.composition}. Colours: ${t.colors}. Emotion: ${t.emotion}. Topic: ${r.topic}. Clean, punchy, professional.`, aspect: "16:9", outFile: thumbPath(r.ownerId, r.id, 1) }); if (how === "meta") t.image = `/api/ytintel/${r.id}/thumb/1`; } catch (e) { step(`Thumbnail mockup failed: ${(e as Error).message.slice(0, 80)}`); }
  }
  r.status = "done";
  if (r.projectId) try { const { db } = await import("./db"); const p = db.getProject(r.projectId); if (p && (p.ownerId === r.ownerId || r.ownerId === "admin")) { await db.update(p.id, (x) => { x.yt = { reportId: r.id, title: r.titles?.[0]?.title || r.topic, description: r.description || "", tags: (r.keywords || []).slice(0, 15).map((k) => k.keyword), hashtags: r.hashtags || [], thumbnail: r.thumbnails?.[0] ? `${r.thumbnails[0].text} — ${r.thumbnails[0].composition}` : undefined }; }); step("Filled the project's YouTube title, description and tags"); } } catch { /* project gone */ }
  step("Report complete");
}

/** Short text summary for the agent. */
export function reportText(r: YtReport) {
  if (r.status !== "done") return `Report ${r.status}${r.error ? ": " + r.error : ""}`;
  return `YouTube Intelligence for "${r.topic}" (${r.source})\nINSIGHTS: ${r.insights}\nTOP COMPETITORS: ${(r.videos || []).slice(0, 6).map((v) => `"${v.title}" (${v.channel}, ${v.views.toLocaleString("en")} views, ${v.outlier ?? "?"}x)`).join("; ")}\nTITLES: ${(r.titles || []).map((t, i) => `${i + 1}. ${t.title} [${t.score}]`).join(" | ")}\nTHUMBNAILS: ${(r.thumbnails || []).map((t) => `"${t.text}" — ${t.composition}`).join(" | ")}\nHASHTAGS: ${(r.hashtags || []).join(" ")}\nKEYWORDS: ${(r.keywords || []).slice(0, 12).map((k) => `${k.keyword} (${k.score})`).join(", ")}\nHOOK: ${r.script?.hook || ""}\nFull report: /youtube?r=${r.id}`;
}
