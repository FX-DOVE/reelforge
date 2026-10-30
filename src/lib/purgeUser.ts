import fs from "node:fs";
import path from "node:path";
import { purgeTokens } from "./auth";
import { DATA_DIR, db } from "./db";
import { purgeProject } from "./projects";
import { allSessions } from "./research";
import { releaseDesk } from "./deskLease";
import { deleteSite, listSites } from "./sites";

/** Delete a registered user and everything they own: projects (+ media on disk and R2, jobs), agents, chats, sites,
 *  YouTube reports, learned notes, avatar, desktop profile and auth tokens. Returns counts. */
export async function purgeUser(uid: string) {
  const u = db.getUser(uid); if (!u) return null;
  const projects = db.listProjects(uid);
  for (const p of projects) await purgeProject(p.id);
  for (const k of ["agents", "chats"]) for (const d of db.listDocs(k, uid)) await db.delDoc(k, d.id);
  const sites = listSites(uid); for (const s of sites) deleteSite(uid, s.id);
  for (const r of allSessions()) if (r.ownerId === uid) { r.stop = true; r.ownerId = "deleted"; r.notes = ""; r.steps = []; r.frames = []; }
  await purgeTokens(uid);
  const safe = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  fs.rmSync(path.join(DATA_DIR, "avatars", safe + ".img"), { force: true });
  fs.rmSync(path.join(DATA_DIR, "ytintel", safe), { recursive: true, force: true });
  await releaseDesk(uid, true);
  await db.deleteUser(uid);
  return { email: u.email, name: u.name, projects: projects.length, sites: sites.length };
}
