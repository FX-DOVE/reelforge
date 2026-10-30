import { NextResponse } from "next/server";
import { db } from "./db";
import { appUrl, emailReady, sendMail, tpl } from "./email";
import { issueToken } from "./auth";
import { hit, ipOf, limited } from "./ratelimit";

/** Rate limit helper: returns a 429 response when over, else counts the hit. */
export function gate(req: Request, name: string, max: number, windowMs: number, extra = "") {
  const k = `${name}:${ipOf(req)}${extra ? ":" + extra : ""}`;
  if (limited(k, max, windowMs)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  hit(k); return null;
}
export async function sendVerify(uid: string) {
  const u = db.getUser(uid); if (!u) return { ok: false };
  const t = await issueToken(uid, "verify", 24 * 3600_000);
  const m = tpl.verify(u.name, `${appUrl()}/api/auth/verify?token=${t}`);
  return sendMail({ to: u.email, ...m });
}
export async function sendReset(uid: string) {
  const u = db.getUser(uid); if (!u) return { ok: false };
  const t = await issueToken(uid, "reset", 3600_000);
  return sendMail({ to: u.email, ...tpl.reset(u.name, `${appUrl()}/reset?token=${t}`) });
}
export const mailTo = (uid: string, kind: "welcome" | "changed" | "deleted", override?: { email: string; name?: string }) => {
  const u = override || db.getUser(uid); if (!u) return;
  return sendMail({ to: u.email, ...tpl[kind](u.name) }).catch(() => {});
};
export { emailReady };
