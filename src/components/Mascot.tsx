"use client";
import { useEffect, useRef, useState } from "react";

const POS = "rf-bot-pos2";
const MOVES = ["bot-wave", "bot-jump", "bot-nod"];

/** Reel — a soft, glossy 3D-style robot drawn in SVG. Eyes follow the cursor, it blinks and floats when idle,
 *  waves when the cursor comes near, and (floating) can be dragged anywhere with momentum + soft edge snapping. */
function Bot({ size, look, waving, blink }: { size: number; look: { x: number; y: number }; waving: boolean; blink: boolean }) {
  const ex = look.x * 3.2, ey = look.y * 2.6;
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * 130 / 120} aria-hidden className="block overflow-visible">
      <defs>
        <radialGradient id="rfb-body" cx="38%" cy="28%" r="80%"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#eef1f6" /><stop offset="1" stopColor="#c9d0dc" /></radialGradient>
        <radialGradient id="rfb-visor" cx="40%" cy="30%" r="85%"><stop offset="0" stopColor="#3a4a66" /><stop offset=".6" stopColor="#141b2a" /><stop offset="1" stopColor="#070a12" /></radialGradient>
        <radialGradient id="rfb-eye" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#d8f6ff" /><stop offset=".5" stopColor="#5cc8ff" /><stop offset="1" stopColor="#1d7cf2" /></radialGradient>
        <linearGradient id="rfb-acc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5aa9ff" /><stop offset="1" stopColor="#0a64d8" /></linearGradient>
        <filter id="rfb-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <ellipse cx="60" cy="124" rx="26" ry="4.5" fill="#0b1220" opacity=".16" className="bot-shadow" />
      {/* left arm */}
      <g><ellipse cx="22" cy="86" rx="8" ry="13" fill="url(#rfb-body)" stroke="#b7c0cf" strokeWidth=".6" transform="rotate(14 22 86)" /></g>
      {/* right arm — waves */}
      <g className={waving ? "bot-arm-wave" : ""} style={{ transformOrigin: "92px 78px" }}>
        <ellipse cx="98" cy="86" rx="8" ry="13" fill="url(#rfb-body)" stroke="#b7c0cf" strokeWidth=".6" transform="rotate(-14 98 86)" />
      </g>
      {/* body */}
      <path d="M32 80 Q32 66 46 64 H74 Q88 66 88 80 V100 Q88 116 70 117 H50 Q32 116 32 100 Z" fill="url(#rfb-body)" stroke="#b7c0cf" strokeWidth=".6" />
      <ellipse cx="60" cy="92" rx="9" ry="6" fill="url(#rfb-acc)" opacity=".95" />
      <ellipse cx="57" cy="90" rx="3" ry="1.4" fill="#fff" opacity=".7" />
      {/* antenna */}
      <line x1="60" y1="14" x2="60" y2="6" stroke="#b7c0cf" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="60" cy="5" r="4.2" fill="url(#rfb-acc)" /><circle cx="58.6" cy="3.6" r="1.3" fill="#fff" opacity=".8" />
      {/* ears */}
      <rect x="9" y="34" width="9" height="20" rx="4.5" fill="url(#rfb-acc)" /><rect x="102" y="34" width="9" height="20" rx="4.5" fill="url(#rfb-acc)" />
      {/* head */}
      <rect x="14" y="13" width="92" height="62" rx="30" fill="url(#rfb-body)" stroke="#b7c0cf" strokeWidth=".6" />
      <rect x="24" y="23" width="72" height="42" rx="21" fill="url(#rfb-visor)" />
      <path d="M32 30 Q44 25 60 26" stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <g transform={`translate(${ex} ${ey})`}>
        {[46, 74].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="44" rx="7" ry={blink ? 0.9 : 8} fill="#5cc8ff" opacity=".55" filter="url(#rfb-glow)" style={{ transition: "ry .08s" }} />
            <ellipse cx={x} cy="44" rx="5.6" ry={blink ? 0.8 : 6.8} fill="url(#rfb-eye)" style={{ transition: "ry .08s" }} />
            {!blink && <circle cx={x - 1.8} cy="41.4" r="1.6" fill="#fff" />}
          </g>
        ))}
        <path d="M54 55 Q60 59 66 55" stroke="#5cc8ff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".9" />
      </g>
      <ellipse cx="34" cy="22" rx="10" ry="4" fill="#fff" opacity=".75" transform="rotate(-18 34 22)" />
    </svg>
  );
}

export function Mascot({ size = 64, still, floating, onTap }: { size?: number; still?: boolean; floating?: boolean; onTap?: () => void }) {
  const ref = useRef<HTMLButtonElement | HTMLSpanElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [near, setNear] = useState(false);
  const [move, setMove] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // fractions of viewport (top-left)
  const [dragging, setDragging] = useState(false);
  const [reduced, setReduced] = useState(false);
  const moved = useRef(false);
  const anim = useRef(0);
  const W = size, H = size * 130 / 120;

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"); setReduced(mq.matches);
    if (floating) { try { const p = JSON.parse(localStorage.getItem(POS) || "null"); if (p && typeof p.x === "number") setPos(p); } catch { /* */ } }
    let t: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2600 + Math.random() * 3200); };
    if (!mq.matches) loop();
    const mv = (e: PointerEvent) => {
      const el = ref.current; if (!el) return; const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 220); setLook({ x: (dx / d) * k, y: (dy / d) * k });
      if (e.pointerType === "mouse") setNear(d < Math.max(110, r.width * 1.4));
    };
    addEventListener("pointermove", mv, { passive: true });
    return () => { clearTimeout(t); removeEventListener("pointermove", mv); cancelAnimationFrame(anim.current); };
  }, [floating]);

  const clamp = (x: number, y: number) => ({ x: Math.max(8, Math.min(innerWidth - W - 8, x)), y: Math.max(8, Math.min(innerHeight - H - 8, y)) });
  const save = (x: number, y: number) => { const p = { x: x / innerWidth, y: y / innerHeight }; setPos(p); return p; };

  useEffect(() => { // keep inside viewport on resize
    if (!floating) return; const r = () => setPos((p) => { if (!p) return p; const c = clamp(p.x * innerWidth, p.y * innerHeight); return { x: c.x / innerWidth, y: c.y / innerHeight }; });
    addEventListener("resize", r); return () => removeEventListener("resize", r);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const react = () => {
    if (localStorage.getItem("rf-mute") !== "1") { const a = new Audio("/brand/blip.mp3"); a.volume = 0.45; a.play().catch(() => {}); }
    if (reduced) return; setMove(""); requestAnimationFrame(() => setMove(MOVES[Math.floor(Math.random() * MOVES.length)]));
  };

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!floating) return; cancelAnimationFrame(anim.current);
    const el = e.currentTarget, r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = sx - r.left, oy = sy - r.top;
    moved.current = false; el.setPointerCapture(e.pointerId);
    let last = { x: sx, y: sy, t: performance.now() }, vx = 0, vy = 0, cur = { x: r.left, y: r.top };
    const mv = (m: PointerEvent) => {
      if (!moved.current && Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
      moved.current = true; setDragging(true); setNear(false);
      const now = performance.now(), dt = Math.max(1, now - last.t);
      vx = 0.7 * vx + 0.3 * ((m.clientX - last.x) / dt) * 16; vy = 0.7 * vy + 0.3 * ((m.clientY - last.y) / dt) * 16; last = { x: m.clientX, y: m.clientY, t: now };
      cur = clamp(m.clientX - ox, m.clientY - oy); save(cur.x, cur.y);
    };
    const up = () => {
      el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      setDragging(false); if (!moved.current) return;
      // momentum glide, then soft snap toward the nearest edge if close to it
      let x = cur.x, y = cur.y;
      const step = () => {
        if (!reduced && Math.hypot(vx, vy) > 0.4) { vx *= 0.9; vy *= 0.9; const c = clamp(x + vx, y + vy); if (c.x !== x + vx) vx = -vx * 0.35; if (c.y !== y + vy) vy = -vy * 0.35; x = c.x; y = c.y; save(x, y); anim.current = requestAnimationFrame(step); return; }
        const edge = x < 40 ? 12 : x > innerWidth - W - 40 ? innerWidth - W - 12 : x;
        const dx = edge - x; if (Math.abs(dx) > 0.5 && !reduced) { x += dx * 0.22; save(x, y); anim.current = requestAnimationFrame(step); return; }
        x = edge; localStorage.setItem(POS, JSON.stringify(save(x, y)));
      };
      anim.current = requestAnimationFrame(step);
    };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const click = () => { if (moved.current) { moved.current = false; return; } react(); if (onTap) setTimeout(onTap, reduced ? 0 : 420); };

  const waving = !reduced && (near || move === "bot-wave");
  const body = (
    <span className={`relative block ${still || dragging || reduced ? "" : "bot-float"}`} style={{ width: W, height: H }}>
      <span key={move} className={`relative block h-full w-full ${move === "bot-wave" ? "" : move} ${near && !reduced ? "bot-pop" : ""}`} onAnimationEnd={() => setMove("")}
        style={{ filter: "drop-shadow(0 12px 18px rgba(15,23,42,.18))", transition: "transform .25s cubic-bezier(.3,1.6,.5,1)" }}>
        <Bot size={W} look={still ? { x: 0, y: 0 } : look} waving={waving} blink={blink} />
      </span>
    </span>
  );

  if (!floating) return <span ref={ref as React.RefObject<HTMLSpanElement>} onClick={react} className="inline-block cursor-pointer">{body}</span>;
  const style: React.CSSProperties = pos ? { left: pos.x * 100 + "%", top: pos.y * 100 + "%" } : { right: 16, bottom: "calc(env(safe-area-inset-bottom) + 84px)" };
  const leftSide = pos ? pos.x < 0.5 : false;
  return (
    <button ref={ref as React.RefObject<HTMLButtonElement>} data-t="bot3d" aria-label="Chat with Reel, your assistant (drag to move)" onPointerDown={down} onClick={click}
      style={{ ...style, touchAction: "none", WebkitTapHighlightColor: "transparent" }}
      className={`fixed z-[65] select-none bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] rounded-3xl ${dragging ? "scale-110 cursor-grabbing" : "cursor-grab"}`}>
      {body}
      <span className={`pointer-events-none absolute top-1 whitespace-nowrap rounded-2xl border border-black/5 bg-white/95 px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] shadow-[0_8px_24px_-8px_rgba(0,0,0,.25)] backdrop-blur transition-all duration-200 ${leftSide ? "left-full ml-1 origin-left" : "right-full mr-1 origin-right"} ${near && !dragging ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>Need a hand?</span>
    </button>
  );
}
