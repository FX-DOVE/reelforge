import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { DATA_DIR } from "./db";
import { chatP, generateImage, metaLive } from "./providers/meta";

/**
 * Simple static websites the Reel agent builds (Muse Spark writes the HTML/CSS/JS; Muse Image the hero art).
 * Stored per user + per agent workspace: DATA_DIR/sites/<owner>/<workspace>/<siteId>/. Private preview at /s/<id>-<token>/,
 * zip download at /api/sites/<id>/zip, optional publish to /p/<user-slug>/<site-slug>/ (copy under DATA_DIR/published).
 */
export interface Site { id: string; token: string; ownerId: string; workspace: string; name: string; slug: string; prompt: string; files: string[]; versions: number; createdAt: string; updatedAt: string; published?: string; provider?: string }
const ROOT = path.join(DATA_DIR, "sites"), PUB = path.join(DATA_DIR, "published");
const safe = (s: string) => s.replace(/[^\w-]/g, "_");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "site";
const idx = () => path.join(ROOT, "index.json");
function all(): Site[] { try { return JSON.parse(fs.readFileSync(idx(), "utf8")); } catch { return []; } }
function put(s: Site) { const a = all().filter((x) => x.id !== s.id); a.unshift(s); fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(idx() + ".tmp", JSON.stringify(a.slice(0, 2000))); fs.renameSync(idx() + ".tmp", idx()); }
export const siteDir = (s: Site) => path.join(ROOT, safe(s.ownerId), safe(s.workspace), safe(s.id));
export const getSite = (id: string) => all().find((s) => s.id === id);
export const listSites = (owner: string, ws?: string) => all().filter((s) => s.ownerId === owner && (!ws || s.workspace === ws));
export const previewUrl = (s: Site) => `/s/${s.id}-${s.token}/`;
export function siteByKey(key: string) { const [id, tok] = [key.slice(0, key.lastIndexOf("-")), key.slice(key.lastIndexOf("-") + 1)]; const s = getSite(id); return s && tok && s.token === tok ? s : undefined; }
export function deleteSite(owner: string, id: string) { const s = getSite(id); if (!s || s.ownerId !== owner) return false; fs.rmSync(siteDir(s), { recursive: true, force: true }); if (s.published) fs.rmSync(path.join(PUB, s.published), { recursive: true, force: true }); const a = all().filter((x) => x.id !== id); fs.writeFileSync(idx(), JSON.stringify(a)); return true; }

const strip = (t: string) => { const m = t.match(/```(?:html)?\s*([\s\S]*?)```/); const h = (m ? m[1] : t).trim(); const i = h.search(/<!doctype html|<html/i); return i > 0 ? h.slice(i) : h; };

/** Build a new site, or revise an existing one (siteId) per the instruction. */
export async function buildSite(o: { ownerId: string; workspace: string; prompt: string; name?: string; siteId?: string; heroImage?: boolean; step?: (t: string) => void }): Promise<Site> {
  const step = o.step || (() => {});
  let s = o.siteId ? getSite(o.siteId) : undefined;
  if (s && s.ownerId !== o.ownerId) throw new Error("not your site");
  const now = new Date().toISOString();
  if (!s) { const name = (o.name || o.prompt.replace(/^(build|make|create)( me)?( a| an)?/i, "").split(/[.,\n]/)[0]).trim().slice(0, 60) || "My site"; s = { id: nanoid(8).replace(/-/g, "x"), token: crypto.randomBytes(12).toString("hex"), ownerId: o.ownerId, workspace: o.workspace, name, slug: slugify(name), prompt: o.prompt, files: [], versions: 0, createdAt: now, updatedAt: now }; }
  const d = siteDir(s); fs.mkdirSync(path.join(d, "assets"), { recursive: true });
  const prev = fs.existsSync(path.join(d, "index.html")) ? fs.readFileSync(path.join(d, "index.html"), "utf8") : "";
  let hero = fs.existsSync(path.join(d, "assets/hero.png"));
  if (!hero && o.heroImage !== false && metaLive()) {
    step("Muse Image is painting the hero artwork…");
    try { await generateImage({ prompt: `Website hero image, wide cinematic banner, no text, no letters, no logos. For: ${o.prompt.slice(0, 400)}`, aspect: "16:9", outFile: path.join(d, "assets/hero.png") }); hero = true; } catch (e) { step(`Hero image skipped: ${(e as Error).message.slice(0, 80)}`); }
  }
  step(prev ? "Muse Spark is revising the page…" : "Muse Spark is writing the HTML, CSS and JavaScript…");
  const sys = `You are a senior front-end developer and designer. Output ONE complete, production-quality, self-contained index.html (inline <style> and <script>, no build step, no external JS frameworks; Google Fonts link allowed). Modern responsive design (mobile-first, CSS grid/flex, tasteful gradients, good typography, accessible contrast, semantic HTML), smooth-scroll nav, real persuasive copy (no lorem ipsum), sections the request implies (e.g. hero, features, social proof, pricing, FAQ, CTA, footer). HONESTY RULE: never invent facts. Any number, statistic, subscriber/view/follower count, rating, award, price, date, testimonial, client name, phone, email or address that the request does not explicitly give must be a clearly marked placeholder in square brackets, e.g. "[X] subscribers", "[Your price]", "[Customer name]", "[Testimonial from a real viewer]", "[your@email.com]" — never a made-up value like "847K". ${hero ? 'Use the image "assets/hero.png" as the hero background or hero visual.' : "Use CSS gradients and inline SVG for visuals (no external image URLs)."} Forms must not post anywhere (show a friendly thank-you message in JS). Output ONLY the HTML document.`;
  const user = prev ? `Current index.html:\n${prev.slice(0, 24000)}\n\nRevise it: ${o.prompt}` : `Build this website: ${o.prompt}`;
  const r = await chatP([{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0.6, task: "director" });
  const html = strip(r.text);
  if (!/<html|<body|<section|<div/i.test(html) || html.length < 400) throw new Error("The model did not return a usable HTML page — try again.");
  if (prev) fs.writeFileSync(path.join(d, `index.v${s.versions}.html`), prev);
  fs.writeFileSync(path.join(d, "index.html"), html);
  s.versions++; s.updatedAt = new Date().toISOString(); s.provider = `${r.provider} · ${r.model}`; if (prev) s.prompt += "\n→ " + o.prompt;
  s.files = ["index.html", ...(hero ? ["assets/hero.png"] : [])];
  put(s); if (s.published) publishSite(s.ownerId, s.id, s.published.split("/")[0]);
  step(`Page written (${Math.round(html.length / 1024)} KB)`);
  return s;
}

export function publishSite(owner: string, id: string, userSlug: string): string {
  const s = getSite(id); if (!s || s.ownerId !== owner) throw new Error("not found");
  const rel = `${slugify(userSlug)}/${s.slug}`; const out = path.join(PUB, rel);
  if (s.published && s.published !== rel) fs.rmSync(path.join(PUB, s.published), { recursive: true, force: true });
  const owned = path.join(out, ".owner"); if (fs.existsSync(owned) && fs.readFileSync(owned, "utf8") !== s.id) throw new Error("That address is taken by another site — rename this one.");
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const f of s.files) { fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.copyFileSync(path.join(siteDir(s), f), path.join(out, f)); }
  fs.writeFileSync(owned, s.id); s.published = rel; put(s);
  return `/p/${rel}/`;
}
export function unpublishSite(owner: string, id: string) { const s = getSite(id); if (!s || s.ownerId !== owner || !s.published) return; fs.rmSync(path.join(PUB, s.published), { recursive: true, force: true }); s.published = undefined; put(s); }
export const publishedFile = (user: string, slug: string, rel: string) => { const base = path.join(PUB, slugify(user), slugify(slug)); const abs = path.resolve(base, rel || "index.html"); return abs.startsWith(base + path.sep) && !abs.endsWith(".owner") && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null; };
export const siteFile = (s: Site, rel: string) => { const base = siteDir(s); const abs = path.resolve(base, rel || "index.html"); return abs.startsWith(base + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null; };

// minimal store-only ZIP (no dependency)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zipSite(s: Site): Buffer { const zd = new Date(); const dosT = (zd.getHours() << 11) | (zd.getMinutes() << 5) | (zd.getSeconds() >> 1), dosD = ((zd.getFullYear() - 1980) << 9) | ((zd.getMonth() + 1) << 5) | zd.getDate();
  const parts: Buffer[] = [], central: Buffer[] = []; let off = 0;
  for (const f of s.files) {
    const data = fs.readFileSync(path.join(siteDir(s), f)); const name = Buffer.from(`${s.slug}/${f}`); const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(dosT, 10); lh.writeUInt16LE(dosD, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(dosT, 12); ch.writeUInt16LE(dosD, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, name, data); central.push(ch, name); off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(s.files.length, 8); end.writeUInt16LE(s.files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
export const userSlug = (id: string, email: string, name?: string) => `${(name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "user"}-${id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase()}`;
