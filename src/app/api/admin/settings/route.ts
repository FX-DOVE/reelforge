import { NextResponse } from "next/server";
import { adminGate } from "@/lib/auth";
import { configView, setConfig, FIELDS, liveStatus } from "@/lib/config";
import { VIDEO_PROVIDERS } from "@/lib/providers/video";
export const dynamic = "force-dynamic";
export async function GET() {
  { const g = await adminGate(); if (g) return g; }
  return NextResponse.json({ fields: configView(), status: liveStatus(), videoProviders: VIDEO_PROVIDERS.map((v) => ({ id: v.id, label: v.label })) });
}
export async function PUT(req: Request) {
  { const g = await adminGate(); if (g) return g; }
  const b = (await req.json()) as Record<string, string | null>;
  for (const [k, v] of Object.entries(b)) if (FIELDS.some((f) => f.key === k)) await setConfig(k, v);
  return NextResponse.json({ fields: configView(), status: liveStatus() });
}
