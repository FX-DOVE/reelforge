import { NextResponse } from "next/server";
import { requireUser, canAccess } from "@/lib/guard";
import { db } from "@/lib/db";
import { getReport } from "@/lib/ytintel";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const r = getReport(u.id, (await params).id);
  return r ? NextResponse.json(r) : NextResponse.json({ error: "not found" }, { status: 404 });
}
/** Apply a report to a project: chosen title, description, tags + hashtags (and the hook/script as the idea when the project has no script yet). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const r = getReport(u.id, (await params).id);
  if (!r || r.status !== "done") return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const p = db.getProject(String(b.projectId || ""));
  if (!p || !canAccess(u, p)) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const t = r.titles?.[Number(b.titleIndex) || 0]?.title || r.topic;
  const n = await db.update(p.id, (x) => {
    x.yt = {
      reportId: r.id,
      title: t,
      description: r.description || "",
      tags: (r.keywords || []).slice(0, 15).map((k) => k.keyword),
      hashtags: r.hashtags || [],
      thumbnail: r.thumbnails?.[0] ? `${r.thumbnails[0].text} — ${r.thumbnails[0].composition}` : undefined,
    };
    if (b.renameProject !== false) x.title = t.slice(0, 120);
    if (b.useScript && r.script && !x.script.trim()) x.idea = `${t}\n\nHOOK: ${r.script.hook}\n\n${r.script.body}`.slice(0, 12000);
  });
  return NextResponse.json({ ok: true, project: { id: n.id, title: n.title, yt: n.yt } });
}
