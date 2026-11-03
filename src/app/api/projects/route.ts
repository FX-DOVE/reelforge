import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { createProject, healPlatform } from "@/lib/projects";
import { mediaSrc } from "@/lib/mediaSrc";
import type { Project } from "@/lib/types";

/** Card length: rendered film length → sum of shot durations → planned target length (0 = unknown). */
function projectLength(render: Project["render"], scenes: Project["scenes"], targetSec?: number) {
  if (render.status === "done") {
    if (render.durationSec) return render.durationSec;
    const m = /Rendered ([\d.]+)s/.exec(render.message || ""); // older renders only stored it in the message
    if (m) return parseFloat(m[1]);
  }
  const shots = scenes.reduce((n, s) => n + s.shots.reduce((m, sh) => m + (Number(sh.durationSec) || 0), 0), 0);
  return shots || targetSec || 0;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const ids = db.listProjects(u.role === "admin" ? undefined : u.id).map((p) => p.id);
  for (const id of ids) await healPlatform(id).catch(() => undefined);
  return NextResponse.json(
    db
      .listProjects(u.role === "admin" ? undefined : u.id)
      .map(({ id, title, mode, format, aspect, style, outputType, cover, updatedAt, scenes, render, ownerId, targetSec }) => ({
        id,
        title,
        mode,
        format,
        aspect,
        style,
        outputType,
        cover: cover ? mediaSrc(cover) : cover,
        updatedAt,
        shots: scenes.reduce((n, s) => n + s.shots.length, 0),
        durationSec: projectLength(render, scenes, targetSec),
        rendered: render.status === "done",
        rendering: render.status === "running" || render.status === "queued",
        ...(u.role === "admin" && ownerId !== u.id ? { ownerId } : {}),
      })),
  );
}

export async function POST(req: Request) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  return NextResponse.json(await createProject(b, u.id));
}
