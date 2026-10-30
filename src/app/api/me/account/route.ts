import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { ADMIN_ID, clearSession, comparePassword, currentUser, purgeTokens } from "@/lib/auth";
import { DATA_DIR, db } from "@/lib/db";
import { purgeProject } from "@/lib/projects";
import { allSessions } from "@/lib/research";
import { releaseDesk } from "@/lib/deskLease";
import { gate, mailTo } from "@/lib/accounts";
export const dynamic = "force-dynamic";
/** Delete my account and everything in it: projects (+ media on disk and R2, jobs), agents, chats, learned notes, avatar, desktop profile. */
export async function DELETE(req: Request) {
  const s = await currentUser(); if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (s.id === ADMIN_ID) return NextResponse.json({ error: "The admin account can’t be deleted here." }, { status: 400 });
  const g = gate(req, "delacct", 5, 15 * 60_000, s.id); if (g) return g;
  const { password } = await req.json().catch(() => ({}));
  const u = db.getUser(s.id)!;
  if (!(await comparePassword(String(password || ""), u.hash))) return NextResponse.json({ error: "Your password is wrong." }, { status: 400 });
  const projects = db.listProjects(u.id);
  for (const p of projects) await purgeProject(p.id);
  for (const k of ["agents", "chats"]) for (const d of db.listDocs(k, u.id)) await db.delDoc(k, d.id);
  for (const r of allSessions()) if (r.ownerId === u.id) { r.stop = true; r.ownerId = "deleted"; r.notes = ""; r.steps = []; r.frames = []; }
  await purgeTokens(u.id);
  fs.rmSync(path.join(DATA_DIR, "avatars", u.id + ".img"), { force: true });
  await releaseDesk(u.id, true);
  const who = { email: u.email, name: u.name };
  await db.deleteUser(u.id);
  await clearSession();
  mailTo(u.id, "deleted", who);
  return NextResponse.json({ ok: true, projects: projects.length });
}
