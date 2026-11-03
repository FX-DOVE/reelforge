import { NextResponse } from "next/server";
import { consumeToken, createSession, hashPassword, peekToken, purgeTokens } from "@/lib/auth";
import { db } from "@/lib/db";
import { gate, mailTo } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return NextResponse.json({ valid: peekToken(new URL(req.url).searchParams.get("token") || "", "reset") });
}
export async function POST(req: Request) {
  const g = gate(req, "reset", 10, 15 * 60_000);
  if (g) return g;
  const { token, password } = await req.json().catch(() => ({}));
  if (String(password || "").length < 8) return NextResponse.json({ error: "Use at least 8 characters for your password." }, { status: 400 });
  const uid = await consumeToken(String(token || ""), "reset");
  const u = uid && db.getUser(uid);
  if (!u) return NextResponse.json({ error: "This reset link is invalid or has expired. Ask for a new one." }, { status: 400 });
  u.hash = await hashPassword(String(password));
  u.tv = (u.tv || 0) + 1;
  u.verified = true; // the inbox was proven
  await db.saveUser(u);
  await purgeTokens(u.id);
  await createSession({ id: u.id, email: u.email, role: u.role === "admin" ? "admin" : "user", name: u.name });
  mailTo(u.id, "changed");
  return NextResponse.json({ ok: true });
}
