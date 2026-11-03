/** Per-agent bot look. Shared by server (validation) and client (rendering). */
export const BOT_SHAPES = ["round", "tall", "cube", "retro"] as const;
export const BOT_EYES = ["glow", "happy", "visor", "pixel", "sleepy"] as const;
export const BOT_ACC = ["none", "headphones", "cap", "beret", "twin", "bow", "halo"] as const;
export const BOT_PALETTES = [
  { name: "Pearl", body: ["#ffffff", "#eef1f6", "#c9d0dc"], acc: ["#5aa9ff", "#0a64d8"], eye: "#5cc8ff" },
  { name: "Mint", body: ["#f4fff9", "#d9f5e7", "#9fd8bb"], acc: ["#4cd98a", "#14a35a"], eye: "#62f0a8" },
  { name: "Peach", body: ["#fff8f2", "#ffe4d1", "#f2b894"], acc: ["#ff9f5a", "#e8641c"], eye: "#ffb36b" },
  { name: "Lilac", body: ["#fbf7ff", "#ece2fb", "#c6b2ea"], acc: ["#b98cff", "#7d4be0"], eye: "#c9a6ff" },
  { name: "Rose", body: ["#fff7f9", "#ffe0e8", "#f1a9bc"], acc: ["#ff6f91", "#e0335c"], eye: "#ff8fab" },
  { name: "Sky", body: ["#f5fcff", "#daf1fb", "#9fd3ea"], acc: ["#45c3f5", "#0b8fd0"], eye: "#7ddcff" },
  { name: "Graphite", body: ["#7b8190", "#4c5260", "#2b2f38"], acc: ["#ffd24a", "#e5a800"], eye: "#ffe07a" },
  { name: "Sand", body: ["#fffaf0", "#f3e6cc", "#d6bf92"], acc: ["#c99a52", "#94682a"], eye: "#ffd08a" },
] as const;
export type BotStyle = { shape: (typeof BOT_SHAPES)[number]; palette: number; eyes: (typeof BOT_EYES)[number]; acc: (typeof BOT_ACC)[number] };
export const DEFAULT_BOT: BotStyle = { shape: "round", palette: 0, eyes: "glow", acc: "none" };
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
export const randomBot = (): BotStyle => ({
  shape: pick(BOT_SHAPES),
  palette: Math.floor(Math.random() * BOT_PALETTES.length),
  eyes: pick(BOT_EYES),
  acc: pick(BOT_ACC),
});
export function cleanBot(b: unknown): BotStyle | undefined {
  if (!b || typeof b !== "object") return undefined;
  const o = b as Record<string, unknown>;
  const shape = BOT_SHAPES.find((x) => x === o.shape),
    eyes = BOT_EYES.find((x) => x === o.eyes),
    acc = BOT_ACC.find((x) => x === o.acc);
  const palette = Number.isInteger(o.palette) && (o.palette as number) >= 0 && (o.palette as number) < BOT_PALETTES.length ? (o.palette as number) : undefined;
  return shape && eyes && acc && palette !== undefined ? { shape, eyes, acc, palette } : undefined;
}
/** Stable look for older agents that never chose one (derived from id). */
export function botFor(id: string | undefined, b?: BotStyle): BotStyle {
  if (b) return b;
  if (!id) return DEFAULT_BOT;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    shape: BOT_SHAPES[h % 4],
    palette: (h >> 3) % BOT_PALETTES.length,
    eyes: BOT_EYES[(h >> 6) % BOT_EYES.length],
    acc: BOT_ACC[(h >> 9) % BOT_ACC.length],
  };
}
