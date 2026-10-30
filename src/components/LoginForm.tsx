"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "./ui";

export function LoginForm({ mode: initial = "in" }: { mode?: "in" | "up" }) {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [mode, setMode] = useState<"in" | "up">(params.get("signup") ? "up" : initial);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const LINK_ERR: Record<string, string> = { link: "That link is invalid or has expired — log in or ask for a new one.", rate: "Too many attempts — wait a few minutes." };
  const [err, setErr] = useState(LINK_ERR[params.get("e") || ""] || ""); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(""); const [unverified, setUnverified] = useState(false); const [resent, setResent] = useState(false);
  const resend = async () => { await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setResent(true); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch(mode === "in" ? "/api/auth/login" : "/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setUnverified(!!j.unverified); throw new Error(j.error || "Something went wrong"); }
      if (j.verify) { setSent(j.email || email); setBusy(false); return; }
      window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  if (sent) return (
    <div className="grid min-h-[calc(100dvh-64px)] place-items-center px-4 py-10">
      <div className="panel w-full max-w-sm space-y-4 p-6 text-center sm:p-8">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-ink-400">We sent a confirmation link to <b className="text-ink-200">{sent}</b>. Open it to finish creating your account. It expires in 24 hours.</p>
        <button className="btn-outline h-10 w-full" disabled={resent} onClick={resend}>{resent ? "Sent again" : "Resend the email"}</button>
        <Link href="/login" className="block text-sm text-brand-300 underline">Back to log in</Link>
      </div>
    </div>
  );
  return (
    <div className="grid min-h-[calc(100dvh-64px)] place-items-center px-4 py-10">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6 sm:p-8">
        <div><h1 className="text-xl font-semibold">{mode === "in" ? "Log in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-ink-400">{mode === "in" ? "Your projects, renders and background jobs are private to your account." : "Free during the beta — your projects stay private to you."}</p></div>
        {mode === "up" && <div><span className="label">Name</span><input className="input h-11" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <div><span className="label">Email</span><input className="input h-11" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><span className="label">Password</span><input className="input h-11" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={mode === "up" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {mode === "in" && <div className="-mt-2 text-right"><Link href="/forgot" className="text-xs text-ink-400 underline hover:text-ink-200">Forgot password?</Link></div>}
        {err && <p className="text-sm text-red-300">{err}{unverified && <> <button type="button" className="underline" onClick={resend} disabled={resent}>{resent ? "Link sent." : "Resend link"}</button></>}</p>}
        <button className="btn-brand h-11 w-full" disabled={busy}>{busy ? <Spinner /> : mode === "in" ? "Log in" : "Create account"}</button>
        <p className="text-center text-sm text-ink-400">{mode === "in" ? <>New here? <Link href={`/signup${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-brand-300 underline" onClick={(e) => { e.preventDefault(); history.replaceState(null, "", `/signup${location.search}`); setMode("up"); setErr(""); }}>Create an account</Link></> : <>Have an account? <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-brand-300 underline" onClick={(e) => { e.preventDefault(); history.replaceState(null, "", `/login${location.search}`); setMode("in"); setErr(""); }}>Log in</Link></>}</p>
      </form>
    </div>
  );
}
