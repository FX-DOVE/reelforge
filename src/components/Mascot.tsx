"use client";
import { useEffect, useRef, useState } from "react";
import { BOT_PALETTES, DEFAULT_BOT, type BotStyle } from "@/lib/botStyle";

const POS = "rf-bot-pos2";
const MOVES = ["bot-wave", "bot-jump", "bot-nod"];

/** A soft, glossy 3D-style robot drawn in SVG, configurable per agent (shape, palette, eyes, accessory). */
let uid = 0;
export function Bot({ size, look = { x: 0, y: 0 }, waving = false, blink = false, style = DEFAULT_BOT }: { size: number; look?: { x: number; y: number }; waving?: boolean; blink?: boolean; style?: BotStyle }) {
  const [id] = useState(() => "rfb" + (uid++).toString(36));
  const P = BOT_PALETTES[style.palette] || BOT_PALETTES[0];
  const ex = look.x * 3.2, ey = look.y * 2.6;
  // head box per shape
  const H = { round: { x: 14, y: 13, w: 92, h: 62, r: 30 }, tall: { x: 22, y: 6, w: 76, h: 70, r: 26 }, cube: { x: 16, y: 13, w: 88, h: 62, r: 12 }, retro: { x: 18, y: 15, w: 84, h: 58, r: 8 } }[style.shape];
  const V = { x: H.x + 10, y: H.y + 10, w: H.w - 20, h: H.h - 20, r: Math.max(6, H.r - 9) };
  const cy = V.y + V.h / 2 + 1;
  const stroke = style.palette === 6 ? "#22252c" : "#b7c0cf";
  const eye = (x: number) => {
    const g = `url(#${id}e)`;
    if (blink && style.eyes !== "visor") return <rect key={x} x={x - 6} y={cy - 0.8} width="12" height="1.6" rx=".8" fill={P.eye} />;
    switch (style.eyes) {
      case "happy": return <path key={x} d={`M${x - 6} ${cy + 2} Q${x} ${cy - 7} ${x + 6} ${cy + 2}`} stroke={P.eye} strokeWidth="3.2" strokeLinecap="round" fill="none" />;
      case "pixel": return <g key={x}><rect x={x - 5} y={cy - 5} width="10" height="10" rx="1.5" fill={g} /><rect x={x - 3.5} y={cy - 3.5} width="3" height="3" fill="#fff" /></g>;
      case "sleepy": return <g key={x}><ellipse cx={x} cy={cy + 1.5} rx="6" ry="4.2" fill={g} /><rect x={x - 7} y={cy - 4.5} width="14" height="4.5" fill={`url(#${id}v)`} /><circle cx={x - 2} cy={cy + 1} r="1.2" fill="#fff" /></g>;
      default: return <g key={x}><ellipse cx={x} cy={cy} rx="7" ry="8" fill={P.eye} opacity=".5" filter={`url(#${id}g)`} /><ellipse cx={x} cy={cy} rx="5.6" ry="6.8" fill={g} /><circle cx={x - 1.8} cy={cy - 2.6} r="1.6" fill="#fff" /></g>;
    }
  };
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * 130 / 120} aria-hidden className="block overflow-visible">
      <defs>
        <radialGradient id={`${id}b`} cx="38%" cy="28%" r="80%"><stop offset="0" stopColor={P.body[0]} /><stop offset=".55" stopColor={P.body[1]} /><stop offset="1" stopColor={P.body[2]} /></radialGradient>
        <radialGradient id={`${id}v`} cx="40%" cy="30%" r="85%"><stop offset="0" stopColor="#3a4a66" /><stop offset=".6" stopColor="#141b2a" /><stop offset="1" stopColor="#070a12" /></radialGradient>
        <radialGradient id={`${id}e`} cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor={P.eye} /><stop offset="1" stopColor={P.acc[1]} /></radialGradient>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.acc[0]} /><stop offset="1" stopColor={P.acc[1]} /></linearGradient>
        <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <ellipse cx="60" cy="124" rx="26" ry="4.5" fill="#0b1220" opacity=".16" />
      {/* arms */}
      <ellipse cx="22" cy="86" rx="8" ry="13" fill={`url(#${id}b)`} stroke={stroke} strokeWidth=".6" transform="rotate(14 22 86)" />
      <g className={waving ? "bot-arm-wave" : ""} style={{ transformOrigin: "92px 78px" }}><ellipse cx="98" cy="86" rx="8" ry="13" fill={`url(#${id}b)`} stroke={stroke} strokeWidth=".6" transform="rotate(-14 98 86)" /></g>
      {/* body */}
      {style.shape === "cube" || style.shape === "retro"
        ? <rect x="33" y="66" width="54" height="51" rx={style.shape === "cube" ? 10 : 5} fill={`url(#${id}b)`} stroke={stroke} strokeWidth=".6" />
        : <path d={style.shape === "tall" ? "M36 80 Q36 72 48 72 H72 Q84 72 84 80 V104 Q84 117 70 117 H50 Q36 117 36 104 Z" : "M32 80 Q32 66 46 64 H74 Q88 66 88 80 V100 Q88 116 70 117 H50 Q32 116 32 100 Z"} fill={`url(#${id}b)`} stroke={stroke} strokeWidth=".6" />}
      {style.shape === "retro"
        ? <g><circle cx="50" cy="88" r="3.4" fill={`url(#${id}a)`} /><circle cx="60" cy="88" r="3.4" fill="#ff5f57" /><circle cx="70" cy="88" r="3.4" fill="#febc2e" /><rect x="46" y="98" width="28" height="4" rx="2" fill={stroke} opacity=".7" /><rect x="46" y="106" width="20" height="4" rx="2" fill={stroke} opacity=".5" /></g>
        : <g><ellipse cx="60" cy="93" rx="9" ry="6" fill={`url(#${id}a)`} /><ellipse cx="57" cy="91" rx="3" ry="1.4" fill="#fff" opacity=".7" /></g>}
      {/* antenna */}
      {style.acc === "twin" ? <g><line x1="44" y1={H.y + 2} x2="38" y2={H.y - 8} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" /><line x1="76" y1={H.y + 2} x2="82" y2={H.y - 8} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" /><circle cx="38" cy={H.y - 10} r="3.6" fill={`url(#${id}a)`} /><circle cx="82" cy={H.y - 10} r="3.6" fill={`url(#${id}a)`} /></g>
        : style.acc !== "cap" && style.acc !== "beret" && style.acc !== "halo" && <g><line x1="60" y1={H.y + 1} x2="60" y2={H.y - 7} stroke={stroke} strokeWidth="2.4" strokeLinecap="round" /><circle cx="60" cy={H.y - 8} r="4.2" fill={`url(#${id}a)`} /><circle cx="58.6" cy={H.y - 9.4} r="1.3" fill="#fff" opacity=".8" /></g>}
      {/* ears */}
      {style.acc !== "headphones" && (style.shape === "retro"
        ? <g><rect x={H.x - 6} y={H.y + 18} width="6" height="18" rx="1.5" fill={`url(#${id}a)`} /><rect x={H.x + H.w} y={H.y + 18} width="6" height="18" rx="1.5" fill={`url(#${id}a)`} /></g>
        : <g><rect x={H.x - 5} y={H.y + 21} width="9" height="20" rx="4.5" fill={`url(#${id}a)`} /><rect x={H.x + H.w - 4} y={H.y + 21} width="9" height="20" rx="4.5" fill={`url(#${id}a)`} /></g>)}
      {/* head */}
      <rect x={H.x} y={H.y} width={H.w} height={H.h} rx={H.r} fill={`url(#${id}b)`} stroke={stroke} strokeWidth=".6" />
      <rect x={V.x} y={V.y} width={V.w} height={V.h} rx={V.r} fill={`url(#${id}v)`} />
      <path d={`M${V.x + 8} ${V.y + 7} Q${V.x + 20} ${V.y + 2} ${V.x + 36} ${V.y + 3}`} stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" fill="none" />
      <g transform={`translate(${ex} ${ey})`}>
        {style.eyes === "visor"
          ? <g><rect x={V.x + 8} y={cy - (blink ? 1 : 4)} width={V.w - 16} height={blink ? 2 : 8} rx="4" fill={P.eye} opacity=".5" filter={`url(#${id}g)`} /><rect x={V.x + 9} y={cy - (blink ? 0.8 : 3)} width={V.w - 18} height={blink ? 1.6 : 6} rx="3" fill={`url(#${id}e)`} /></g>
          : [46, 74].map(eye)}
        <path d={`M54 ${cy + 11} Q60 ${cy + 15} 66 ${cy + 11}`} stroke={P.eye} strokeWidth="2" strokeLinecap="round" fill="none" opacity=".9" />
      </g>
      <ellipse cx={H.x + 20} cy={H.y + 9} rx="10" ry="4" fill="#fff" opacity={style.palette === 6 ? 0.25 : 0.75} transform={`rotate(-18 ${H.x + 20} ${H.y + 9})`} />
      {/* accessories */}
      {style.acc === "headphones" && <g><path d={`M${H.x - 2} ${H.y + 30} Q${H.x - 2} ${H.y - 14} 60 ${H.y - 14} Q${H.x + H.w + 2} ${H.y - 14} ${H.x + H.w + 2} ${H.y + 30}`} stroke={`url(#${id}a)`} strokeWidth="5" fill="none" strokeLinecap="round" /><rect x={H.x - 9} y={H.y + 18} width="14" height="24" rx="6" fill={`url(#${id}a)`} /><rect x={H.x + H.w - 5} y={H.y + 18} width="14" height="24" rx="6" fill={`url(#${id}a)`} /></g>}
      {style.acc === "cap" && <g><path d={`M${H.x + 8} ${H.y + 8} Q60 ${H.y - 22} ${H.x + H.w - 8} ${H.y + 8} Z`} fill="#1d1d1f" /><path d={`M${H.x + H.w - 14} ${H.y + 6} Q${H.x + H.w + 14} ${H.y + 2} ${H.x + H.w + 16} ${H.y + 9} L${H.x + H.w - 10} ${H.y + 11} Z`} fill="#2c2c2e" /><rect x="44" y={H.y - 6} width="32" height="6" rx="2" fill="#fff" opacity=".9" /><text x="60" y={H.y - 1.4} textAnchor="middle" fontSize="5" fontWeight="700" fill="#1d1d1f" fontFamily="system-ui">DIRECTOR</text></g>}
      {style.acc === "beret" && <g><ellipse cx="54" cy={H.y + 1} rx="34" ry="9" fill="#e0335c" transform={`rotate(-8 54 ${H.y + 1})`} /><circle cx="56" cy={H.y - 8} r="3" fill="#b8264a" /></g>}
      {style.acc === "bow" && <g transform={`translate(${H.x + H.w - 14} ${H.y + 2})`}><path d="M0 0 L-12 -8 L-12 8 Z M0 0 L12 -8 L12 8 Z" fill="#ff6f91" /><circle r="3.4" fill="#e0335c" /></g>}
      {style.acc === "halo" && <ellipse cx="60" cy={H.y - 9} rx="22" ry="5" fill="none" stroke="#ffd24a" strokeWidth="3.4" opacity=".95" />}
    </svg>
  );
}

export function Mascot({ size = 64, still, floating, onTap, bot }: { size?: number; still?: boolean; floating?: boolean; onTap?: () => void; bot?: BotStyle }) {
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
        <Bot size={W} look={still ? { x: 0, y: 0 } : look} waving={waving} blink={blink} style={bot} />
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
      <span className={`pointer-events-none absolute top-1 whitespace-nowrap rounded-2xl px-3 py-1.5 text-[13px] font-medium shadow-[0_8px_24px_-8px_rgba(0,0,0,.25)] backdrop-blur transition-all duration-200 ${leftSide ? "left-full ml-1 origin-left" : "right-full mr-1 origin-right"} ${near && !dragging ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} style={{ background: "#fff", color: "#1d1d1f", border: "1px solid rgba(0,0,0,.06)" }}>Need a hand?</span>
    </button>
  );
}
