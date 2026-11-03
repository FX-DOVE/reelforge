import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { deleteSite, getSite, publishSite, unpublishSite, userSlug } from "@/lib/sites";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const id = (await params).id;
  const s = getSite(id);
  if (!s || s.ownerId !== u.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "publish") return NextResponse.json({ url: publishSite(u.id, id, userSlug(u.id, u.email, db.getUser(u.id)?.name || u.name)) });
    if (b.action === "unpublish") {
      unpublishSite(u.id, id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "delete") return NextResponse.json({ ok: deleteSite(u.id, id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
