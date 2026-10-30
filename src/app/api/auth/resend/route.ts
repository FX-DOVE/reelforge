import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gate, sendVerify } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  const g = gate(req, "resend", 5, 60 * 60_000) || gate(req, "resend-e", 3, 60 * 60_000, e); if (g) return g;
  const u = db.findUserByEmail(e);
  if (u && u.verified === false) await sendVerify(u.id);
  return NextResponse.json({ ok: true }); // same answer either way (no account probing)
}
