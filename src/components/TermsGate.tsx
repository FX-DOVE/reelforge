"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
/** Existing users: asked once to accept the current Terms & Privacy version after signing in. */
export function TermsGate() {
  const path = usePathname(); const [show, setShow] = useState(false); const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (["/terms", "/privacy", "/login", "/signup"].includes(path)) return; fetch("/api/auth/me").then((r) => r.json()).then((j) => setShow(!!j.user?.needsTerms)).catch(() => {}); }, [path]);
  if (!show || path === "/terms" || path === "/privacy") return null;
  const ok = async () => { setBusy(true); setErr(""); const r = await fetch("/api/me/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree }) }); setBusy(false); if (r.ok) setShow(false); else setErr((await r.json().catch(() => ({}))).error || "Something went wrong."); };
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tg-h">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl">
        <h2 id="tg-h" className="text-xl font-semibold">We’ve added Terms & a Privacy Policy</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">Please review them before you continue. They cover AI-generated content, what you own, acceptable use (no deepfakes of real people without consent), model licences and how account deletion wipes your data.</p>
        <label className="mt-5 flex items-start gap-2.5 text-sm text-ink-300"><input data-t="agree-gate" type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank" className="text-brand-300 underline">Terms</Link> and <Link href="/privacy" target="_blank" className="text-brand-300 underline">Privacy Policy</Link>.</span></label>
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
        <button className="btn-brand mt-5 h-11 w-full" disabled={!agree || busy} onClick={ok}>{busy ? "Saving…" : "Continue"}</button>
      </div>
    </div>
  );
}
