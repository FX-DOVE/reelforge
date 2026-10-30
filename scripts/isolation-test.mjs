// Two-account isolation test. Usage: BASE=https://host node scripts/isolation-test.mjs   (cleans up its accounts)
const BASE = process.env.BASE || "http://localhost:3999";
const stamp = Date.now(), results = []; let fails = 0;
const ok = (name, pass, info = "") => { results.push(`${pass ? "PASS" : "FAIL"}  ${name}${info ? "  (" + info + ")" : ""}`); if (!pass) fails++; };
function client() {
  let cookie = "";
  return async (path, opt = {}) => {
    const r = await fetch(BASE + path, { redirect: "manual", ...opt, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opt.headers || {}) } });
    const sc = r.headers.get("set-cookie"); if (sc) { const m = sc.match(/rf_session=([^;]*)/); if (m) cookie = m[1] ? `rf_session=${m[1]}` : ""; }
    let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t.slice(0, 120); }
    return { s: r.status, j };
  };
}
const A = client(), B = client(), pw = "Iso-test-" + stamp;
const ea = `iso-a+${stamp}@example.com`, eb = `iso-b+${stamp}@example.com`;
const su = async (c, e, n) => (await c("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: e, password: pw, name: n, agree: true }) }));
const ra = await su(A, ea, "Iso A"), rb = await su(B, eb, "Iso B");
ok("sign up A and B", ra.s === 200 && rb.s === 200, `${ra.s}/${rb.s}${ra.j?.verify ? " verify-required" : ""}`);
if (ra.j?.verify) { console.log("Email verification is on — run against a server without email, or verify manually."); process.exit(2); }
const pa = await A("/api/projects", { method: "POST", body: JSON.stringify({ title: "A secret film", mode: "drama" }) });
const pid = pa.j?.id; ok("A creates a project", !!pid, String(pa.s));
const ag = await A("/api/chats", { method: "POST", body: JSON.stringify({ title: "A agent" }) });
const cid = ag.j?.id || ag.j?.chat?.id; ok("A creates an agent/chat", !!cid, String(ag.s));
await A("/api/me/memory", { method: "POST", body: JSON.stringify({ text: "A likes slow-burn thrillers", category: "genre" }) });

const lb = await B("/api/projects"); ok("B's project list excludes A's", Array.isArray(lb.j) && !lb.j.some((p) => p.id === pid), `${lb.j?.length} items`);
for (const [n, p, m] of [["read A's project", `/api/projects/${pid}`, "GET"], ["edit A's project", `/api/projects/${pid}`, "PATCH"], ["delete A's project", `/api/projects/${pid}`, "DELETE"], ["A's project jobs", `/api/projects/${pid}/jobs`, "GET"], ["A's media file", `/api/files/${pid}/cover.png`, "GET"], ["A's chat", `/api/chats/${cid}`, "GET"], ["delete A's chat", `/api/chats/${cid}`, "DELETE"]]) {
  const r = await B(p, { method: m, ...(m === "PATCH" ? { body: JSON.stringify({ title: "pwned" }) } : {}) });
  ok(`B cannot ${n}`, [403, 404].includes(r.s), String(r.s));
}
const lc = await B("/api/chats"); const lcl = Array.isArray(lc.j) ? lc.j : [...(lc.j?.chats || []), ...(lc.j?.agents || [])];
ok("B's chats/agents exclude A's", !lcl.some((c) => c.id === cid), `${lcl.length} items`);
const mb = await B("/api/me/memory"); ok("B's notes exclude A's", !(mb.j?.notes || []).some((n) => /slow-burn/.test(n.text)), `${(mb.j?.notes || []).length} notes`);
const still = await A(`/api/projects/${pid}`); ok("A's project untouched", still.s === 200 && still.j?.title !== "pwned", String(still.s));
// desktop: A takes it, B must be refused (cannot view frames or send input)
const wa = await A("/api/desk/wake", { method: "POST", body: "{}" }); ok("A claims the desktop", wa.s !== 409 && wa.s !== 401, String(wa.s));
const fb = await B("/api/desk/frame"); ok("B cannot view A's desktop frame", fb.s === 409 || fb.s === 403, String(fb.s));
const ib = await B("/api/desk/input", { method: "POST", body: JSON.stringify({ t: "click", x: 0.5, y: 0.5 }) }); ok("B cannot control A's desktop", ib.s === 409 || ib.s === 403, String(ib.s));
const sb = await B("/api/desk/status"); ok("B sees desktop as busy", sb.j?.state === "busy", sb.j?.state);
const wsb = await B("/api/auth/check", { headers: { "x-forwarded-uri": "/desk/ws" } }); ok("B cannot open A's desktop stream", wsb.s === 403, String(wsb.s));
const wsa = await A("/api/auth/check", { headers: { "x-forwarded-uri": "/desk/ws" } }); ok("A can open own desktop stream", wsa.s === 200, String(wsa.s));
// anonymous
const anon = client(); const an = await anon(`/api/projects/${pid}`); ok("signed-out user cannot read project", an.s === 401, String(an.s));
// session revocation after password change
const B2 = client(); await B2("/api/auth/login", { method: "POST", body: JSON.stringify({ email: eb, password: pw }) });
const pc = await B("/api/me/password", { method: "POST", body: JSON.stringify({ current: pw, password: pw + "x" }) }); ok("B changes password", pc.s === 200, String(pc.s));
const old = await B2("/api/projects"); ok("B's other session revoked", old.s === 401, String(old.s));
const cur = await B("/api/projects"); ok("B's current session kept", cur.s === 200, String(cur.s));
// cleanup: delete both accounts
const da = await A("/api/me/account", { method: "DELETE", body: JSON.stringify({ password: pw }) });
const db_ = await B("/api/me/account", { method: "DELETE", body: JSON.stringify({ password: pw + "x" }) });
ok("delete test accounts", da.s === 200 && db_.s === 200, `${da.s}/${db_.s}`);
const gone = await anon("/api/auth/login", { method: "POST", body: JSON.stringify({ email: ea, password: pw }) }); ok("deleted account can't log in", gone.s === 401, String(gone.s));
console.log(results.join("\n")); console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
