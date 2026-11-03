import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { limited, hit } from "@/lib/ratelimit";
import { transcribe } from "@/lib/dialogue";
import { probeDuration } from "@/lib/ffmpeg";
import { punctuate } from "@/lib/punctuate";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BYTES = 6_000_000,
  MAX_SECONDS = 61;
let busy = 0; // the voice box is tiny — at most 2 clips at once

/** Voice input → text with Meta wav2vec2 (self-hosted). Signed-in users only, rate limited, ≤60 s per clip. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const k = `asr:${u.id}`;
  if (limited(k, 30, 10 * 60_000)) return NextResponse.json({ error: "Too many voice clips. Try again in a few minutes." }, { status: 429 });
  hit(k);
  if (busy >= 2) return NextResponse.json({ error: "Voice input is busy. Try again in a moment." }, { status: 503 });
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("audio");
  if (!(f instanceof Blob) || f.size < 500) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (f.size > MAX_BYTES) return NextResponse.json({ error: "Clip too long (max 60 seconds)." }, { status: 413 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asr-"));
  const file = path.join(dir, "in.bin");
  busy++;
  const t0 = Date.now();
  try {
    fs.writeFileSync(file, Buffer.from(await f.arrayBuffer()));
    const dur = await probeDuration(file).catch(() => 0);
    if (dur > MAX_SECONDS) return NextResponse.json({ error: "Clip too long (max 60 seconds)." }, { status: 413 });
    const raw = await transcribe(file);
    return NextResponse.json({ text: punctuate(raw), raw, seconds: +dur.toFixed(1), ms: Date.now() - t0, model: "Meta wav2vec2-base-960h" });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't transcribe that clip. Please try again.", detail: String((e as Error).message).slice(0, 120) },
      { status: 500 },
    );
  } finally {
    busy--;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
