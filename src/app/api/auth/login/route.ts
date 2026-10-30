import { NextResponse } from "next/server";
import { checkCredentials, createSession } from "@/lib/auth";
import { hit, ipOf, limited, reset } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const k = "login:" + ipOf(req), ke = "login-e:" + String(email || "").trim().toLowerCase();
  if (limited(k, 10) || limited(ke, 8)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const u = await checkCredentials(String(email || ""), String(password || ""));
  if (!u) { hit(k); hit(ke); return NextResponse.json({ error: "Invalid email or password" }, { status: 401 }); }
  if (u.verified === false) return NextResponse.json({ error: "Please confirm your email first — check your inbox for the link.", unverified: true }, { status: 403 });
  reset(k); reset(ke);
  await createSession(u);
  return NextResponse.json({ ok: true, user: { id: u.id, email: u.email, role: u.role, name: u.name } });
}
