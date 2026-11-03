import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { DATA_DIR } from "./db";
import { chatP } from "./providers/meta";
import { UA } from "./research";

/** Fast web research for the Reel agent: Bing results page → read the top pages → Muse Spark writes a sourced summary. */
const strip = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
function realUrl(u: string) {
  const m = u.replace(/&amp;/g, "&").match(/[?&]u=a1([^&]+)/);
  if (m)
    try {
      return Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    } catch {
      /* */
    }
  return u.replace(/&amp;/g, "&");
}
export async function searchWeb(q: string) {
  const html = await (
    await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&cc=US`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(15000),
    })
  ).text();
  return html
    .split('<li class="b_algo"')
    .slice(1)
    .map((b) => {
      const a = b.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const p = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      return a ? { url: realUrl(a[1]), title: strip(a[2]), snippet: p ? strip(p[1]).slice(0, 300) : "" } : null;
    })
    .filter((x): x is { url: string; title: string; snippet: string } => !!x && /^https?:/.test(x.url))
    .slice(0, 8);
}
async function readPage(u: string) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (!/text\/html|text\/plain/.test(r.headers.get("content-type") || "")) return "";
    return strip((await r.text()).slice(0, 400_000)).slice(0, 3500);
  } catch {
    return "";
  }
}

export async function webSearch(query: string, step: (t: string) => void = () => {}) {
  step(`Searching the web for “${query}”…`);
  const res = await searchWeb(query);
  if (!res.length) return "No web results (search engine unreachable right now).";
  step(`${res.length} results — reading the top pages`);
  const pages = await Promise.all(res.slice(0, 4).map(async (r) => ({ ...r, text: await readPage(r.url) })));
  step("Muse Spark is summarising the sources…");
  const src =
    pages.map((p, i) => `[${i + 1}] ${p.title} — ${p.url}\n${p.text || p.snippet}`).join("\n\n") +
    "\n\nOTHER RESULTS:\n" +
    res
      .slice(4)
      .map((r, i) => `[${i + 5}] ${r.title} — ${r.url}: ${r.snippet}`)
      .join("\n");
  const r = await chatP(
    [
      {
        role: "system",
        content:
          "Answer the research query using ONLY the sources. 6-12 bullet points of concrete facts, each ending with its source number like [2]. Then a one-line takeaway. Say clearly if the sources don't answer it.",
      },
      { role: "user", content: `Query: ${query}\n\nSOURCES:\n${src.slice(0, 16000)}` },
    ],
    { temperature: 0.2 },
  );
  return `${r.text.trim()}\n\nSources:\n${res
    .slice(0, 8)
    .map((x, i) => `[${i + 1}] ${x.title} ${x.url}`)
    .join("\n")}`;
}

/** Long-form writing saved into the agent's workspace (DATA_DIR/docs/<owner>/<workspace>/). */
export async function writeDoc(
  o: { ownerId: string; workspace: string; instruction: string; kind: string; title?: string; context?: string },
  step: (t: string) => void = () => {},
) {
  step(`Muse Spark is writing the ${o.kind}…`);
  const r = await chatP(
    [
      {
        role: "system",
        content: `You are an expert writer. Write the requested ${o.kind} in polished Markdown: strong headline, clear structure, specific and useful (no filler, no placeholders unless the user must fill something in). If it's code, output the complete working code in a fenced block with a short explanation.`,
      },
      { role: "user", content: `${o.instruction}${o.context ? `\n\nUseful context from earlier tool results:\n${o.context.slice(0, 5000)}` : ""}` },
    ],
    { temperature: 0.6, task: "director" },
  );
  const text = r.text.trim();
  const title = (o.title || text.match(/^#\s+(.+)$/m)?.[1] || o.instruction).slice(0, 80);
  const d = path.join(DATA_DIR, "docs", o.ownerId.replace(/[^\w-]/g, "_"), o.workspace.replace(/[^\w-]/g, "_"));
  fs.mkdirSync(d, { recursive: true });
  const f = `${new Date().toISOString().slice(0, 10)}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)}-${nanoid(4)}.md`;
  fs.writeFileSync(path.join(d, f), text);
  step(`Saved “${title}” (${text.split(/\s+/).length} words)`);
  return `Saved document "${title}" (${f}, ${text.split(/\s+/).length} words, ${r.provider} · ${r.model}).\n\n${text.slice(0, 3200)}`;
}
