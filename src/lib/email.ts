import nodemailer from "nodemailer";
import { getConfig } from "./config";

/** Pluggable transactional email: Resend (HTTPS API) or any SMTP server. Not an AI call.
 *  Configure in Admin → Email (secrets stored encrypted) or env RESEND_API_KEY / SMTP_URL / EMAIL_FROM. */
export type Mail = { to: string; subject: string; html: string; text: string };
export function emailProvider(): "resend" | "smtp" | null {
  const p = (getConfig("EMAIL_PROVIDER") || "auto").toLowerCase();
  if (p === "off") return null;
  if ((p === "resend" || p === "auto") && getConfig("RESEND_API_KEY")) return "resend";
  if ((p === "smtp" || p === "auto") && getConfig("SMTP_URL")) return "smtp";
  return null;
}
export const emailReady = () => !!emailProvider() && !!getConfig("EMAIL_FROM");
export const appUrl = () => (getConfig("APP_URL") || process.env.APP_URL || "https://reelforge.voiceforgeai.site").replace(/\/+$/, "");

export async function sendMail(m: Mail): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const prov = emailProvider(), from = getConfig("EMAIL_FROM");
  if (!prov || !from) { console.log(`[email] not configured — skipped "${m.subject}"`); return { ok: false, skipped: true, error: "Email isn’t set up yet." }; }
  try {
    if (prov === "resend") {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${getConfig("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }), signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.log("[email] resend error", r.status, String(j.message || "").slice(0, 200)); return { ok: false, error: `Resend ${r.status}: ${String(j.message || "").slice(0, 160)}` }; }
      return { ok: true, id: j.id };
    }
    const t = nodemailer.createTransport(getConfig("SMTP_URL")!);
    const info = await t.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    return { ok: true, id: info.messageId };
  } catch (e) { console.log("[email] send failed", (e as Error).message.slice(0, 200)); return { ok: false, error: (e as Error).message.slice(0, 160) }; }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** White, Apple-style branded layout (inline CSS for mail clients). */
function layout(o: { title: string; intro: string; cta?: { label: string; url: string }; after?: string }) {
  const btn = o.cta ? `<tr><td style="padding:8px 0 28px"><a href="${esc(o.cta.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">${esc(o.cta.label)}</a></td></tr>` : "";
  const link = o.cta ? `<tr><td style="font-size:12px;line-height:18px;color:#86868b;padding-bottom:20px">If the button doesn’t work, paste this link into your browser:<br><a href="${esc(o.cta.url)}" style="color:#0066cc;word-break:break-all">${esc(o.cta.url)}</a></td></tr>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:22px;padding:40px 36px">
<tr><td style="font-size:15px;font-weight:700;letter-spacing:-0.2px;padding-bottom:28px">ReelForge <span style="color:#86868b;font-weight:500">Studio</span></td></tr>
<tr><td style="font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.6px;padding-bottom:14px">${esc(o.title)}</td></tr>
<tr><td style="font-size:16px;line-height:25px;color:#424245;padding-bottom:26px">${o.intro}</td></tr>
${btn}${link}
${o.after ? `<tr><td style="font-size:13px;line-height:20px;color:#86868b;border-top:1px solid #e8e8ed;padding-top:18px">${o.after}</td></tr>` : ""}
</table>
<p style="font-size:11px;color:#a1a1a6;margin-top:18px">ReelForge Studio · AI film studio · <a href="${appUrl()}" style="color:#a1a1a6">${appUrl().replace(/^https?:\/\//, "")}</a></p>
</td></tr></table></body></html>`;
  const text = `${o.title}\n\n${o.intro.replace(/<[^>]+>/g, "")}\n\n${o.cta ? `${o.cta.label}: ${o.cta.url}\n\n` : ""}${(o.after || "").replace(/<[^>]+>/g, "")}`;
  return { html, text };
}
const hi = (name?: string) => `Hi ${esc(name || "there")},`;
export const tpl = {
  verify: (name: string | undefined, url: string) => ({ subject: "Confirm your email for ReelForge", ...layout({ title: "Confirm your email", intro: `${hi(name)}<br><br>Tap the button below to confirm this address and open your studio.`, cta: { label: "Confirm email", url }, after: "This link works once and expires in 24 hours. If you didn’t sign up, you can ignore this email." }) }),
  welcome: (name: string | undefined) => ({ subject: "Welcome to ReelForge Studio", ...layout({ title: "Welcome to your studio", intro: `${hi(name)}<br><br>Your account is ready. Brainstorm a story with Reel, approve the cast and locations, and render a finished film — all in one place. Your projects, agents, notes and desktop are private to you.`, cta: { label: "Open your dashboard", url: appUrl() + "/dashboard" } }) }),
  reset: (name: string | undefined, url: string) => ({ subject: "Reset your ReelForge password", ...layout({ title: "Reset your password", intro: `${hi(name)}<br><br>Someone asked to reset the password for this account. Tap below to choose a new one.`, cta: { label: "Choose a new password", url }, after: "This link works once and expires in 1 hour. If you didn’t ask for this, ignore this email — your password won’t change." }) }),
  changed: (name: string | undefined) => ({ subject: "Your ReelForge password was changed", ...layout({ title: "Password changed", intro: `${hi(name)}<br><br>The password for your ReelForge account was just changed, and other devices were signed out.`, after: `If this wasn’t you, <a href="${appUrl()}/forgot" style="color:#0066cc">reset your password now</a>.` }) }),
  deleted: (name: string | undefined) => ({ subject: "Your ReelForge account was deleted", ...layout({ title: "Account deleted", intro: `${hi(name)}<br><br>Your ReelForge account and all of its projects, agents, notes and media were deleted. We’re sorry to see you go.` }) }),
};
