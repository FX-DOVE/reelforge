"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatar?: string | null;
  createdAt?: string;
  needsTerms?: boolean;
};

const Ctx = createContext<SessionUser | null>(null);

/** Server-rendered session, refreshed from /api/auth/me. A failed or cached empty response does not wipe a known user. */
export function SessionProvider({ initial, children }: { initial: SessionUser | null; children: React.ReactNode }) {
  const [me, setMe] = useState<SessionUser | null>(initial);
  useEffect(() => {
    let on = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => {
        if (!on) return;
        if (r.status === 401) {
          setMe(null);
          return;
        }
        const j = await r.json().catch(() => null);
        if (j?.user?.email) setMe(j.user);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
