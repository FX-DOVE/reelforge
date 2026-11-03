import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { listSites, previewUrl } from "@/lib/sites";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = await requireUser();
  if (u instanceof Response) return u;
  const ws = new URL(req.url).searchParams.get("ws") || undefined;
  return NextResponse.json({
    sites: listSites(u.id, ws).map((s) => ({
      id: s.id,
      name: s.name,
      workspace: s.workspace,
      versions: s.versions,
      updatedAt: s.updatedAt,
      preview: previewUrl(s),
      published: s.published ? `/p/${s.published}/` : null,
      prompt: s.prompt.slice(0, 300),
    })),
  });
}
