import { NextResponse } from "next/server";
import { createSession, signUp } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";
import { emailReady, gate, mailTo, sendVerify } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if ((getConfig("SIGNUPS") || process.env.SIGNUPS || "closed") !== "open") return NextResponse.json({ error: "Sign-ups are closed right now." }, { status: 403 });
  const g = gate(req, "signup", 5, 60 * 60_000); if (g) return g;
  const { email, password, name, agree } = await req.json().catch(() => ({}));
  if (agree !== true) return NextResponse.json({ error: "Please agree to the Terms and Privacy Policy to create an account." }, { status: 400 });
  try {
    const verify = emailReady();
    const u0 = await signUp(String(email || ""), String(password || ""), name ? String(name) : undefined, !verify);
    const u = { ...u0 }; const rec = db.getUser(u0.id); if (rec) await db.saveUser({ ...rec, termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });
    if (verify) {
      const r = await sendVerify(u.id);
      return NextResponse.json({ ok: true, verify: true, sent: r.ok, email: u.email });
    }
    await createSession(u); mailTo(u.id, "welcome");
    return NextResponse.json({ ok: true, user: u });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
