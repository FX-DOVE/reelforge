import { WRITING } from "@/lib/jobs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildBible } from "@/lib/studio";
import { requireProject } from "@/lib/guard";
import { healPlatform, purgeProject } from "@/lib/projects";
import { FORMATS } from "@/lib/types";
import { clampTarget, coerceAspect } from "@/lib/platform";
import { mediaSrc } from "@/lib/mediaSrc";
import { learn } from "@/lib/memory";
import { GENRES, isGenre } from "@/lib/genres";

export const dynamic = "force-dynamic";

function bust<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === "string" && v.startsWith("/api/files/") ? mediaSrc(v) : v));
}
type Ctx = { params: Promise<{ id: string }> };
const EDITABLE = [
  "title",
  "mode",
  "format",
  "aspect",
  "style",
  "customStyle",
  "outputType",
  "videoProvider",
  "idea",
  "script",
  "narratorVoice",
  "music",
  "subtitles",
  "filmStyle",
  "targetSec",
] as const;

export async function GET(_: Request, { params }: Ctx) {
  const g = await requireProject((await params).id);
  if (g instanceof Response) return g;
  const healed = (await healPlatform(g.p.id)) || g.p;
  if (healed.writing && !WRITING.has(healed.id)) healed.writing = undefined;
  return NextResponse.json(bust(healed));
}
export async function PATCH(req: Request, { params }: Ctx) {
  const id = (await params).id;
  const g = await requireProject(id);
  if (g instanceof Response) return g;
  const b = await req.json();
  if ("filmStyle" in b && !isGenre(b.filmStyle)) delete b.filmStyle;
  const before = {
    filmStyle: g.p.filmStyle,
    style: g.p.style,
    customStyle: g.p.customStyle,
    narratorVoice: g.p.narratorVoice,
    music: g.p.music,
    script: g.p.script,
  };
  try {
    const p = await db.update(id, (x) => {
      const prevFormat = x.format;
      for (const k of EDITABLE) if (k in b) (x as unknown as Record<string, unknown>)[k] = b[k];
      if (!(x.format in FORMATS)) x.format = prevFormat;
      x.aspect = coerceAspect(x.format, x.aspect);
      if (x.targetSec != null) x.targetSec = clampTarget(x.format, x.targetSec);
      // picking a film style by hand pins it (Muse stops auto-picking) and moves the music bed to the genre's default
      if ("filmStyle" in b && b.filmStyle !== before.filmStyle) {
        x.filmStyleManual = true;
        if (x.music !== "none" && !("music" in b)) x.music = GENRES[b.filmStyle as keyof typeof GENRES].music;
      }
      if ("style" in b || "aspect" in b || "filmStyle" in b) x.bible = buildBible(x);
    });
    const changed = (["filmStyle", "style", "customStyle", "narratorVoice", "music"] as const).filter((k) => k in b && b[k] !== before[k]);
    if (changed.length) learn(g.user.id, p, { kind: "settings", detail: changed.map((k) => `${k}: ${String(before[k] ?? "")} → ${String(b[k])}`).join("; ") });
    if ("script" in b && typeof b.script === "string" && b.script !== before.script && before.script)
      learn(g.user.id, p, { kind: "script_edit", before: before.script, after: b.script });
    return NextResponse.json(bust(p));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
/** Delete the project and everything it produced (owner or admin). Running jobs are cancelled first. */
export async function DELETE(_: Request, { params }: Ctx) {
  const id = (await params).id;
  const g = await requireProject(id);
  if (g instanceof Response) return g;
  return NextResponse.json(await purgeProject(id));
}
