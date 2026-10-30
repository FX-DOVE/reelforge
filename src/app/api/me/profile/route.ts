import { NextResponse } from "next/server";
import { ADMIN_ID, createSession, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function PATCH(req: Request) {
  const s = await currentUser(); if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (s.id === ADMIN_ID) return NextResponse.json({ error: "The admin account is managed on the server." }, { status: 400 });
  const u = db.getUser(s.id)!; const { name } = await req.json().catch(() => ({}));
  u.name = String(name || "").trim().slice(0, 60) || undefined; await db.saveUser(u);
  await createSession({ ...s, name: u.name });
  return NextResponse.json({ ok: true, name: u.name });
}
