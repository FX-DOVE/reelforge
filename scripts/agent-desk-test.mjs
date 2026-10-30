// Per-agent desktop test: two agents in one account each get their own files + browser profile; another account stays blocked.
// Usage: BASE=https://host SSH="ssh -i key root@host" node scripts/agent-desk-test.mjs   (cleans up its accounts)
import { execSync } from "node:child_process";
const BASE = process.env.BASE, SSH = process.env.SSH, H = "/home/reel/home";
const sh = (c) => { try { return execSync(`${SSH} ${JSON.stringify(`docker exec reelforge-desk-1 sh -c ${JSON.stringify(c)}`)}`, { encoding: "utf8" }).trim(); } catch { return "ERR"; } };
const results = []; let fails = 0; const ok = (n, p, i = "") => { results.push(`${p ? "PASS" : "FAIL"}  ${n}${i ? "  (" + i + ")" : ""}`); if (!p) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client() { let cookie = ""; return async (path, opt = {}) => { const r = await fetch(BASE + path, { redirect: "manual", ...opt, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opt.headers || {}) } }); const sc = r.headers.get("set-cookie"); if (sc) { const m = sc.match(/rf_session=([^;]*)/); if (m) cookie = `rf_session=${m[1]}`; } const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 100); } return { s: r.status, j, cookie }; }; }
const st = Date.now(), pw = "Desk-test-" + st, A = client(), B = client();
const ea = `desk-a+${st}@example.com`, eb = `desk-b+${st}@example.com`;
const sa = await A("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: ea, password: pw, name: "Desk A", agree: true }) });
const sb = await B("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: eb, password: pw, name: "Desk B", agree: true }) });
ok("sign up A and B", sa.s === 200 && sb.s === 200, `${sa.s}/${sb.s}`);
const c1 = (await A("/api/chats", { method: "POST", body: JSON.stringify({ title: "Agent One" }) })).j; const c2 = (await A("/api/chats", { method: "POST", body: JSON.stringify({ title: "Agent Two" }) })).j;
const id1 = c1?.id || c1?.chat?.id, id2 = c2?.id || c2?.chat?.id; ok("A creates two agents", !!id1 && !!id2);
const use = async (ws) => { const r = await A("/api/desk/workspace", { method: "POST", body: JSON.stringify({ ws }) }); const w = await A("/api/desk/wake", { method: "POST", body: "{}" }); await sleep(2500); return [r.s, w.s]; };
ok("B can't select A's agent workspace", (await B("/api/desk/workspace", { method: "POST", body: JSON.stringify({ ws: id1 }) })).s === 404);
let r = await use(id1); ok("Agent One wakes its computer", r[0] === 200 && r[1] === 200, r.join("/"));
await A("/api/desk/browser", { method: "POST", body: "{}" }); await sleep(6000);
sh(`echo one > ${H}/Documents/agent-one.txt`);
const prof1 = sh(`ls ${H}/.config 2>/dev/null | tr '\\n' ' '`);
ok("Agent One has a browser profile", /chrom/i.test(prof1), prof1);
sh(`mkdir -p ${H}/.config/chromium; echo one > ${H}/.config/chromium/rf-agent-marker`);
r = await use(id2); ok("switch to Agent Two", r[0] === 200 && r[1] === 200, r.join("/"));
ok("Agent Two doesn't see Agent One's file", sh(`ls ${H}/Documents`) === "", sh(`ls ${H}/Documents`));
ok("Agent Two has its own (fresh) browser profile", sh(`cat ${H}/.config/chromium/rf-agent-marker 2>/dev/null || echo none`) === "none");
sh(`echo two > ${H}/Documents/agent-two.txt`);
const sB = await B("/api/desk/status"); ok("other account sees the computer as busy", sB.j?.state === "busy", sB.j?.state);
const fB = await B("/api/desk/frame"); ok("other account can't view frames", [403, 409].includes(fB.s), String(fB.s));
const cB = await B("/api/auth/check", { headers: { "x-forwarded-uri": "/desk/ws" } }); ok("other account can't open the stream", cB.s === 403, String(cB.s));
r = await use(id1); ok("back to Agent One", r[1] === 200, r.join("/"));
ok("Agent One's file is back, Agent Two's isn't", sh(`ls ${H}/Documents | tr '\\n' ' '`).trim() === "agent-one.txt", sh(`ls ${H}/Documents | tr '\\n' ' '`));
ok("Agent One's browser profile is back", sh(`cat ${H}/.config/chromium/rf-agent-marker`) === "one");
const stA = await A("/api/desk/status"); ok("A sees own computer awake", stA.j?.state === "awake", stA.j?.state);
await A("/api/desk/workspace", { method: "POST", body: JSON.stringify({ ws: id2 }) });
ok("status for the other agent shows asleep (wake switches)", (await A("/api/desk/status")).j?.state === "asleep");
if (process.env.KEEP) { console.log("KEEP", JSON.stringify({ ea, pw, id1, id2, cookie: (await A("/api/me/profile")).cookie })); console.log(results.join("\n")); process.exit(0); }
const d1 = await A(`/api/chats/${id2}`, { method: "DELETE" }); await sleep(500);
const left = execSync(`${SSH} 'ls /opt/reelforge/data/desk-profiles 2>/dev/null; docker exec reelforge-app-1 sh -c "ls \\$DATA_DIR/desk-profiles 2>/dev/null || ls /data/desk-profiles"'`, { encoding: "utf8" });
ok("deleting Agent Two wipes its saved desktop", d1.s === 200 && !left.includes(id2.replace(/[^\w-]/g, "")), d1.s + "");
const da = await A("/api/me/account", { method: "DELETE", body: JSON.stringify({ password: pw }) }); const db = await B("/api/me/account", { method: "DELETE", body: JSON.stringify({ password: pw }) });
ok("delete test accounts", da.s === 200 && db.s === 200, `${da.s}/${db.s}`);
console.log(results.join("\n")); console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
