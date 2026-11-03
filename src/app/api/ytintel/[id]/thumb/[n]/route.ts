import fs from "node:fs";
import { requireUser } from "@/lib/guard";
import { thumbPath } from "@/lib/ytintel";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const { id, n } = await params;
  const f = thumbPath(u.id, id, Number(n) || 1);
  if (!fs.existsSync(f)) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
}
