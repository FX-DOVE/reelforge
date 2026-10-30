/** Rule-based tidy-up for raw ASR text (wav2vec2 outputs UPPERCASE, no punctuation). No AI involved. */
const Q = /^(who|what|when|where|why|how|which|whose|is|are|am|was|were|do|does|did|can|could|would|should|will|shall|may|might|have|has|had|isn't|aren't|don't|doesn't|didn't|can't|won't)\b/;
const BREAK = /\s+\b(then|and then|after that|also|okay so|so now|next|finally)\b\s+/g;
const PROPER: Record<string, string> = { lagos: "Lagos", abuja: "Abuja", nigeria: "Nigeria", nollywood: "Nollywood", tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram", reelforge: "ReelForge", reel: "Reel", daniel: "Daniel", olivia: "Olivia", chisom: "Chisom", meta: "Meta", ai: "AI", k: "K", "i'm": "I'm", "i've": "I've", "i'll": "I'll", "i'd": "I'd", i: "I" };
const VOCAB = ["film", "films", "scene", "scenes", "script", "trailer", "movie", "rooftop", "narrator", "narration", "lagos", "abuja", "akara", "seller", "olivia", "daniel", "nollywood", "drama", "romantic", "comedy", "thriller", "storyboard", "character", "characters", "dialogue", "voiceover", "soundtrack", "music", "render", "project", "episode", "wildlife", "commando", "fantasy", "karate", "slower", "faster", "write", "create", "twist", "village", "market", "wedding", "mansion"];
const FIX: Record<string, string> = { fill: "film", fillm: "film", rite: "write", creat: "create", sane: "scene", legus: "lagos", deniel: "daniel", danyu: "daniel", "roof up": "rooftop", "roof top": "rooftop", "a curra": "akara", "a cara": "akara", "a kara": "akara", celler: "seller", warmovie: "war movie" };
const lev = (a: string, b: string) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
/** Snap near-miss spellings of film/studio words to the right word (edit distance, no AI). */
function fixWords(t: string) {
  for (const [k, v] of Object.entries(FIX)) t = t.replace(new RegExp(`\\b${k}s?\\b`, "g"), v);
  return t.split(" ").map((w) => { if (w.length < 5 || VOCAB.includes(w)) return w; let best = w, bd = 3; for (const v of VOCAB) { if (Math.abs(v.length - w.length) > 2 || v[0] !== w[0]) continue; const d = lev(w, v); if (d < bd && d <= (w.length >= 7 ? 2 : 1)) { bd = d; best = v; } } return best; }).join(" ");
}
export function punctuate(raw: string): string {
  let t = fixWords(raw.toLowerCase().replace(/\s+/g, " ").trim()); if (!t) return "";
  t = t.split(" ").map((w) => PROPER[w] || w).join(" ");
  // split into sentences at spoken connectors when the run is long
  const parts: string[] = []; let cur = "";
  for (const seg of t.replace(BREAK, (m) => `|${m.trim()} `).split("|")) {
    if (cur && cur.split(" ").length >= 6) { parts.push(cur.trim()); cur = seg; } else cur += (cur ? " " : "") + seg;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.map((s) => {
    s = s.replace(/\b(but|because|so|however|although)\b/g, (m, _a, i) => (i > 0 ? ", " + m : m)).replace(/\s+,/g, ",").replace(/^,\s*/, "");
    s = s.replace(/\b(please|okay|ok|yes|no|well)\b\s+(?=\w)/, (m, w, i) => (i === 0 ? w + ", " : m));
    const end = Q.test(s) ? "?" : s.split(" ").length > 2 ? "." : "";
    return s.charAt(0).toUpperCase() + s.slice(1) + end;
  }).join(" ").replace(/\s+/g, " ").trim();
}
