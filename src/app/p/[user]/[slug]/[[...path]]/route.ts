import { publishedFile } from "@/lib/sites";
import { serveFile } from "@/lib/siteServe";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ user: string; slug: string; path?: string[] }> }) {
  const { user, slug, path } = await params;
  return serveFile(publishedFile(user, slug, (path || []).join("/")), req);
}
