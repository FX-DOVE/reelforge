import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailReady, gate, sendReset } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  const g = gate(req, "forgot", 6, 60 * 60_000) || gate(req, "forgot-e", 3, 60 * 60_000, e); if (g) return g;
  if (!emailReady()) return NextResponse.json({ error: "Password reset by email isn’t available yet. Contact support." }, { status: 503 });
  const u = db.findUserByEmail(e);
  if (u) await sendReset(u.id);
  return NextResponse.json({ ok: true }); // same answer whether or not the account exists
}
