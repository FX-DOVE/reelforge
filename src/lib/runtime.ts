import { parseScenes, NARRATOR_RE } from "./screenplay";
import { FORMATS, type Project } from "./types";
/** Meta MMS speaks ≈ 2.3 words/s; each line has ~0.5s of breath, each action beat ≈ 2.5s on screen. */
export const WPS = 2.3,
  LINE_PAUSE = 0.5,
  ACTION_SEC = 2.5;
export function estimateRuntime(script: string) {
  const { scenes } = parseScenes(script || "");
  let words = 0,
    lines = 0,
    actions = 0;
  for (const s of scenes)
    for (const it of s.items) {
      if (it.kind === "dialog") {
        words += it.text.split(/\s+/).filter(Boolean).length;
        lines++;
      } else actions += Math.max(1, Math.round(it.text.split(/\s+/).length / 22));
    }
  const sec = Math.round(words / WPS + lines * LINE_PAUSE + actions * ACTION_SEC);
  return { sec, words, lines, actions, scenes: scenes.length };
}
/** Budget for a target runtime: ~60% of screen time spoken. */
export function budget(sec: number) {
  return {
    words: Math.round(sec * 0.6 * WPS),
    lines: Math.max(2, Math.round(sec / 6)),
    actions: Math.max(2, Math.round((sec * 0.4) / ACTION_SEC)),
    scenes: Math.max(1, Math.min(14, Math.round(sec / 40))),
    shots: Math.max(3, Math.round(sec / 5)),
  };
}
export const fmtDur = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`);
/** "make a 3 minute film", "90-second ad", "2.5 min", "1min30" → seconds */
export function parseLength(t: string): number | undefined {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?\s*(min(?:ute)?s?|m\b|sec(?:ond)?s?|s\b)(?:\s*(\d+)\s*(?:s|sec))?/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const v = /^m/i.test(m[2]) ? n * 60 + (m[3] ? +m[3] : 0) : n;
  return v >= 10 && v <= 3600 ? Math.round(v) : undefined;
}
/** Default when the user lets AI decide: sized to the platform, never the format maximum. */
export const autoLength = (p: Project) =>
  (({ yt_shorts: 45, tiktok: 60, fb_reels: 45, yt_long: 180 }) as Record<string, number>)[p.format] || Math.min(120, FORMATS[p.format]?.maxSec || 120);
export function lengthBrief(sec: number) {
  const b = budget(sec);
  return `TARGET RUNTIME: ${fmtDur(sec)} (${sec}s) — the finished film must land within ±10% (${Math.round(sec * 0.9)}–${Math.round(sec * 1.1)}s). Budget: about ${b.words} spoken words in total across ~${b.lines} dialogue/narration lines (voices speak ~${Math.round(WPS * 60)} words per minute), ~${b.actions} short action beats, ${b.scenes} scene${b.scenes > 1 ? "s" : ""}, ~${b.shots} shots. Do NOT write more than this; do not pad to the platform maximum.`;
}
