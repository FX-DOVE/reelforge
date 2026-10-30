import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { ADMIN_ID, currentUser } from "@/lib/auth";
import { DATA_DIR, db } from "@/lib/db";
export const dynamic = "force-dynamic";
const DIR = path.join(DATA_DIR, "avatars");
const file = (uid: string) => path.join(DIR, uid.replace(/[^\w-]/g, "") + ".img");
const SIG: [string, number[]][] = [["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/jpeg", [0xff, 0xd8, 0xff]], ["image/webp", [0x52, 0x49, 0x46, 0x46]]];
const typeOf = (b: Buffer) => SIG.find(([, s]) => s.every((x, i) => b[i] === x))?.[0];
/** Your own avatar only (no user id in the URL, so nobody can fetch someone else's). */
export async function GET() {
  const s = await currentUser(); if (!s) return new Response("unauthorized", { status: 401 });
  const f = file(s.id); if (!fs.existsSync(f)) return new Response("not found", { status: 404 });
  const b = fs.readFileSync(f); return new Response(new Uint8Array(b), { headers: { "Content-Type": typeOf(b) || "application/octet-stream", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
export async function POST(req: Request) {
  const s = await currentUser(); if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (s.id === ADMIN_ID) return NextResponse.json({ error: "Not available for the admin account." }, { status: 400 });
  const fd = await req.formData().catch(() => null); const f = fd?.get("file");
  if (!(f instanceof Blob)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (f.size > 2_000_000) return NextResponse.json({ error: "Use an image under 2 MB." }, { status: 400 });
  const b = Buffer.from(await f.arrayBuffer()); if (!typeOf(b)) return NextResponse.json({ error: "Use a PNG, JPG or WebP image." }, { status: 400 });
  fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(s.id), b);
  const u = db.getUser(s.id)!; u.avatar = String(Date.now()); await db.saveUser(u);
  return NextResponse.json({ ok: true, avatar: `/api/me/avatar?v=${u.avatar}` });
}
export async function DELETE() {
  const s = await currentUser(); if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  fs.rmSync(file(s.id), { force: true }); const u = db.getUser(s.id); if (u) { u.avatar = undefined; await db.saveUser(u); }
  return NextResponse.json({ ok: true });
}
