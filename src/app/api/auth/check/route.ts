// Used by the reverse proxy (forward_auth) to gate the live desktop WebSocket: only the account the desktop is
// currently leased to (lib/deskLease) may watch or drive it.
import { currentUser } from "@/lib/auth";
import { claimDesk } from "@/lib/deskLease";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = await currentUser(); if (!u) return new Response("unauthorized", { status: 401 });
  const uri = req.headers.get("x-forwarded-uri") || "";
  if (uri.startsWith("/desk/")) { const c = await claimDesk(u.id).catch(() => ({ ok: false as const })); if (!c.ok) return new Response("desktop in use by another account", { status: 403 }); }
  return new Response("ok");
}
