import { NextResponse } from "next/server";
import { createSession, signUp } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { emailReady, gate, mailTo, sendVerify } from "@/lib/accounts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if ((getConfig("SIGNUPS") || process.env.SIGNUPS || "closed") !== "open") return NextResponse.json({ error: "Sign-ups are closed right now." }, { status: 403 });
  const g = gate(req, "signup", 5, 60 * 60_000); if (g) return g;
  const { email, password, name } = await req.json().catch(() => ({}));
  try {
    const verify = emailReady();
    const u = await signUp(String(email || ""), String(password || ""), name ? String(name) : undefined, !verify);
    if (verify) {
      const r = await sendVerify(u.id);
      return NextResponse.json({ ok: true, verify: true, sent: r.ok, email: u.email });
    }
    await createSession(u); mailTo(u.id, "welcome");
    return NextResponse.json({ ok: true, user: u });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
