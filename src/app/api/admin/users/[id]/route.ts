import { adminGate, currentUser } from "@/lib/auth";
import { purgeUser } from "@/lib/purgeUser";
export const dynamic = "force-dynamic";
/** Admin: delete an account and everything it owns. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(); if (g) return g;
  const { id } = await ctx.params; const me = await currentUser();
  if (me?.id === id) return Response.json({ error: "You can’t delete your own admin account here." }, { status: 400 });
  const r = await purgeUser(id);
  return r ? Response.json({ ok: true, ...r }) : Response.json({ error: "not found" }, { status: 404 });
}
