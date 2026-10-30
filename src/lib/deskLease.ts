import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, db } from "./db";
import { DESK_URL } from "./desk";

/** Reel's computer is ONE Linux desktop, so it is leased to one account at a time. Each account has its own desktop
 *  profile (home folder, files, Chromium logins/cookies/history). On hand-over the outgoing profile is packed up and
 *  stored in the app's private data volume (outside the desktop container, so nothing on the desktop can read it),
 *  the desktop is wiped, and the incoming account's profile is restored. Nobody can view or control a desktop leased
 *  to someone else. */
const IDLE_MS = 10 * 60_000;
const DIR = path.join(DATA_DIR, "desk-profiles");
type Lease = { uid: string | null; at: number };
const g = globalThis as unknown as { __rfLease?: Lease; __rfSwitch?: Promise<unknown> };
const safe = (uid: string) => uid.replace(/[^\w-]/g, "");
const file = (uid: string) => path.join(DIR, safe(uid) + ".tgz");

function lease(): Lease {
  if (!g.__rfLease) { try { g.__rfLease = JSON.parse(db.getSetting("DESK_LEASE") || ""); } catch { /* */ } }
  // the pre-accounts desktop home belongs to the admin
  return (g.__rfLease ||= { uid: "admin", at: 0 });
}
const save = (l: Lease) => { g.__rfLease = l; void db.setSetting("DESK_LEASE", JSON.stringify({ uid: l.uid, at: 0 })); };
export const deskOwner = () => lease().uid;
export function touchDesk(uid: string) { const l = lease(); if (l.uid === uid) l.at = Date.now(); }

async function agentBusy(uid: string) {
  try { const { allSessions } = await import("./research"); return allSessions().some((s) => s.ownerId === uid && s.onDesk && (s.status === "running" || s.status === "paused")); } catch { return false; }
}
/** Is the desktop held by another active account? → minutes until it frees up (or null when it's yours / free). */
export async function deskBusyFor(uid: string): Promise<number | null> {
  const l = lease();
  if (!l.uid || l.uid === uid) return null;
  if (!db.getUser(l.uid) && l.uid !== "admin") return null; // owner deleted
  const idle = Date.now() - l.at;
  if (idle >= IDLE_MS && !(await agentBusy(l.uid))) return null;
  return Math.max(1, Math.ceil((IDLE_MS - idle) / 60_000));
}

async function swap(to: string | null) {
  const l = lease(), from = l.uid;
  fs.mkdirSync(DIR, { recursive: true });
  // 1) pack + wipe the outgoing profile (desk kills every desktop process first)
  const ex = await fetch(DESK_URL + "/export", { method: "POST", signal: AbortSignal.timeout(180_000) });
  if (!ex.ok) throw new Error("desktop export failed " + ex.status);
  const tgz = Buffer.from(await ex.arrayBuffer());
  if (from && tgz.length && (from === "admin" || db.getUser(from))) { fs.writeFileSync(file(from) + ".tmp", tgz); fs.renameSync(file(from) + ".tmp", file(from)); }
  // 2) restore the incoming profile (empty = fresh desktop)
  const body = to && fs.existsSync(file(to)) ? fs.readFileSync(file(to)) : Buffer.alloc(0);
  const im = await fetch(DESK_URL + "/import", { method: "POST", body: new Uint8Array(body), headers: { "Content-Type": "application/gzip" }, signal: AbortSignal.timeout(180_000) });
  if (!im.ok) throw new Error("desktop import failed " + im.status);
  (globalThis as unknown as { __deskBrowser?: unknown }).__deskBrowser = undefined; // old CDP connection is gone
  save({ uid: to, at: Date.now() });
}

/** Claim the desktop for this account (switching profiles if someone idle had it). */
export async function claimDesk(uid: string, force = false): Promise<{ ok: true } | { ok: false; error: string; minutes: number }> {
  while (g.__rfSwitch) await g.__rfSwitch.catch(() => {});
  if (lease().uid === uid) { touchDesk(uid); return { ok: true }; }
  const m = force ? null : await deskBusyFor(uid);
  if (m !== null) return { ok: false, minutes: m, error: `Reel’s computer is being used by another creator right now. It frees up in about ${m} min.` };
  const p = (g.__rfSwitch = swap(uid));
  try { await p; } finally { g.__rfSwitch = undefined; }
  return { ok: true };
}
/** Release (and optionally delete) an account's desktop profile, e.g. on account deletion. */
export async function releaseDesk(uid: string, wipe = false) {
  if (lease().uid === uid) {
    while (g.__rfSwitch) await g.__rfSwitch.catch(() => {});
    try { await fetch(DESK_URL + "/export?discard=1", { method: "POST", signal: AbortSignal.timeout(60_000) }); await fetch(DESK_URL + "/import", { method: "POST", body: new Uint8Array(0), signal: AbortSignal.timeout(60_000) }); } catch { /* desk down */ }
    save({ uid: null, at: 0 });
  }
  if (wipe) fs.rmSync(file(uid), { force: true });
}
