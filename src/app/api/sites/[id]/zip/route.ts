import { requireUser } from "@/lib/guard";
import { getSite, zipSite } from "@/lib/sites";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(); if (u instanceof Response) return u;
  const s = getSite((await params).id); if (!s || s.ownerId !== u.id) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(zipSite(s)), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${s.slug}.zip"` } });
}
