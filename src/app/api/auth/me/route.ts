import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ user: null });
  const r = db.getUser(u.id);
  return NextResponse.json(
    {
      user: {
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.name || r?.name,
        avatar: r?.avatar ? `/api/me/avatar?v=${r.avatar}` : null,
        createdAt: r?.createdAt,
        needsTerms: r ? r.termsVersion !== TERMS_VERSION : false,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
