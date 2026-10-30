import { adminGate } from "@/lib/auth";
import { storageMode, testR2 } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET() { { const g = await adminGate(); if (g) return g; } return Response.json({ mode: storageMode() }); }
export async function POST() { { const g = await adminGate(); if (g) return g; } return Response.json({ ...(await testR2()), mode: storageMode() }); }
