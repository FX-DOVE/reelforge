"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Trash2 } from "lucide-react";
import { Spinner } from "./ui";
import { useSession } from "./Session";

type Me = { id: string; email: string; name?: string; role: string; avatar?: string | null; createdAt?: string };
const send = (u: string, method: string, b?: unknown) =>
  fetch(u, { method, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({
    ok: r.ok,
    j: await r.json().catch(() => ({})),
  }));
export const logout = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
};

export function Avatar({ me, size = 40 }: { me: Pick<Me, "email" | "name" | "avatar"> | null; size?: number }) {
  const init = (me?.name || me?.email || "?").trim()[0]?.toUpperCase();
  return me?.avatar ? (
    <img src={me.avatar} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {init}
    </span>
  );
}

export function ProfilePage() {
  const session = useSession();
  const [me, setMe] = useState<Me | null>(session);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [delPw, setDelPw] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = () =>
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.user?.email) return;
        setMe(j.user);
        setName(j.user?.name || "");
      });
  useEffect(() => {
    if (session?.email) {
      setMe(session);
      setName(session.name || "");
    }
    load();
  }, [session]);
  const note = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  if (!me)
    return (
      <div className="p-10">
        <Spinner />
      </div>
    );
  const admin = me.id === "admin";
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <button className="btn-outline h-10" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>

      <section className="panel mt-6 p-5">
        <div className="flex items-center gap-4">
          <button className="group relative" aria-label="Change photo" disabled={admin} onClick={() => file.current?.click()}>
            <Avatar me={me} size={72} />
            {!admin && (
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow">
                <Camera className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              setBusy("avatar");
              const r = await fetch("/api/me/avatar", { method: "POST", body: fd });
              const j = await r.json().catch(() => ({}));
              setBusy("");
              note("avatar", r.ok ? "" : j.error || "Upload failed");
              if (r.ok) load();
              e.target.value = "";
            }}
          />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{me.name || "Your name"}</div>
            <div className="truncate text-sm text-ink-400">{me.email}</div>
            {me.avatar && (
              <button
                className="mt-1 text-xs text-ink-400 underline"
                onClick={async () => {
                  await send("/api/me/avatar", "DELETE");
                  load();
                }}
              >
                Remove photo
              </button>
            )}
            {busy === "avatar" && <Spinner />}
            {msg.avatar && <p className="text-xs text-red-300">{msg.avatar}</p>}
          </div>
        </div>
        {!admin && (
          <form
            className="mt-5 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("name");
              const r = await send("/api/me/profile", "PATCH", { name });
              setBusy("");
              note("name", r.ok ? "Saved." : r.j.error);
              if (r.ok) load();
            }}
          >
            <div className="flex-1">
              <span className="label">Name</span>
              <input className="input h-11" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="btn-brand mt-auto h-11" disabled={busy === "name"}>
              Save
            </button>
          </form>
        )}
        {msg.name && <p className="mt-2 text-xs text-ink-400">{msg.name}</p>}
        <div className="mt-4">
          <span className="label">Email</span>
          <div className="input flex h-11 items-center text-ink-300">{me.email}</div>
        </div>
      </section>

      {!admin && (
        <section className="panel mt-6 p-5">
          <h2 className="font-semibold">Change password</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("pw");
              const r = await send("/api/me/password", "POST", { current: cur, password: pw });
              setBusy("");
              note("pw", r.ok ? "Password changed. Other devices were signed out and we emailed you a confirmation." : r.j.error);
              if (r.ok) {
                setCur("");
                setPw("");
              }
            }}
          >
            <div>
              <span className="label">Current password</span>
              <input className="input h-11" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
            </div>
            <div>
              <span className="label">New password</span>
              <input
                className="input h-11"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
            </div>
            {msg.pw && <p className="text-sm text-ink-300">{msg.pw}</p>}
            <button className="btn-brand h-11" disabled={busy === "pw"}>
              {busy === "pw" ? <Spinner /> : "Update password"}
            </button>
          </form>
        </section>
      )}

      <section className="panel mt-6 p-5">
        <h2 className="font-semibold">Your private workspace</h2>
        <p className="mt-1 text-sm text-ink-400">
          Your projects, agents, chats, learned notes, renders, media and Reel’s computer (desktop, files and browser logins) belong to this account only. Other
          creators can’t see or use them.
        </p>
      </section>

      {!admin && (
        <section className="panel mt-6 border-red-500/20 p-5">
          <h2 className="font-semibold text-red-300">Delete account</h2>
          <p className="mt-1 text-sm text-ink-400">
            Permanently deletes your account and everything in it: projects, films, media, agents, chats, learned notes and your desktop. This can’t be undone.
          </p>
          {!confirmDel ? (
            <button className="btn-outline mt-3 h-10 text-red-300" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" />
              Delete my account
            </button>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy("del");
                const r = await send("/api/me/account", "DELETE", { password: delPw });
                if (r.ok) window.location.href = "/?site";
                else {
                  setBusy("");
                  note("del", r.j.error);
                }
              }}
            >
              <div>
                <span className="label">Enter your password to confirm</span>
                <input
                  className="input h-11"
                  type="password"
                  autoComplete="current-password"
                  value={delPw}
                  onChange={(e) => setDelPw(e.target.value)}
                  required
                />
              </div>
              {msg.del && <p className="text-sm text-red-300">{msg.del}</p>}
              <div className="flex gap-2">
                <button className="btn-brand h-10 bg-red-600" disabled={busy === "del"}>
                  {busy === "del" ? <Spinner /> : "Delete forever"}
                </button>
                <button type="button" className="btn-ghost h-10" onClick={() => setConfirmDel(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
