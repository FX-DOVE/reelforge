import { desk, deskContext, deskContextIfUp } from "@/lib/desk";
import { allSessions } from "@/lib/research";
import { currentUser } from "@/lib/auth";
import { claimDesk, deskBusyFor, deskOwner, deskWorkspace, setActiveWorkspace, touchDesk, wsKey } from "@/lib/deskLease";
import { chats } from "@/lib/chats";
export const dynamic = "force-dynamic";

const pass = async (r: Response) =>
  new Response(r.status === 204 ? null : await r.arrayBuffer(), {
    status: r.status,
    headers: { "Content-Type": r.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" },
  });
const down = () => Response.json({ state: "unavailable", error: "The desktop service isn’t running." }, { status: 503 });

const busy = (m: { error: string; minutes: number }) => Response.json({ state: "busy", error: m.error, minutes: m.minutes }, { status: 409 });
/** Every desktop op is for the signed-in account's OWN leased desktop (see lib/deskLease). */
async function gate(claim: boolean, force = false) {
  const u = await currentUser();
  if (!u) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!claim) {
    if (deskWorkspace() === wsKey(u.id)) {
      touchDesk(u.id);
      return u;
    }
    if (deskOwner() === u.id) return { asleep: true } as const; // one of my other agents' workspace: wake switches
    const m = await deskBusyFor(u.id);
    if (m !== null) return busy({ error: `Reel’s computer is being used by another creator right now. It frees up in about ${m} min.`, minutes: m });
    return { asleep: true } as const;
  }
  try {
    const c = await claimDesk(u.id, force && u.role === "admin");
    return c.ok ? u : busy(c);
  } catch (e) {
    return Response.json({ state: "error", error: "Couldn’t switch the desktop to your account: " + (e as Error).message }, { status: 503 });
  }
}
export async function GET(req: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  const gt = await gate(op !== "status");
  if (gt instanceof Response) return op === "status" && gt.status === 409 ? Response.json(await gt.json()) : gt;
  if ("asleep" in gt) return Response.json({ state: "asleep", control: false }); // free: wake claims it for you
  if (op === "editable") {
    const u = new URL(req.url);
    const x = u.searchParams.get("x"),
      y = u.searchParams.get("y");
    return Response.json({ text: x !== null && y !== null ? await editableAt(Number(x), Number(y)) : await chromeEditable() });
  }
  if (!["status", "frame"].includes(op)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return await pass(await desk("/" + op, undefined, 5000));
  } catch {
    return down();
  }
}
export async function POST(req: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  if (op === "workspace") {
    const u = await currentUser();
    if (!u) return Response.json({ error: "Please sign in." }, { status: 401 });
    const { ws } = await req.json().catch(() => ({}));
    const w = String(ws || "main");
    if (w !== "main" && !chats.get(w, u.id)) return Response.json({ error: "not found" }, { status: 404 });
    setActiveWorkspace(u.id, w);
    return Response.json({ ok: true, ws: w });
  }
  if (!["wake", "sleep", "control", "input", "browser"].includes(op)) return Response.json({ error: "not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (op === "sleep" && deskWorkspace() !== wsKey((await currentUser())?.id || "-")) return Response.json({ state: "asleep" });
  const gt = await gate(true, !!b.force);
  if (gt instanceof Response) return gt;
  if (op === "control")
    for (const s of allSessions()) if (s.ownerId === (gt as { id: string }).id && (s.status === "running" || s.status === "paused")) s.control = !!b.on; // pause/resume the agent
  try {
    const r = await desk("/" + op, b, 20000);
    if (op === "input" && r.ok && (b.t === "click" || b.t === "up")) {
      const j = await r.json();
      if (/chrom/i.test(j.cls || "")) j.text = Number(b.y) < 0.13 || (await chromeEditable());
      return Response.json(j);
    }
    return await pass(r);
  } catch {
    return down();
  }
}
/** Is a text field focused in the desktop Chromium? (decides whether the phone keyboard stays up) */
async function chromeEditable() {
  try {
    const ctx = await deskContext();
    if (!ctx) return false;
    for (const p of ctx.pages()) {
      const yes = await p
        .evaluate(() => {
          const e = document.activeElement as HTMLElement | null;
          return document.visibilityState === "visible" && !!e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName));
        })
        .catch(() => false);
      if (yes) return true;
    }
  } catch {
    /* */
  }
  return false;
}

/** Is there a text field under this screen point (0..1) in the desktop Chromium? Lets the phone raise its keyboard inside the same tap. */
async function editableAt(nx: number, ny: number) {
  if (!isFinite(nx) || !isFinite(ny)) return false;
  try {
    const ctx = await deskContextIfUp();
    if (!ctx) return false;
    const res = await Promise.all(
      ctx.pages().map((p) =>
        p
          .evaluate(
            ([nx, ny]) => {
              if (document.visibilityState !== "visible") return null;
              const sx = nx * screen.width,
                sy = ny * screen.height;
              // viewport origin on screen: window position + browser chrome (tabs/address bar) above the page
              const vx = sx - window.screenX - (window.outerWidth - window.innerWidth) / 2,
                vy = sy - window.screenY - (window.outerHeight - window.innerHeight);
              if (vy < 0) return "chrome"; // tapped the tab strip / address bar
              let el = document.elementFromPoint(vx, vy) as HTMLElement | null;
              while (el && el.shadowRoot) {
                const inner = el.shadowRoot.elementFromPoint(vx, vy) as HTMLElement | null;
                if (!inner || inner === el) break;
                el = inner;
              }
              if (!el) return false;
              if (el.tagName === "IFRAME") return "frame";
              const f = el.closest(
                "input,textarea,select,[contenteditable=''],[contenteditable=true],[role=textbox],[role=searchbox],[role=combobox]",
              ) as HTMLElement | null;
              if (!f) return el.isContentEditable;
              if (f.tagName === "INPUT")
                return (
                  !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test((f as HTMLInputElement).type) &&
                  !(f as HTMLInputElement).disabled
                );
              return f.tagName !== "SELECT";
            },
            [nx, ny] as [number, number],
          )
          .catch(() => null),
      ),
    );
    const hit = res.find((r) => r !== null);
    return hit === "chrome" ? ny < 0.13 : hit === "frame" ? false : !!hit;
  } catch {
    return false;
  }
}
