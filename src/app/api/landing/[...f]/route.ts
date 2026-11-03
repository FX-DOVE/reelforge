import { r2Conf, presign } from "@/lib/storage";

/** Public, long-lived landing media. Streams objects under the R2 "landing/" prefix (range-aware) so the
 *  marketing page never depends on presigned links that expire. Only whitelisted file names are served. */
export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", webp: "image/webp", png: "image/png" };

export async function GET(req: Request, { params }: { params: Promise<{ f: string[] }> }) {
  const name = (await params).f.join("/");
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (!/^[\w-]+\.(mp4|jpg|webp|png)$/.test(name) || !TYPES[ext]) return new Response("not found", { status: 404 });
  const c = r2Conf();
  if (!c) return new Response("not found", { status: 404 });
  const range = req.headers.get("range");
  const r = await fetch(presign({ ...c, publicBase: undefined }, "landing/" + name, 600), {
    headers: { "accept-encoding": "identity", ...(range ? { range } : {}) },
  });
  if (!(r.ok || r.status === 206 || r.status === 416)) return new Response("not found", { status: 404 });
  const h: Record<string, string> = {
    "Content-Type": TYPES[ext],
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  for (const k of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = r.headers.get(k);
    if (v) h[k] = v;
  }
  return new Response(r.body, { status: r.status, headers: h });
}
