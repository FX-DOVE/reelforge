/** Rule-based tidy-up for raw ASR text (wav2vec2 outputs UPPERCASE, no punctuation). No AI involved. */
const Q = /^(who|what|when|where|why|how|which|whose|is|are|am|was|were|do|does|did|can|could|would|should|will|shall|may|might|have|has|had|isn't|aren't|don't|doesn't|didn't|can't|won't)\b/;
const BREAK = /\s+\b(then|and then|after that|also|okay so|so now|next|finally)\b\s+/g;
const PROPER: Record<string, string> = { lagos: "Lagos", abuja: "Abuja", nigeria: "Nigeria", nollywood: "Nollywood", tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram", reelforge: "ReelForge", reel: "Reel", meta: "Meta", ai: "AI", k: "K", "i'm": "I'm", "i've": "I've", "i'll": "I'll", "i'd": "I'd", i: "I" };
export function punctuate(raw: string): string {
  let t = raw.toLowerCase().replace(/\s+/g, " ").trim(); if (!t) return "";
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
