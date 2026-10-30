/**
 * Brainstorm with AI, autonomous: the user's prompt starts a durable background run that researches on YouTube,
 * the web and the agent's own desktop browser, then Muse Spark (Meta) writes ONE complete script with the genre skill,
 * fills the project (idea, title, script, bible) — no "pick an idea" step. State lives on the project (survives refresh).
 */
import { nanoid } from "nanoid";
import { db } from "./db";
import { chatP, llmLive, parseJson, structured } from "./providers/meta";
import { getSession, startResearch, type Session } from "./research";
import { pickGenre, genreFor, extractAssets, fitLength } from "./studio";
import { genreBrief } from "./genres";
import { autoLength, budget, estimateRuntime, fmtDur, lengthBrief, parseLength } from "./runtime";
import { getConfig } from "./config";
import type { AutoRun, AutoSource, Project } from "./types";
import { MODES, FORMATS } from "./types";

const running = ((globalThis as unknown as { __rfAuto?: Set<string> }).__rfAuto ??= new Set());
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const tfetch = (u: string, ms = 12000) => fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(ms) });

export const isAutoRunning = (pid: string) => running.has(pid);

/** YouTube search without a key: parse ytInitialData from the results page (titles, channel, views, length, description snippet). */
async function ytSearch(q: string): Promise<AutoSource[]> {
  const key = getConfig("YOUTUBE_API_KEY");
  if (key) {
    try {
      const sr = await (await tfetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=12&q=${encodeURIComponent(q)}&key=${key}`)).json();
      return (sr.items || []).map((x: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description: string } }) => ({ kind: "youtube" as const, title: x.snippet.title, url: `https://www.youtube.com/watch?v=${x.id.videoId}`, meta: `${x.snippet.channelTitle} · ${x.snippet.description.slice(0, 200)}` }));
    } catch { /* fall back to page */ }
  }
  try {
    const h = await (await tfetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en&gl=US`)).text();
    const m = h.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/); if (!m) return [];
    const out: AutoSource[] = [];
    const walk = (o: unknown) => { if (!o || typeof o !== "object" || out.length >= 15) return; const r = (o as Record<string, unknown>).videoRenderer as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (r?.videoId) { const txt = (x: any) => x?.simpleText || (x?.runs || []).map((y: { text: string }) => y.text).join("") || ""; // eslint-disable-line @typescript-eslint/no-explicit-any
        out.push({ kind: "youtube", title: txt(r.title), url: `https://www.youtube.com/watch?v=${r.videoId}`, meta: [txt(r.ownerText), txt(r.viewCountText), txt(r.lengthText), txt(r.publishedTimeText), (r.detailedMetadataSnippets?.[0] ? txt(r.detailedMetadataSnippets[0].snippetText) : txt(r.descriptionSnippet)).slice(0, 220)].filter(Boolean).join(" · ") }); return; }
      for (const v of Object.values(o as object)) walk(v); };
    walk(JSON.parse(m[1])); return out.filter((x) => x.title);
  } catch { return []; }
}
/** Captions for a video (timedtext track from the watch page), best effort. */
async function ytTranscript(url: string): Promise<string> {
  try {
    const h = await (await tfetch(url + "&hl=en")).text();
    const m = h.match(/"captionTracks":(\[[\s\S]*?\])/); if (!m) return "";
    const tracks = JSON.parse(m[1]) as { baseUrl: string; languageCode: string }[];
    const t = tracks.find((x) => x.languageCode?.startsWith("en")) || tracks[0]; if (!t) return "";
    const x = await (await tfetch(t.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3")).text();
    try { return (JSON.parse(x).events || []).map((e: { segs?: { utf8: string }[] }) => (e.segs || []).map((s) => s.utf8).join("")).join(" ").replace(/\s+/g, " ").trim(); }
    catch { return strip(x); }
  } catch { return ""; }
}
async function webSearch(q: string): Promise<AutoSource[]> {
  try {
    const h = await (await tfetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)).text();
    const out: AutoSource[] = []; const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g; let m;
    while ((m = re.exec(h)) && out.length < 8) { let u = m[1]; const uu = u.match(/uddg=([^&]+)/); if (uu) u = decodeURIComponent(uu[1]); if (/duckduckgo\.com\/y\.js|youtube\.com/.test(u)) continue; out.push({ kind: "web", title: strip(m[2]), url: u, meta: strip(m[3]).slice(0, 300) }); }
    return out;
  } catch { return []; }
}
async function pageText(u: string) { try { const r = await tfetch(u, 10000); if (!r.ok || !/html|text/.test(r.headers.get("content-type") || "")) return ""; return strip((await r.text()).slice(0, 400_000)).slice(0, 3000); } catch { return ""; } }

async function upd(pid: string, fn: (a: AutoRun) => void) { await db.update(pid, (x) => { if (x.auto) fn(x.auto); }); }
const step = (pid: string, text: string) => upd(pid, (a) => { a.step = text; a.steps.push({ at: new Date().toISOString(), text }); });

export async function startAutoBrainstorm(p: Project, prompt: string, ownerId: string, lengthSec?: number | "auto") {
  if (running.has(p.id)) throw new Error("Already researching — watch the progress below.");
  const parsed = parseLength(prompt);
  const targetSec = typeof lengthSec === "number" ? lengthSec : parsed;
  const run: AutoRun = { id: nanoid(8), prompt, status: "running", step: "Starting…", steps: [], sources: [], targetSec, startedAt: new Date().toISOString() };
  await db.update(p.id, (x) => { x.auto = run; if (targetSec) x.targetSec = targetSec; x.brainstorm.push({ role: "user", content: prompt, at: run.startedAt }); });
  running.add(p.id);
  void execute(p.id, prompt, ownerId).catch(async (e) => { await upd(p.id, (a) => { a.status = "error"; a.error = (e as Error).message.slice(0, 300); a.finishedAt = new Date().toISOString(); }); }).finally(() => running.delete(p.id));
  return run;
}

async function execute(pid: string, prompt: string, ownerId: string) {
  let p = db.getProject(pid)!; const all: AutoSource[] = []; const notes: string[] = [];
  const add = async (xs: AutoSource[]) => { const seen = new Set(all.map((s) => s.url || s.title)); const nw = xs.filter((s) => !seen.has(s.url || s.title)); all.push(...nw); await upd(pid, (a) => { a.sources = all.slice(0, 120); }); };
  // 1) plan: topic + search queries + length (AI decides when not given)
  await step(pid, "Planning the research…");
  let plan = { topic: prompt.slice(0, 60), yt: [prompt.slice(0, 80)], web: [prompt.slice(0, 80)], seconds: 0, desktop: true };
  if (llmLive()) try {
    const r = await chatP([{ role: "system", content: `Plan research for a short film. Mode: ${MODES[p.mode]}; platform ${FORMATS[p.format].label} (max ${FORMATS[p.format].maxSec}s). Return JSON {"topic": 2-6 word topic, "yt": [4 distinct YouTube search queries for top-performing similar videos/stories], "web": [3 web queries for facts, culture, real-world details], "seconds": ideal runtime in seconds for this idea on this platform (typical: shorts 30-60, long-form 120-300), "desktop": true only if the idea needs live browsing on the computer (real-world topic, trend, place, product, event or references to look at); false for purely invented fiction that the API searches cover}.` }, { role: "user", content: prompt }], { json: true, temperature: 0.2, task: "director" });
    plan = { ...plan, ...parseJson<typeof plan>(r.text) };
  } catch { /* defaults */ }
  if (!p.targetSec) { const s = Math.round(Math.min(FORMATS[p.format].maxSec, Math.max(20, plan.seconds || autoLength(p)))); await db.update(pid, (x) => { x.targetSec = s; if (x.auto) x.auto.targetSec = s; }); }
  p = db.getProject(pid)!;
  await step(pid, `Target length ${fmtDur(p.targetSec!)} · topic “${plan.topic}”`);
  // 2) the agent's own desktop: visible YouTube research + transcripts + Google facts (user can watch it live)
  const rs = plan.desktop !== false ? startResearch({ goal: plan.topic, task: "topic", projectId: pid, ownerId, workspace: "main", maxSteps: 10, auto: true }) : null;
  if (rs) { await upd(pid, (a) => { a.researchId = rs.id; }); await step(pid, "Working on Reel’s computer — browsing YouTube (tap the computer icon to watch)"); }
  // 3) in parallel: more YouTube queries + web research
  for (const q of (plan.yt || []).slice(0, 4)) { await step(pid, `YouTube search: “${q}”`); await add(await ytSearch(q)); }
  const vids = all.filter((s) => s.kind === "youtube");
  await step(pid, `Found ${vids.length} similar videos — reading transcripts of the top ones…`);
  let tN = 0;
  for (const v of vids.slice(0, 6)) { const t = await ytTranscript(v.url!); if (t.length > 200) { tN++; notes.push(`TRANSCRIPT "${v.title}" (${v.meta?.slice(0, 80)}): ${t.slice(0, 2200)}`); await add([{ kind: "transcript", title: `Transcript: ${v.title}`, url: v.url, meta: `${t.split(" ").length} words` }]); } }
  await step(pid, `Read ${tN} transcript${tN === 1 ? "" : "s"}`);
  for (const q of (plan.web || []).slice(0, 3)) { await step(pid, `Web search: “${q}”`); await add(await webSearch(q)); }
  const webs = all.filter((s) => s.kind === "web").slice(0, 6);
  await step(pid, `Reading ${webs.length} web pages…`);
  for (const w of webs) { const t = await pageText(w.url!); if (t.length > 300) notes.push(`WEB "${w.title}" (${w.url}): ${t.slice(0, 1800)}`); }
  // wait for the desktop run (bounded)
  for (let i = 0; rs && i < 90; i++) { const s = getSession(rs.id); if (!s || !["running", "paused"].includes(s.status)) break; if (i % 10 === 0 && s.steps.length) await step(pid, `Computer: ${s.steps[s.steps.length - 1].action.slice(0, 90)}`); await sleep(2000); }
  const s = rs ? getSession(rs.id) as Session | undefined : undefined;
  if (s) {
    await add([...s.trending.map((v) => ({ kind: "desktop" as const, title: v.title, url: v.url, meta: [v.channel, v.views, v.length].filter(Boolean).join(" · ") })), ...(s.facts || []).slice(0, 8).map((f) => ({ kind: "desktop" as const, title: f.slice(0, 90), meta: "Google (desktop browser)" }))]);
    if (s.notes) notes.unshift(`DESKTOP RESEARCH NOTES:\n${s.notes.slice(0, 3000)}`); notes.push(...s.findings.slice(0, 4).map((f) => f.slice(0, 1800)));
  }
  await step(pid, `Gathered ${all.length} sources — choosing the film style…`);
  // 4) synthesis: one complete script with the genre skill + bible
  await pickGenre(p, prompt); p = db.getProject(pid)!; const g = genreFor(p);
  await step(pid, `Writing the full script with Muse Spark${g ? ` · ${g.label} skill` : ""}…`);
  const srcList = all.filter((x) => x.kind === "youtube" || x.kind === "desktop").slice(0, 40).map((x, i) => `${i + 1}. ${x.title} — ${x.meta || ""}`).join("\n");
  const b = budget(p.targetSec!);
  const { data, source } = await structured<{ title: string; logline: string; idea: string; script: string }>(
    `You are the head writer of an AI film studio. From ALL the research below, synthesize ONE original, high-quality, complete film — do not offer options. Learn from what performs (hooks, structure, pacing, emotional beats) but never copy titles, plots, characters or real people. Mode: ${MODES[p.mode]}. Platform: ${FORMATS[p.format].label} ${p.aspect}.
${g ? genreBrief(g, "script") : ""}
${lengthBrief(p.targetSec!)}
Screenplay format: first line "TITLE: ...", scene headings (INT./EXT. LOCATION - TIME), action lines, CHARACTER in caps on its own line, then dialogue (one speaker per line, 4–14 simple, easily pronounced words — voices are synthetic). ${p.mode !== "drama" ? "Use NARRATOR for voice-over." : ""} Describe every character vividly on first appearance (age, gender, face, skin tone, hair, build, exact wardrobe colours, accessories) and keep wardrobe/props/locations consistent scene to scene (continuity). Open with a 2-second hook; end with a satisfying payoff or cliffhanger.
Return JSON {"title": string, "logline": one sentence, "idea": short development note (premise, hook, beats, characters), "script": the full screenplay}.`,
    `USER REQUEST: ${prompt}\n\nTOP-PERFORMING SIMILAR VIDEOS:\n${srcList}\n\nRESEARCH NOTES:\n${notes.join("\n\n").slice(0, 22000)}\n\nBudget reminder: ~${b.words} spoken words, ${b.scenes} scenes.`,
    () => ({ title: p.title, logline: prompt, idea: prompt, script: `TITLE: ${p.title}\n\nEXT. STREET - DAY\n\nDemo mode — add a Meta key in Admin.` }), undefined, "director");
  const raw = (data as unknown as Record<string, unknown>);
  let script = [raw.script, raw.screenplay].find((v) => typeof v === "string" && (v as string).length > 40) as string | undefined;
  if (!script) throw new Error("Muse returned no script — try again");
  const fit = await fitLength(p, script, (t) => void step(pid, t)); script = fit.script;
  await db.update(pid, (x) => { x.script = script!; x.idea = [data.title && `${data.title}: `, data.logline, data.idea && `\n${data.idea}`].filter(Boolean).join(""); if (data.title && (!x.title || x.title === "Untitled project")) x.title = data.title; });
  await step(pid, "Building the characters, wardrobe, locations & props bible…");
  try { await extractAssets(db.getProject(pid)!); } catch { /* user can rebuild from the Bible tab */ }
  const est = estimateRuntime(script).sec;
  await db.update(pid, (x) => {
    x.brainstorm.push({ role: "assistant", kind: "research", content: `**Done — “${data.title}”** written from ${all.length} sources (${vids.length} YouTube videos, ${tN} transcripts, ${webs.length} web pages${s ? ", plus Reel’s desktop browser" : ""}).\n\n${data.logline || ""}\n\nEstimated runtime **${fmtDur(est)}** (target ${fmtDur(x.targetSec!)}). The script, idea and bible are filled in — edit anything you like.`, provider: source, at: new Date().toISOString() });
    if (x.auto) { x.auto.status = "done"; x.auto.estSec = est; x.auto.provider = source; x.auto.finishedAt = new Date().toISOString(); x.auto.step = "Script ready"; x.auto.steps.push({ at: x.auto.finishedAt, text: `Script ready · ~${fmtDur(est)} · ${all.length} sources` }); }
  });
}
/** After a restart an in-flight run can't continue: mark it so the UI offers a retry. */
export function staleCheck(p: Project) { if (p.auto?.status === "running" && !running.has(p.id) && Date.now() - Date.parse(p.auto.startedAt) > 15000) void upd(p.id, (a) => { a.status = "error"; a.error = "Interrupted by a server restart — press Retry."; }); }
