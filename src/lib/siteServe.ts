import fs from "node:fs";
import path from "node:path";
const T: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
/** Serve a static site file; sandbox-ish headers keep generated pages from touching the app's cookies/APIs. */
export function serveFile(abs: string | null, req: Request) {
  const u = new URL(req.url);
  if (!abs) return new Response("Not found", { status: 404 });
  if (!u.pathname.endsWith("/") && !path.extname(u.pathname)) return new Response(null, { status: 308, headers: { Location: u.pathname + "/" + u.search } }); // relative: the server sees its internal host
  return new Response(fs.readFileSync(abs), {
    headers: {
      "Content-Type": T[path.extname(abs)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups; default-src * data: blob: 'unsafe-inline'",
    },
  });
}
