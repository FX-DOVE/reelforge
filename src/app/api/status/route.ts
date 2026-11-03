import { NextResponse } from "next/server";
import { liveStatus } from "@/lib/config";
import { VOICES } from "@/lib/voiceCatalog";
export const dynamic = "force-dynamic";
/** Public: which engines are live — never key material, never a third-party voice name while Meta-only is on. */
export async function GET() {
  const live = liveStatus();
  return NextResponse.json(
    { ...live, voices: VOICES.map(({ id, label }) => ({ id, label })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
