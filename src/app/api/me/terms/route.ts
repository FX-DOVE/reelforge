import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { agree } = await req.json().catch(() => ({}));
  if (agree !== true) return NextResponse.json({ error: "Please agree to the Terms and Privacy Policy to continue." }, { status: 400 });
  const r = db.getUser(u.id); if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.saveUser({ ...r, termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });
  return NextResponse.json({ ok: true, termsVersion: TERMS_VERSION });
}
