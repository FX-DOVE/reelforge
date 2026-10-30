import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { COOKIE, sessionKey, verifyToken, type SessionUser } from "./session";
export type { SessionUser };

export const ADMIN_ID = "admin";
let hashCache: string | null = null;
function adminHash() {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  if (!hashCache) hashCache = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "change-me-now", 10);
  return hashCache;
}
const adminEmail = () => (process.env.ADMIN_EMAIL || "admin@opie.local").toLowerCase();

/** Email + password → user (the env-configured admin, or a registered creator). */
export async function checkCredentials(email: string, password: string): Promise<SessionUser | null> {
  const e = email.trim().toLowerCase();
  if (!e || !password) return null;
  if (e === adminEmail()) return (await bcrypt.compare(password, adminHash())) ? { id: ADMIN_ID, email: e, role: "admin" } : null;
  const u = db.findUserByEmail(e);
  if (!u || !(await bcrypt.compare(password, u.hash))) return null;
  return { id: u.id, email: u.email, role: u.role === "admin" ? "admin" : "user", name: u.name, verified: u.verified !== false };
}
export async function signUp(email: string, password: string, name?: string, verified = true): Promise<SessionUser> {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
  if (e === adminEmail() || db.findUserByEmail(e)) throw new Error("An account with this email already exists — sign in instead.");
  const u = { id: "u_" + nanoid(10), email: e, name: (name || "").trim().slice(0, 60) || undefined, hash: await bcrypt.hash(password, 10), role: "user" as const, createdAt: new Date().toISOString(), verified, tv: 1 };
  if (!(await db.insertUserUnique(u))) throw new Error("An account with this email already exists — sign in instead.");
  return { id: u.id, email: u.email, role: "user", name: u.name };
}
export async function createSession(u: SessionUser | string) {
  const user: SessionUser = typeof u === "string" ? { id: ADMIN_ID, email: u, role: "admin" } : u;
  const days = user.role === "admin" ? 1 : 30;
  const tv = user.id === ADMIN_ID ? 0 : db.getUser(user.id)?.tv || 0;
  const token = await new SignJWT({ sub: user.email, uid: user.id, role: user.role, name: user.name, tv }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${days}d`).sign(await sessionKey());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * days });
}
export async function clearSession() { const c = await cookies(); c.delete(COOKIE); c.delete("opie_admin"); }
/** Signed-in user. Registered users are re-checked against the store: a deleted account, or a session older than the last
 *  password change (token version), is signed out. */
export async function currentUser(): Promise<SessionUser | null> {
  const s = await verifyToken((await cookies()).get(COOKIE)?.value);
  if (!s || s.id === ADMIN_ID) return s;
  const u = db.getUser(s.id);
  if (!u || (u.tv || 0) !== (s.tv || 0)) return null;
  return { ...s, email: u.email, name: u.name, role: u.role === "admin" ? "admin" : "user" };
}

/** Single-use, expiring email tokens (only a SHA-256 of the token is stored). */
type TokRec = { id: string; ownerId: string; kind: "verify" | "reset"; exp: number; updatedAt?: string };
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export async function issueToken(uid: string, kind: TokRec["kind"], ttlMs: number) {
  for (const t of db.listDocs<TokRec>("authtokens", uid)) if (t.kind === kind || t.exp < Date.now()) await db.delDoc("authtokens", t.id);
  const raw = crypto.randomBytes(32).toString("base64url");
  await db.putDoc<TokRec>("authtokens", { id: sha(raw), ownerId: uid, kind, exp: Date.now() + ttlMs });
  return raw;
}
export async function consumeToken(raw: string, kind: TokRec["kind"]): Promise<string | null> {
  if (!raw || raw.length > 100) return null;
  const t = db.getDoc<TokRec>("authtokens", sha(raw));
  if (!t || t.kind !== kind) return null;
  await db.delDoc("authtokens", t.id);
  return t.exp >= Date.now() && db.getUser(t.ownerId) ? t.ownerId : null;
}
export function peekToken(raw: string, kind: TokRec["kind"]) { const t = raw && raw.length <= 100 ? db.getDoc<TokRec>("authtokens", sha(raw)) : undefined; return !!t && t.kind === kind && t.exp >= Date.now(); }
export async function purgeTokens(uid: string) { for (const t of db.listDocs<TokRec>("authtokens", uid)) await db.delDoc("authtokens", t.id); }
export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const comparePassword = (p: string, h: string) => bcrypt.compare(p, h);
export async function isAdmin() { return (await currentUser())?.role === "admin"; }
/** 401 if signed out, 403 if signed in without the admin role, else null. */
export async function adminGate(): Promise<Response | null> {
  const u = await currentUser();
  if (!u) return Response.json({ error: "unauthorized" }, { status: 401 });
  return u.role === "admin" ? null : Response.json({ error: "Admins only." }, { status: 403 });
}
