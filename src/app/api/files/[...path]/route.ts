import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ensureCached } from "@/lib/storage";

export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
};

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  // media is private: the project's owner (or an admin) only
  const u = await currentUser();
  if (!u) return new Response("unauthorized", { status: 401 });
  const pid = rel.split("/")[0];
  if (u.role !== "admin") {
    const p = db.getProject(pid);
    if (!p || p.ownerId !== u.id) return new Response("forbidden", { status: 403 });
  }
  const abs = path.resolve(MEDIA_DIR, rel);
  if (abs !== MEDIA_DIR && !abs.startsWith(MEDIA_DIR + path.sep)) return new Response("not found", { status: 404 });
  // Always serve bytes from this origin. Redirecting <img> to a presigned R2 URL expires, gets cached, and paints a blank frame.
  const file = fs.existsSync(abs) && fs.statSync(abs).size > 0 ? abs : await ensureCached(rel);
  if (!file || !fs.existsSync(file)) return new Response("not found", { status: 404 });
  return sendFile(req, file);
}

function sendFile(req: Request, abs: string) {
  const stat = fs.statSync(abs);
  const type = TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream";
  const url = new URL(req.url);
  const dl = url.searchParams.get("download");
  const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
  const base: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (dl) base["Content-Disposition"] = `attachment; filename="${(dl === "1" ? path.basename(abs) : dl).replace(/[^\w.-]+/g, "_")}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: base });
  const body = (start: number, end: number) => {
    const node = fs.createReadStream(abs, { start, end });
    return new ReadableStream({
      start(c) {
        node.on("data", (ch) => c.enqueue(new Uint8Array(ch as Buffer)));
        node.on("end", () => c.close());
        node.on("error", (e) => c.error(e));
      },
      cancel() {
        node.destroy();
      },
    });
  };
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start: number, end: number;
    if (!m[1]) {
      start = Math.max(0, stat.size - parseInt(m[2]));
      end = stat.size - 1;
    } else {
      start = parseInt(m[1]);
      end = m[2] ? Math.min(parseInt(m[2]), stat.size - 1) : stat.size - 1;
    }
    if (start >= stat.size || start > end) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${stat.size}` } });
    return new Response(body(start, end), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(body(0, stat.size - 1), { headers: { ...base, "Content-Length": String(stat.size) } });
}
