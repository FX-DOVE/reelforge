import { FORMATS, type Aspect, type Format, type Project } from "./types";

/** Aspects a platform format is allowed to render. 16:9 is not a Short / Reel / TikTok frame. */
export const FORMAT_ASPECTS: Record<Format, Aspect[]> = {
  yt_shorts: ["9:16", "1:1", "4:5"],
  tiktok: ["9:16", "1:1", "4:5"],
  fb_reels: ["9:16", "1:1", "4:5"],
  yt_long: ["16:9", "1:1"],
};

export function coerceAspect(format: Format, aspect?: string): Aspect {
  const ok = FORMAT_ASPECTS[format] || [FORMATS[format].aspect];
  return aspect && (ok as string[]).includes(aspect) ? (aspect as Aspect) : FORMATS[format].aspect;
}

export function clampTarget(format: Format, target?: number): number | undefined {
  if (target == null || !Number.isFinite(target)) return undefined;
  return Math.min(target, FORMATS[format].maxSec);
}

/**
 * Scale shot lengths so they sum to at most maxSec. When the floor (min seconds)
 * still overflows, later shots are dropped. Returns the durations to keep, in order.
 */
export function fitDurations(durations: number[], maxSec: number, min = 2): number[] {
  if (!durations.length || maxSec <= 0) return [];
  const nums = durations.map((d) => (Number.isFinite(d) && d > 0 ? d : min));
  const sum = nums.reduce((a, b) => a + b, 0);
  let out = sum <= maxSec + 0.05 ? nums.map((d) => +d.toFixed(2)) : nums.map((d) => Math.max(min, Math.round(((d * maxSec) / sum) * 10) / 10));
  const total = () => out.reduce((a, b) => a + b, 0);
  let drift = +(total() - maxSec).toFixed(2);
  for (let i = out.length - 1; i >= 0 && drift > 0.05; i--) {
    const room = +(out[i] - min).toFixed(2);
    const cut = Math.min(Math.max(0, room), drift);
    if (cut > 0) {
      out[i] = +(out[i] - cut).toFixed(2);
      drift = +(drift - cut).toFixed(2);
    }
  }
  while (out.length > 1 && total() > maxSec + 0.05) out = out.slice(0, -1);
  if (out.length === 1 && out[0] > maxSec) out = [+maxSec.toFixed(2)];
  return out;
}

export function shotSeconds(p: Pick<Project, "scenes">) {
  return p.scenes.flatMap((s) => s.shots).reduce((n, sh) => n + (Number(sh.durationSec) || 0), 0);
}
