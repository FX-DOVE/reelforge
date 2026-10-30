import { NextResponse } from "next/server";
import { ADMIN_ID, clearSession, comparePassword, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { purgeUser } from "@/lib/purgeUser";
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
  const who = { email: u.email, name: u.name };
  const r = await purgeUser(u.id);
  await clearSession();
  mailTo(u.id, "deleted", who);
  return NextResponse.json({ ok: true, projects: r?.projects || 0 });
}
