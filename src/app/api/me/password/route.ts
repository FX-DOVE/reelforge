import { NextResponse } from "next/server";
import { ADMIN_ID, comparePassword, createSession, currentUser, hashPassword, purgeTokens } from "@/lib/auth";
import { db } from "@/lib/db";
import { gate, mailTo } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const s = await currentUser(); if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (s.id === ADMIN_ID) return NextResponse.json({ error: "The admin password is set on the server." }, { status: 400 });
  const g = gate(req, "pwchange", 8, 15 * 60_000, s.id); if (g) return g;
  const { current, password } = await req.json().catch(() => ({}));
  const u = db.getUser(s.id)!;
  if (!(await comparePassword(String(current || ""), u.hash))) return NextResponse.json({ error: "Your current password is wrong." }, { status: 400 });
  if (String(password || "").length < 8) return NextResponse.json({ error: "Use at least 8 characters for your new password." }, { status: 400 });
  u.hash = await hashPassword(String(password)); u.tv = (u.tv || 0) + 1; await db.saveUser(u); await purgeTokens(u.id);
  await createSession({ ...s, name: u.name }); // this device stays signed in; every other session is revoked
  mailTo(u.id, "changed");
  return NextResponse.json({ ok: true });
}
