import { NextResponse } from "next/server";
import { requireProject } from "@/lib/guard";
import { startAutoBrainstorm, staleCheck } from "@/lib/autobrainstorm";
import { learn } from "@/lib/memory";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Ctx) {
  const g = await requireProject((await params).id); if (g instanceof Response) return g;
  staleCheck(g.p); return NextResponse.json({ auto: g.p.auto || null, targetSec: g.p.targetSec || null });
}
export async function POST(req: Request, { params }: Ctx) {
  const g = await requireProject((await params).id); if (g instanceof Response) return g;
  const { prompt, length } = await req.json().catch(() => ({}));
  const text = String(prompt || "").trim().slice(0, 4000); if (!text) return NextResponse.json({ error: "Tell Reel what film you want." }, { status: 400 });
  const len = length === "auto" || length == null ? "auto" : Math.round(Number(length));
  if (len !== "auto" && !(len >= 10 && len <= 3600)) return NextResponse.json({ error: "Length must be between 10 seconds and 60 minutes." }, { status: 400 });
  learn(g.user.id, g.p, { kind: "brainstorm_request", detail: text.slice(0, 400) });
  try { const run = await startAutoBrainstorm(g.p, text, g.user.id, len); return NextResponse.json({ ok: true, auto: run }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
}
