"use client";
import { useEffect, useState } from "react";
/** True while one of my agents is using its computer (research on the desktop browser). Drives the "working — tap to watch" dot; never opens the panel. */
export function useDeskWorking(active = true) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/research", { cache: "no-store" });
        if (r.ok && alive) setOn(((await r.json()) as { status: string }[]).some((s) => s.status === "running" || s.status === "paused"));
      } catch {
        /* */
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    const f = () => setTimeout(tick, 600);
    window.addEventListener("rf:desk-working", f);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("rf:desk-working", f);
    };
  }, [active]);
  return on;
}
