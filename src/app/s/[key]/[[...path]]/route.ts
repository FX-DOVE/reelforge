import { siteByKey, siteFile } from "@/lib/sites";
import { serveFile } from "@/lib/siteServe";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ key: string; path?: string[] }> }) {
  const { key, path } = await params; const s = siteByKey(key);
  return serveFile(s ? siteFile(s, (path || []).join("/")) : null, req);
}
