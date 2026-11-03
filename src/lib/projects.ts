import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { db, MEDIA_DIR } from "./db";
import { getConfig } from "./config";
import { FORMATS, type Project } from "./types";
import { clampTarget, coerceAspect, fitDurations } from "./platform";
import { canonicalVoice } from "./voiceCatalog";
import { DEFAULT_GENRE, GENRES, isGenre } from "./genres";
import { activeJobs, purgeProjectJobs } from "./jobs";
import { dropProjectClips } from "./render";
import { r2DeletePrefix } from "./storage";
import { anonymizeProject } from "./usage";
import { allSessions } from "./research";
import { forgetProjectInConvs } from "./agent";

export function newProject(b: Record<string, any>, ownerId: string): Project { // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = new Date().toISOString();
  const format = (b.format in FORMATS ? b.format : "yt_shorts") as Project["format"];
  return {
    id: nanoid(10), ownerId, title: String(b.title || "Untitled project").slice(0, 120), mode: ["drama", "documentary", "ad"].includes(b.mode) ? b.mode : "drama",
    format, aspect: coerceAspect(format, b.aspect),
    style: ["realistic", "pixar", "cartoon", "anime", "custom"].includes(b.style) ? b.style : "realistic", customStyle: b.customStyle || "",
    filmStyle: isGenre(b.filmStyle) ? b.filmStyle : DEFAULT_GENRE, filmStyleManual: isGenre(b.filmStyle) && b.filmStyle !== DEFAULT_GENRE ? true : b.filmStyleManual === true,
    outputType: b.outputType === "video" ? "video" : "image", idea: String(b.idea || ""), script: String(b.script || ""), brainstorm: [], assets: [], scenes: [], bible: "",
    narratorVoice: canonicalVoice(getConfig("DEFAULT_NARRATOR") || "mms-narrator"), music: b.mode === "ad" ? "upbeat" : b.mode === "documentary" ? "ambient" : GENRES[isGenre(b.filmStyle) ? b.filmStyle : DEFAULT_GENRE].music, subtitles: true,
    render: { status: "idle", progress: 0, message: "", updatedAt: t }, editLog: [], createdAt: t, updatedAt: t,
  };
}
export async function createProject(b: Record<string, unknown>, ownerId: string) { const p = newProject(b, ownerId); await db.saveProject(p); return p; }

/** Pull aspect and shot lengths back inside the platform format. No-op when the project already fits. */
export async function healPlatform(id: string): Promise<Project | undefined> {
  const p = db.getProject(id);
  if (!p || !(p.format in FORMATS)) return p;
  const aspect = coerceAspect(p.format, p.aspect);
  const max = FORMATS[p.format].maxSec;
  const target = clampTarget(p.format, p.targetSec);
  const shots = p.scenes.flatMap((s) => s.shots);
  const sum = shots.reduce((n, s) => n + (Number(s.durationSec) || 0), 0);
  const over = shots.length > 0 && sum > max + 0.05;
  if (aspect === p.aspect && !over && target === p.targetSec) return p;
  const fitted = over ? fitDurations(shots.map((s) => Number(s.durationSec) || 2), max) : null;
  return db.update(id, (x) => {
    x.aspect = aspect;
    if (x.targetSec != null && target != null && x.targetSec !== target) x.targetSec = target;
    if (!fitted) return;
    const flat = x.scenes.flatMap((s) => s.shots);
    const drop = new Set(flat.slice(fitted.length).map((s) => s.id));
    if (drop.size) {
      x.scenes = x.scenes.map((s) => ({ ...s, shots: s.shots.filter((sh) => !drop.has(sh.id)) })).filter((s) => s.shots.length);
      let i = 0;
      for (const s of x.scenes) for (const sh of s.shots) sh.index = i++;
    }
    x.scenes.flatMap((s) => s.shots).forEach((s, i) => {
      if (fitted[i] != null) s.durationSec = fitted[i];
    });
  });
}

/** Delete a project and everything it produced: running jobs, DB row, job records, local media, R2 objects, research sessions, chat links.
 *  Cost rows are kept for billing totals but lose their project id. Learned user memory is untouched. */
export async function purgeProject(id: string) {
  const running = activeJobs(id).length;
  dropProjectClips(id);
  for (const s of allSessions()) if (s.projectId === id) { s.stop = true; s.projectId = undefined; s.notes = ""; s.findings = []; s.steps = []; s.frames = []; s.transcript = undefined; }
  forgetProjectInConvs(id);
  await db.deleteProject(id);
  const jobs = purgeProjectJobs(id);
  const dir = path.join(MEDIA_DIR, id);
  const rm = () => fs.rmSync(dir, { recursive: true, force: true });
  rm();
  // a render/ffmpeg step that was mid-write can still flush a file: sweep again once it has unwound
  for (const ms of [15_000, 90_000, 600_000]) setTimeout(() => { try { if (fs.existsSync(dir)) rm(); void r2DeletePrefix(`media/${id}/`); } catch { /* */ } }, ms).unref?.();
  const r2 = await r2DeletePrefix(`media/${id}/`);
  const usage = anonymizeProject(id);
  return { ok: true, cancelledJobs: running, jobRecords: jobs, r2, usageRowsAnonymized: usage, mediaLeft: fs.existsSync(dir) };
}
