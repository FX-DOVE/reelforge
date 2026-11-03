"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "./ui";

const post = (u: string, b: unknown) =>
  fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({
    ok: r.ok,
    j: await r.json().catch(() => ({})),
  }));
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="grid min-h-[calc(100dvh-64px)] place-items-center px-4 py-10">
    <div className="panel w-full max-w-sm space-y-4 p-6 sm:p-8">{children}</div>
  </div>
);

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  if (done)
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-ink-400">
          If an account exists for <b className="text-ink-200">{email}</b>, we sent a link to reset your password. It works once and expires in 1 hour.
        </p>
        <Link href="/login" className="block text-sm text-brand-300 underline">
          Back to log in
        </Link>
      </Shell>
    );
  return (
    <Shell>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          const r = await post("/api/auth/forgot", { email });
          setBusy(false);
          if (r.ok) setDone(true);
          else setErr(r.j.error || "Something went wrong");
        }}
      >
        <div>
          <h1 className="text-xl font-semibold">Forgot your password?</h1>
          <p className="mt-1 text-sm text-ink-400">Enter your account email and we’ll send you a reset link.</p>
        </div>
        <div>
          <span className="label">Email</span>
          <input
            className="input h-11"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {err && <p className="text-sm text-red-300">{err}</p>}
        <button className="btn-brand h-11 w-full" disabled={busy}>
          {busy ? <Spinner /> : "Send reset link"}
        </button>
        <Link href="/login" className="block text-center text-sm text-ink-400 underline">
          Back to log in
        </Link>
      </form>
    </Shell>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/auth/reset?token=" + encodeURIComponent(token))
      .then((r) => r.json())
      .then((j) => setValid(!!j.valid))
      .catch(() => setValid(false));
  }, [token]);
  if (valid === null)
    return (
      <Shell>
        <Spinner />
      </Shell>
    );
  if (!valid)
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Link expired</h1>
        <p className="text-sm text-ink-400">This reset link is invalid, already used or expired.</p>
        <Link href="/forgot" className="btn-brand flex h-11 w-full items-center justify-center">
          Get a new link
        </Link>
      </Shell>
    );
  return (
    <Shell>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== pw2) return setErr("The passwords don’t match.");
          setBusy(true);
          setErr("");
          const r = await post("/api/auth/reset", { token, password: pw });
          if (r.ok) window.location.href = "/dashboard";
          else {
            setBusy(false);
            setErr(r.j.error || "Something went wrong");
          }
        }}
      >
        <div>
          <h1 className="text-xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-400">At least 8 characters. Other devices will be signed out.</p>
        </div>
        <div>
          <span className="label">New password</span>
          <input className="input h-11" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <div>
          <span className="label">Repeat it</span>
          <input
            className="input h-11"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
          />
        </div>
        {err && <p className="text-sm text-red-300">{err}</p>}
        <button className="btn-brand h-11 w-full" disabled={busy}>
          {busy ? <Spinner /> : "Save and log in"}
        </button>
      </form>
    </Shell>
  );
}
