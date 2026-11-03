import { consumeToken, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { gate, mailTo } from "@/lib/accounts";
export const dynamic = "force-dynamic";
/** Email link target: confirm the address (single use), sign in, send the welcome email, open the dashboard. */
export async function GET(req: Request) {
  const go = (p: string) => Response.redirect(appUrl() + p, 303);
  if (gate(req, "verify", 20, 15 * 60_000)) return go("/login?e=rate");
  const uid = await consumeToken(new URL(req.url).searchParams.get("token") || "", "verify");
  const u = uid && db.getUser(uid);
  if (!u) return go("/login?e=link");
  const first = u.verified === false;
  u.verified = true;
  await db.saveUser(u);
  await createSession({ id: u.id, email: u.email, role: u.role === "admin" ? "admin" : "user", name: u.name });
  if (first) mailTo(u.id, "welcome");
  return go("/dashboard?welcome=1");
}
