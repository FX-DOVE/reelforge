import { adminGate } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
/** Admin: list registered accounts (no hashes). */
export async function GET() {
  const g = await adminGate();
  if (g) return g;
  const users = db
    .listUsers()
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      verified: u.verified !== false,
      createdAt: u.createdAt,
      projects: db.listProjects(u.id).length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ users });
}
