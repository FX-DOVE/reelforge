import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { canAccess } from "@/lib/guard";
import { listReports, startReport } from "@/lib/ytintel";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await requireUser();
  if (u instanceof Response) return u;
  return NextResponse.json({ reports: listReports(u.id) });
}
export async function POST(req: Request) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  const topic = String(b.topic || "").trim();
  if (topic.length < 2) return NextResponse.json({ error: "Enter a topic or niche." }, { status: 400 });
  const pid = b.projectId ? String(b.projectId) : undefined;
  if (pid) {
    const p = db.getProject(pid);
    if (!p || !canAccess(u, p)) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const fmt = ["long", "shorts", "any"].includes(b.format) ? b.format : "any";
  const r = startReport({
    ownerId: u.id,
    topic,
    format: fmt,
    audience: b.audience ? String(b.audience).slice(0, 200) : undefined,
    minutes: Math.min(30, Math.max(0.5, Number(b.minutes) || 0)) || undefined,
    mockup: b.mockup !== false,
    projectId: pid,
  });
  return NextResponse.json({ id: r.id });
}
