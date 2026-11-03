"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clipboard, Gauge, Keyboard, Maximize, Minimize, MousePointer2, Pointer, ScanSearch } from "lucide-react";
import { H } from "@/lib/net";
import { SleepScreen } from "./DeskApps";

/** Reel's real Linux desktop (Xvfb + Openbox + Chromium), streamed as JPEG frames; input goes back over xdotool. */
export type DeskState = "busy" | "unavailable" | "asleep" | "starting" | "awake" | "error" | "loading";
export type InputMode = "mouse" | "touch";

export function useDesk() {
  const [state, setState] = useState<DeskState>("loading");
  const [control, setControl] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const local = useRef(0); // ignore polls that started before a local change
  useEffect(() => {
    let dead = false,
      t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const t0 = Date.now();
      const r = await fetch("/api/desk/status", { headers: H, cache: "no-store" }).catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (dead) return;
      if (t0 > local.current) {
        setState(j?.state || "unavailable");
        setBusyMsg(j?.error || "");
        if (j && "control" in j) setControl(!!j.control);
      }
      t = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, []);
  const post = (op: string, b: unknown = {}) =>
    fetch("/api/desk/" + op, { method: "POST", headers: H, body: JSON.stringify(b) })
      .then((r) => r.json())
      .catch(() => ({}));
  const wake = async () => {
    local.current = Date.now();
    setState("starting");
    const j = await post("wake");
    setState(j.state || "error");
    setBusyMsg(j.error || "");
  };
  const take = async (on: boolean) => {
    local.current = Date.now();
    setControl(on);
    await post("control", { on });
    local.current = Date.now();
  };
  return {
    state,
    busyMsg,
    control,
    wake,
    take,
    post,
    sleep: async () => {
      await post("sleep");
      setState("asleep");
      setControl(false);
    },
  };
}

const MODE_KEY = "rf-input-mode";
export function useInputMode(): [InputMode, (m: InputMode) => void] {
  const [m, setM] = useState<InputMode>("touch");
  useEffect(() => {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "mouse" || v === "touch") setM(v);
  }, []);
  return [
    m,
    (v) => {
      setM(v);
      try {
        localStorage.setItem(MODE_KEY, v);
      } catch {
        /* */
      }
    },
  ];
}

/**
 * Phone keyboard for the remote desktop. A plain tap never focuses the hidden input (that made iOS pop the keyboard up and drop it
 * on every tap). The keyboard opens only (a) when the tap lands on a text field in the desktop — probed while the finger is down so
 * focus() still happens inside the same gesture — or (b) from the keyboard button next to the mouse/touch toggle. Once open it stays
 * open while you type: taps on the desktop don't steal focus (touchstart is cancelled), and only an auto-opened keyboard closes when
 * you tap somewhere that isn't a text field.
 */
type KbState = { el: HTMLInputElement | null; open: boolean; auto: boolean; hint: boolean; control: boolean };
const kbBus: KbState & { subs: Set<() => void>; set: (p: Partial<KbState>) => void } = {
  el: null,
  open: false,
  auto: false,
  hint: false,
  control: false,
  subs: new Set(),
  set(p) {
    let ch = false;
    for (const k of Object.keys(p) as (keyof KbState)[])
      if (this[k] !== p[k]) {
        (this as unknown as Record<string, unknown>)[k] = p[k];
        ch = true;
      }
    if (ch) this.subs.forEach((f) => f());
  },
};
function useKb() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    kbBus.subs.add(f);
    return () => {
      kbBus.subs.delete(f);
    };
  }, []);
  return kbBus;
}
const openKb = (auto: boolean) => {
  const el = kbBus.el;
  if (!el) return;
  kbBus.set({ auto, hint: false });
  if (document.activeElement !== el) el.focus({ preventScroll: true });
};
const closeKb = () => {
  kbBus.set({ hint: false });
  kbBus.el?.blur();
};
/** Button handlers that never take focus from the hidden input: pointerdown is cancelled (no focus move, no compat mouse events),
 *  so the action runs on pointerup — still inside the user gesture iOS needs for focus() — and on keyboard "click" (detail 0). */
const tap = (fn: () => void) => ({
  onPointerDown: (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  },
  onPointerUp: (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button === 0) fn();
  },
  onClick: (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail === 0) fn();
  },
});

export function ModeToggle({ mode, setMode, className = "" }: { mode: InputMode; setMode: (m: InputMode) => void; className?: string }) {
  const kb = useKb();
  const B = (m: InputMode, Icon: typeof Pointer, label: string) => (
    <button
      aria-label={label}
      aria-pressed={mode === m}
      title={label}
      {...tap(() => setMode(m))}
      className={`grid h-8 w-8 place-items-center rounded-full transition ${mode === m ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
  return (
    <div className={`flex items-center gap-0.5 rounded-full bg-ink-900/90 p-0.5 ring-1 ring-white/10 ${className}`}>
      {B("mouse", MousePointer2, "Mouse mode")}
      {B("touch", Pointer, "Touch mode")}
      {kb.control && (
        <button
          aria-label={kb.open ? "Hide keyboard" : "Show keyboard"}
          aria-pressed={kb.open}
          title={kb.open ? "Hide keyboard" : "Show keyboard"}
          {...tap(() => (kbBus.open ? closeKb() : openKb(false)))}
          className={`relative grid h-8 w-8 place-items-center rounded-full transition ${kb.open ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
        >
          <Keyboard className="h-4 w-4" />
          {kb.hint && !kb.open && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full ring-2 ring-brand-400" />}
        </button>
      )}
    </div>
  );
}

const NAMED: Record<string, string> = {
  Enter: "Enter",
  Backspace: "Backspace",
  Tab: "Tab",
  Escape: "Escape",
  Delete: "Delete",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
};
const XK: Record<string, string> = {
  Enter: "Return",
  Backspace: "BackSpace",
  Tab: "Tab",
  Escape: "Escape",
  Delete: "Delete",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "Prior",
  PageDown: "Next",
  Insert: "Insert",
  " ": "space",
};
/** a browser key event → an xdotool key combo ("ctrl+shift+t", "alt+Left", "F5"), or null when it's plain text for the input */
function combo(e: React.KeyboardEvent): string | null {
  const ctrl = e.ctrlKey || e.metaKey,
    mods = [ctrl && "ctrl", e.altKey && "alt"].filter(Boolean) as string[];
  if (/^F([1-9]|1[0-2])$/.test(e.key)) return [...mods, e.shiftKey && "shift", e.key].filter(Boolean).join("+");
  if (NAMED[e.key]) return mods.length || e.shiftKey ? [...mods, e.shiftKey && "shift", XK[e.key]].filter(Boolean).join("+") : e.key;
  if (mods.length && e.key.length === 1) {
    const k = XK[e.key] || e.key.toLowerCase();
    return /^[\w]+$/.test(k) ? [...mods, e.shiftKey && "shift", k].filter(Boolean).join("+") : null;
  }
  return null;
}

const RW = 1280,
  RH = 720;
type Quality = "auto" | "sharp" | "fast";
type Link = "connecting" | "live" | "reconnecting" | "http";
const Q_KEY = "rf-desk-quality";

export function RealDesk({ desk, mode }: { desk: ReturnType<typeof useDesk>; mode: InputMode }) {
  const { state, busyMsg, control, wake, post } = desk;
  const [has, setHas] = useState(false);
  const [cur, setCur] = useState({ x: 0.5, y: 0.5 });
  const [glide, setGlide] = useState(false); // remote-driven cursor animates between samples; local input is instant
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const kb = useRef<HTMLInputElement>(null);
  const curRef = useRef(cur);
  curRef.current = cur;
  const lastLocal = useRef(0);
  const moveCur = (p: { x: number; y: number }) => {
    lastLocal.current = Date.now();
    curRef.current = p;
    setGlide(false);
    setCur(p);
  };

  // ---- view: fit (letterboxed, aspect kept) or 1:1 device pixels, plus pinch zoom & pan ----
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const f = () => setDpr(window.devicePixelRatio || 1);
    f();
    const m = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    m.addEventListener?.("change", f);
    addEventListener("resize", f);
    return () => {
      m.removeEventListener?.("change", f);
      removeEventListener("resize", f);
    };
  }, []);
  const [view, setView] = useState({ one: false, z: 1, px: 0, py: 0 });
  const fit = size.w && size.h ? Math.min(size.w / RW, size.h / RH) : 1;
  const base = view.one ? 1 / dpr : fit;
  const geo = (v: typeof view) => {
    const b = v.one ? 1 / dpr : fit,
      sc = b * v.z,
      sw = RW * sc,
      sh = RH * sc;
    const mx = Math.max(0, (sw - size.w) / 2),
      my = Math.max(0, (sh - size.h) / 2);
    const px = Math.max(-mx, Math.min(mx, v.px)),
      py = Math.max(-my, Math.min(my, v.py));
    return { sc, sw, sh, px, py, left: (size.w - sw) / 2 + px, top: (size.h - sh) / 2 + py };
  };
  const G = geo(view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const zoomed = G.sw > size.w + 1 || G.sh > size.h + 1;
  const zmin = Math.min(1, fit / base);
  /** zoom to z keeping the box point (ax, ay) fixed under the finger */
  const zoomAt = (z: number, ax: number, ay: number, from = viewRef.current, dx = 0, dy = 0) => {
    const g0 = geoRef.current(from);
    const u = (ax - g0.left) / g0.sc,
      v = (ay - g0.top) / g0.sc;
    const zz = Math.max(zmin, Math.min(5, z)),
      sc = base * zz,
      sw = RW * sc,
      sh = RH * sc;
    const nv = { ...from, z: zz, px: ax + dx - u * sc - (size.w - sw) / 2, py: ay + dy - v * sc - (size.h - sh) / 2 };
    const g = geoRef.current(nv);
    setView({ ...nv, px: g.px, py: g.py });
  };
  const resetView = (one = viewRef.current.one) => setView({ one, z: 1, px: 0, py: 0 });

  // ---- stream: WebSocket of changed JPEG frames drawn on a canvas (no per-frame React render / blob <img> swaps) ----
  const ws = useRef<WebSocket | null>(null);
  const acks = useRef(new Map<number, (j: { text?: boolean; cls?: string }) => void>());
  const seq = useRef(0);
  const [link, setLink] = useState<Link>("connecting");
  const [rtt, setRtt] = useState<number>();
  const [quality, setQualityS] = useState<Quality>("auto");
  const qRef = useRef(quality);
  qRef.current = quality;
  const [degraded, setDegraded] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem(Q_KEY);
    if (v === "auto" || v === "sharp" || v === "fast") setQualityS(v);
  }, []);
  const setQuality = (v: Quality) => {
    setQualityS(v);
    try {
      localStorage.setItem(Q_KEY, v);
    } catch {
      /* */
    }
    ws.current?.send(JSON.stringify({ t: "quality", v }));
  };
  const [clip, setClip] = useState<{ text: string; copied: boolean } | null>(null);
  const onRemoteClip = useRef<(t: string) => void>(() => {});
  onRemoteClip.current = (text: string) => {
    const ok = () => setClip({ text, copied: true }),
      no = () => setClip({ text, copied: false });
    if (document.hasFocus() && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, no);
    else no();
  };
  useEffect(() => {
    if (state !== "awake") return;
    let dead = false,
      sock: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout>,
      fails = 0,
      lastMsg = 0;
    let decoding = false,
      pending: Blob | null = null,
      first = true;
    const draw = (b: Blob) => {
      if (decoding) {
        pending = b;
        return;
      }
      decoding = true;
      const done = () => {
        decoding = false;
        if (first) {
          first = false;
          setHas(true);
        }
        if (pending) {
          const n = pending;
          pending = null;
          draw(n);
        }
      };
      const ctx = cv.current?.getContext("2d");
      if (!ctx) {
        decoding = false;
        return;
      }
      if (typeof createImageBitmap === "function")
        createImageBitmap(b)
          .then((bm) => {
            ctx.drawImage(bm, 0, 0, RW, RH);
            bm.close();
          })
          .catch(() => {})
          .finally(done);
      else {
        const u = URL.createObjectURL(b),
          im = new Image();
        im.onload = im.onerror = () => {
          try {
            ctx.drawImage(im, 0, 0, RW, RH);
          } catch {
            /* */
          }
          URL.revokeObjectURL(u);
          done();
        };
        im.src = u;
      }
    };
    const connect = () => {
      clearTimeout(retry);
      if (dead || document.visibilityState !== "visible" || (sock && sock.readyState < 2)) return;
      try {
        sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/desk/ws`);
      } catch {
        poll();
        return;
      }
      const me = sock;
      me.binaryType = "blob";
      let opened = false;
      setLink((l) => (l === "http" ? l : fails ? "reconnecting" : "connecting"));
      me.onopen = () => {
        opened = true;
        fails = 0;
        ws.current = me;
        lastMsg = Date.now();
        setLink("live");
        me.send(JSON.stringify({ t: "quality", v: qRef.current }));
      };
      me.onmessage = (e) => {
        lastMsg = Date.now();
        if (typeof e.data !== "string") return draw(e.data as Blob);
        try {
          const j = JSON.parse(e.data);
          if (j.t === "ack") {
            acks.current.get(j.id)?.(j);
            acks.current.delete(j.id);
          } else if (j.t === "pong") setRtt(Date.now() - j.ts);
          else if (j.t === "cur") {
            if (Date.now() - lastLocal.current > 600) {
              setGlide(true);
              const p = { x: j.x, y: j.y };
              curRef.current = p;
              setCur(p);
            }
          } else if (j.t === "clip") onRemoteClip.current(String(j.text || ""));
          else if (j.t === "profile") setDegraded(!!j.degraded);
        } catch {
          /* */
        }
      };
      me.onclose = () => {
        if (ws.current === me) ws.current = null;
        if (dead) return;
        if (!opened) fails++;
        else fails = Math.max(fails, 1);
        setLink(fails >= 3 ? "http" : "reconnecting");
        if (fails >= 3) poll();
        retry = setTimeout(connect, Math.min(10000, 600 * 2 ** Math.min(fails, 4))); // keep retrying the live link with backoff, even while HTTP fills in
      };
    };
    const ping = setInterval(() => {
      const s = ws.current;
      if (!s || s.readyState !== 1) return;
      if (Date.now() - lastMsg > 12000) {
        s.close();
        return;
      } // stalled (sleeping laptop, dead proxy) → reconnect
      s.send(JSON.stringify({ t: "ping", ts: Date.now() }));
    }, 3000);
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      while (!dead && !ws.current) {
        if (document.visibilityState === "visible") {
          const r = await fetch("/api/desk/frame", { headers: H, cache: "no-store" }).catch(() => null);
          if (r?.status === 200 && (r.headers.get("Content-Type") || "").includes("image")) {
            const b = await r.blob();
            if (!dead) draw(b);
          }
        }
        await new Promise((r) => setTimeout(r, 90));
      }
      polling = false;
    };
    const vis = () => {
      if (document.visibilityState === "visible") connect();
      else sock?.close();
    };
    const online = () => {
      fails = Math.min(fails, 1);
      connect();
    };
    document.addEventListener("visibilitychange", vis);
    addEventListener("online", online);
    connect();
    return () => {
      dead = true;
      clearTimeout(retry);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", vis);
      removeEventListener("online", online);
      sock?.close();
      ws.current = null;
    };
  }, [state]);

  const q = useRef<Promise<unknown>>(Promise.resolve());
  // serialise input so keystrokes/clicks arrive in order
  const raw = useCallback(
    (o: Record<string, unknown>): Promise<{ text?: boolean }> => {
      const s = ws.current;
      if (s && s.readyState === 1) {
        if (o.t !== "click" && o.t !== "up") {
          s.send(JSON.stringify(o));
          return Promise.resolve({});
        }
        const id = ++seq.current;
        s.send(JSON.stringify({ ...o, id }));
        return new Promise<{ text?: boolean; cls?: string }>((res) => {
          acks.current.set(id, res);
          setTimeout(() => {
            if (acks.current.delete(id)) res({});
          }, 4000);
        }).then(async (j) =>
          /chrom/i.test(j.cls || "")
            ? {
                text:
                  Number(o.y) < 0.13 ||
                  (
                    await fetch("/api/desk/editable", { headers: H, cache: "no-store" })
                      .then((r) => r.json())
                      .catch(() => ({}))
                  ).text,
              }
            : j,
        );
      }
      if (o.t === "quality" || o.t === "clipset") return Promise.resolve({});
      if (o.t === "paste") o = { t: "type", text: o.text }; // HTTP fallback: type it out
      const p = q.current.then(() => post("input", o));
      q.current = p.catch(() => {});
      return p as Promise<{ text?: boolean }>;
    },
    [post],
  );
  // typed characters are batched (one message per burst, not per key)
  const buf = useRef("");
  const bt = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useCallback(() => {
    clearTimeout(bt.current);
    if (buf.current) {
      const text = buf.current;
      buf.current = "";
      raw({ t: "type", text });
    }
  }, [raw]);
  const send = useCallback(
    (o: Record<string, unknown>) => {
      if (o.t === "type") {
        buf.current += String(o.text || "");
        clearTimeout(bt.current);
        bt.current = setTimeout(flush, ws.current ? 25 : 60);
        return Promise.resolve({} as { text?: boolean });
      }
      flush();
      return raw(o);
    },
    [raw, flush],
  );
  /** screen point → normalised remote coords, through the letterbox / zoom / pan */
  const at = (cx: number, cy: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (cx - r.left) / r.width)), y: Math.max(0, Math.min(1, (cy - r.top) / r.height)) };
  };
  const local = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };
  /** zoomed in with the trackpad: pan so the cursor stays on screen */
  const follow = (n: { x: number; y: number }) => {
    const v = viewRef.current,
      g = geoRef.current(v);
    if (g.sw <= size.w && g.sh <= size.h) return;
    const cx = g.left + n.x * g.sw,
      cy = g.top + n.y * g.sh,
      m = 40;
    let { px, py } = g;
    if (cx < m) px += m - cx;
    else if (cx > size.w - m) px -= cx - (size.w - m);
    if (cy < m) py += m - cy;
    else if (cy > size.h - m) py -= cy - (size.h - m);
    if (px !== g.px || py !== g.py) setView({ ...v, px, py });
  };

  // keyboard (see kbBus): never focus on a plain tap; probe the tap point while the finger is down, focus inside the same gesture only for text fields
  const kbs = useKb();
  useEffect(() => {
    kbBus.set({ control });
    if (!control) closeKb();
  }, [control]);
  useEffect(() => {
    kbBus.el = kb.current;
  });
  useEffect(
    () => () => {
      kbBus.el = null;
      kbBus.set({ open: false, hint: false, control: false });
    },
    [],
  );
  const probe = useRef<{ at: number; text?: boolean }>({ at: 0 });
  const startProbe = (p: { x: number; y: number }) => {
    if (kbBus.open) return;
    const at = Date.now();
    probe.current = { at };
    fetch(`/api/desk/editable?x=${p.x.toFixed(4)}&y=${p.y.toFixed(4)}`, { headers: H, cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (probe.current.at === at) probe.current.text = !!j.text;
      })
      .catch(() => {});
  };
  const wantFocus = useRef(false);
  const afterClick = (j: { text?: boolean } | undefined) => {
    if (j?.text && !kbBus.open)
      kbBus.set({ hint: true }); // too late to focus outside the gesture: pulse the keyboard button instead
    else if (!j?.text && kbBus.open && kbBus.auto)
      closeKb(); // auto-opened for a field the user has left
    else if (!j?.text) kbBus.set({ hint: false });
  };
  const clickAndKb = async (p: { x: number; y: number }, button = "left") => {
    moveCur(p);
    // inside the gesture: the probe already says "text field" → raise the keyboard now (iOS only allows focus from a user gesture)
    if (button === "left" && !kbBus.open && probe.current.text) {
      wantFocus.current = true;
      openKb(true);
    }
    const j = await send({ t: "click", ...p, button });
    if (button === "left") afterClick(j);
  };
  // Cancel touchstart (non-passive) so a tap never moves focus: an open keyboard stays open, no blur/refocus flicker, no zoom/magnifier.
  // touchend is a trusted gesture on iOS, so a pending "focus for this text field" is applied there as well.
  useEffect(() => {
    const el = box.current;
    if (!el || (!control && !zoomed)) return;
    const ts = (e: TouchEvent) => {
      if (e.cancelable && !(e.target as Element).closest?.("button,[data-ui]")) e.preventDefault();
    };
    const te = () => {
      if (wantFocus.current) {
        wantFocus.current = false;
        if (!kbBus.open) openKb(true);
      }
    };
    el.addEventListener("touchstart", ts, { passive: false });
    el.addEventListener("touchend", te);
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchend", te);
    };
  });
  // wheel / trackpad: accumulate (a trackpad fires dozens of tiny deltas), ctrl+wheel (= trackpad pinch) zooms the view locally
  const wacc = useRef({ x: 0, y: 0, t: 0 as unknown as ReturnType<typeof setTimeout> | 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wh = (e: WheelEvent) => {
      if ((e.target as Element).closest?.("[data-ui]")) return;
      if (e.ctrlKey) {
        e.preventDefault();
        const l = local(e.clientX, e.clientY);
        zoomAt(viewRef.current.z * Math.exp(-e.deltaY / 200), l.x, l.y);
        return;
      }
      if (!control) return;
      e.preventDefault();
      const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1,
        a = wacc.current;
      a.x += e.deltaX * k;
      a.y += e.deltaY * k;
      const p = at(e.clientX, e.clientY);
      const go = () => {
        a.t = 0;
        if (Math.abs(a.y) >= 50) {
          send({ t: "scroll", dy: a.y, ...p });
          a.y = 0;
        }
        if (Math.abs(a.x) >= 50) {
          send({ t: "hscroll", dx: a.x, ...p });
          a.x = 0;
        }
      };
      if (!a.t) a.t = setTimeout(go, 40);
    };
    el.addEventListener("wheel", wh, { passive: false });
    return () => el.removeEventListener("wheel", wh);
  });

  // ---- gestures ----
  type Pt = { x: number; y: number };
  const g = useRef<{
    pts: Map<number, Pt>;
    sx: number;
    sy: number;
    moved: boolean;
    t0: number;
    long?: ReturnType<typeof setTimeout>;
    acc: number;
    lastMove: number;
    two: boolean;
    kind: "" | "?" | "pinch" | "scroll";
    d0: number;
    m0: Pt;
    v0: typeof view;
    t2: number;
    mouseDown: boolean;
  }>({
    pts: new Map(),
    sx: 0,
    sy: 0,
    moved: false,
    t0: 0,
    acc: 0,
    lastMove: 0,
    two: false,
    kind: "",
    d0: 1,
    m0: { x: 0, y: 0 },
    v0: view,
    t2: 0,
    mouseDown: false,
  });
  const flushScroll = (p?: Pt) => {
    const s = g.current;
    if (Math.abs(s.acc) >= 30) {
      send({ t: "scroll", dy: s.acc * 3, ...(p || {}) });
      s.acc = 0;
    }
  };
  const two = () => {
    const [a, b] = [...g.current.pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: local((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };
  const [mouseIn, setMouseIn] = useState(false);
  const btn = (b: number) => (b === 2 ? "right" : b === 1 ? "middle" : "left");

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest?.("[data-ui]")) return;
    const s = g.current;
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic/stale pointer */
    }
    if (e.pointerType === "mouse") {
      if (!control) return;
      const p = at(e.clientX, e.clientY);
      moveCur(p);
      s.mouseDown = true;
      send({ t: "down", ...p, button: btn(e.button) });
      return;
    }
    s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pts.size === 1) {
      s.sx = e.clientX;
      s.sy = e.clientY;
      s.moved = false;
      s.two = false;
      s.kind = "";
      s.t0 = Date.now();
      s.acc = 0;
      wantFocus.current = false;
      if (!control) return;
      startProbe(mode === "mouse" ? curRef.current : at(e.clientX, e.clientY));
      clearTimeout(s.long);
      s.long = setTimeout(() => {
        if (!s.moved && s.pts.size === 1) {
          s.moved = true;
          const p = mode === "mouse" ? curRef.current : at(s.sx, s.sy);
          clickAndKb(p, "right");
          navigator.vibrate?.(15);
        }
      }, 550);
    } else if (s.pts.size === 2) {
      s.two = true;
      s.moved = true;
      clearTimeout(s.long);
      const t = two();
      s.kind = "?";
      s.d0 = t.d;
      s.m0 = t.m;
      s.v0 = viewRef.current;
      s.t2 = Date.now();
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (e.pointerType === "mouse") {
      if (!control) return;
      const p = at(e.clientX, e.clientY);
      lastLocal.current = Date.now();
      curRef.current = p;
      if (Date.now() - s.lastMove > (ws.current ? 16 : 60)) {
        s.lastMove = Date.now();
        send({ t: "move", ...p });
      } // hover too: menus/tooltips react like a real mouse
      return;
    }
    const prev = s.pts.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y;
    s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pts.size >= 2) {
      const t = two();
      if (s.kind === "?") {
        if (Math.abs(t.d / s.d0 - 1) > 0.12) s.kind = "pinch";
        else if (Math.hypot(t.m.x - s.m0.x, t.m.y - s.m0.y) > 10) s.kind = control ? "scroll" : "pinch";
      }
      if (s.kind === "pinch") zoomAt(s.v0.z * (t.d / s.d0), s.m0.x, s.m0.y, s.v0, t.m.x - s.m0.x, t.m.y - s.m0.y);
      else if (s.kind === "scroll") {
        s.acc += -dy / 2;
        flushScroll(mode === "touch" ? at(s.sx, s.sy) : undefined);
      }
      return;
    }
    if (s.two) return; // one finger left after a pinch: ignore until all lift
    if (!s.moved && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 8) {
      s.moved = true;
      clearTimeout(s.long);
    }
    if (!s.moved) return;
    if (!control) {
      if (zoomed)
        setView((v) => {
          const gg = geoRef.current({ ...v, px: v.px + dx, py: v.py + dy });
          return { ...v, px: gg.px, py: gg.py };
        });
      return;
    }
    if (mode === "touch") {
      s.acc += -dy;
      flushScroll(at(s.sx, s.sy));
      return;
    }
    // mouse mode: trackpad — relative movement, a little acceleration for fast swipes
    const r = stage.current!.getBoundingClientRect();
    const sp = Math.hypot(dx, dy);
    const k = 1.3 + Math.min(1.4, sp / 18);
    const n = { x: Math.max(0, Math.min(1, curRef.current.x + (dx / r.width) * k)), y: Math.max(0, Math.min(1, curRef.current.y + (dy / r.height) * k)) };
    moveCur(n);
    follow(n);
    if (Date.now() - s.lastMove > (ws.current ? 16 : 60)) {
      s.lastMove = Date.now();
      send({ t: "move", ...n });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    if (e.pointerType === "mouse") {
      if (!control || !s.mouseDown) return;
      s.mouseDown = false;
      const p = at(e.clientX, e.clientY);
      moveCur(p);
      if (e.button === 0) openKb(false); // real mouse = real keyboard: no on-screen keyboard to flicker
      send({ t: "up", ...p, button: btn(e.button) }).then((j) => {
        if (e.button === 0) afterClick(j);
      });
      return;
    }
    if (!s.pts.has(e.pointerId)) return;
    s.pts.delete(e.pointerId);
    if (s.pts.size) return;
    clearTimeout(s.long);
    if (!control) return;
    if (s.two) {
      if (s.kind === "?" && Date.now() - s.t2 < 300)
        clickAndKb(
          mode === "mouse" ? curRef.current : at(s.m0.x + box.current!.getBoundingClientRect().left, s.m0.y + box.current!.getBoundingClientRect().top),
          "right",
        );
      return;
    } // two-finger tap = right click
    if (s.moved) {
      if (mode === "mouse") send({ t: "move", ...curRef.current });
      return;
    }
    if (Date.now() - s.t0 < 550) clickAndKb(mode === "mouse" ? curRef.current : at(e.clientX, e.clientY));
  };

  // ---- fullscreen (real Fullscreen API where the browser has it; iPhone uses the widget's own full-screen view) ----
  const [isFs, setIsFs] = useState(false);
  const fsOk = typeof document !== "undefined" && !!document.fullscreenEnabled;
  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else box.current?.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
  };

  const [panel, setPanel] = useState<"" | "clip" | "q">("");
  const [pasteText, setPasteText] = useState("");
  const [tools, setTools] = useState(false);
  const small = size.w < 300;

  if (state === "asleep" || state === "loading")
    return (
      <div className="absolute inset-0">
        <SleepScreen onWake={wake} />
      </div>
    );
  if (state === "busy")
    return (
      <div className="absolute inset-0 grid place-items-center bg-black p-4 text-center text-xs text-ink-300">
        <div>
          {busyMsg || "Reel’s computer is being used by another creator right now."}
          <div className="mt-1 text-ink-500">Each account gets its own private desktop — yours opens as soon as it’s free.</div>
          <button className="btn-outline mt-3 h-7 px-2 text-xs" onClick={wake}>
            Try again
          </button>
        </div>
      </div>
    );
  if (state === "starting") return <div className="absolute inset-0 grid place-items-center bg-black text-xs text-ink-400">Waking up Reel’s computer…</div>;
  if (state !== "awake")
    return (
      <div className="absolute inset-0 grid place-items-center bg-black p-4 text-center text-xs text-ink-400">
        The desktop service isn’t running.
        <button className="btn-outline ml-2 h-7 px-2 text-xs" onClick={wake}>
          Retry
        </button>
      </div>
    );
  const showCur = has && !mouseIn && (mode === "mouse" || control || glide);
  const chip = "grid h-7 min-w-7 place-items-center rounded-full bg-black/55 px-1.5 text-white/85 ring-1 ring-white/10 backdrop-blur hover:text-white";
  const linkLabel =
    link === "live" ? (degraded ? "Slow link" : "Live") : link === "http" ? "Fallback" : link === "reconnecting" ? "Reconnecting…" : "Connecting…";
  return (
    <div
      ref={box}
      className={`absolute inset-0 select-none overflow-hidden bg-black ${control ? "ring-2 ring-inset ring-brand-400/60" : ""}`}
      style={{ touchAction: control || zoomed ? "none" : "auto", cursor: control ? "default" : "auto" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        g.current.pts.clear();
        clearTimeout(g.current.long);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && control) setMouseIn(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setMouseIn(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={(e) => {
        if (!control && !(e.target as Element).closest("[data-ui]")) resetView();
      }}
    >
      <div ref={stage} className="pointer-events-none absolute" style={{ left: G.left, top: G.top, width: G.sw, height: G.sh }}>
        <canvas
          ref={cv}
          width={RW}
          height={RH}
          aria-label="Reel’s desktop"
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: G.sc * dpr >= 1.75 ? "pixelated" : "auto", opacity: has ? 1 : 0 }}
        />
        {showCur && (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="absolute -ml-[3px] -mt-[2px] h-5 w-5 drop-shadow-[0_1px_1px_rgba(0,0,0,.6)] will-change-[left,top]"
            style={{ left: `${cur.x * 100}%`, top: `${cur.y * 100}%`, transition: glide ? "left 120ms linear, top 120ms linear" : "none" }}
          >
            <path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {!has && <p className="absolute inset-0 grid place-items-center text-xs text-ink-400">{link === "reconnecting" ? "Reconnecting…" : "Connecting…"}</p>}
      {/* status + view tools (top-left; the mode/keyboard toggle lives top-right) */}
      {!small && (
        <div data-ui className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[10px] font-medium" onPointerDown={(e) => e.stopPropagation()}>
          <button
            aria-label={tools ? "Hide view tools" : "Show view tools"}
            aria-expanded={tools}
            {...tap(() => {
              setTools(!tools);
              setPanel("");
            })}
            title={rtt != null && link === "live" ? `${rtt} ms round trip · tap for view tools` : linkLabel}
            className={`flex h-7 items-center gap-1 rounded-full px-2 ring-1 ring-white/10 backdrop-blur ${link === "live" && !degraded ? "bg-black/55 text-emerald-300" : "bg-black/55 text-amber-300"}`}
          >
            <i className={`h-1.5 w-1.5 rounded-full ${link === "live" && !degraded ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`} />
            {linkLabel}
            {link === "live" && rtt != null && tools && <span className="text-white/50">{rtt}ms</span>}
          </button>
          {tools && (
            <>
              <button
                aria-label={view.one ? "Fit to window" : "Actual size (1:1)"}
                title={view.one ? "Fit to window" : "Actual size (1:1)"}
                {...tap(() => resetView(!view.one))}
                className={chip}
              >
                {view.one ? "Fit" : "1:1"}
              </button>
              {zoomed && !view.one && (
                <button aria-label="Reset zoom" title="Reset zoom" {...tap(() => resetView())} className={chip}>
                  <ScanSearch className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                aria-label="Stream quality"
                title={`Quality: ${quality}`}
                aria-expanded={panel === "q"}
                {...tap(() => setPanel(panel === "q" ? "" : "q"))}
                className={chip}
              >
                <Gauge className="h-3.5 w-3.5" />
              </button>
              {control && (
                <button
                  aria-label="Clipboard"
                  title="Clipboard"
                  aria-expanded={panel === "clip"}
                  {...tap(() => setPanel(panel === "clip" ? "" : "clip"))}
                  className={`${chip} ${clip && !clip.copied ? "ring-brand-400" : ""}`}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
              )}
              {fsOk && (
                <button
                  aria-label={isFs ? "Exit full screen" : "Full screen"}
                  title={isFs ? "Exit full screen" : "Full screen"}
                  {...tap(toggleFs)}
                  className={chip}
                >
                  {isFs ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {panel === "q" && (
        <div
          data-ui
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-1.5 top-10 w-44 rounded-xl bg-ink-900/95 p-1 text-[11px] text-white ring-1 ring-white/10 backdrop-blur"
        >
          {(
            [
              ["auto", "Auto", "adapts to your connection"],
              ["sharp", "Sharp", "crisp text, more data"],
              ["fast", "Fast", "smoothest on slow links"],
            ] as const
          ).map(([v, l, d]) => (
            <button
              key={v}
              {...tap(() => {
                setQuality(v);
                setPanel("");
              })}
              className={`block w-full rounded-lg px-2 py-1.5 text-left ${quality === v ? "bg-white/15" : "hover:bg-white/10"}`}
            >
              <b>{l}</b> <span className="text-white/50">{d}</span>
            </button>
          ))}
        </div>
      )}
      {panel === "clip" && control && (
        <div
          data-ui
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-1.5 top-10 w-64 max-w-[calc(100%-12px)] space-y-1.5 rounded-xl bg-ink-900/95 p-2 text-[11px] text-white ring-1 ring-white/10 backdrop-blur"
        >
          <p className="text-white/60">Paste into Reel’s computer</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={2}
            style={{ fontSize: 16 }}
            className="w-full resize-none rounded-lg bg-black/50 px-2 py-1 text-[13px] outline-none ring-1 ring-white/10 focus:ring-brand-400"
            placeholder="Text to paste…"
          />
          <div className="flex gap-1">
            <button
              {...tap(async () => {
                let t = pasteText;
                if (!t) t = (await navigator.clipboard?.readText?.().catch(() => "")) || "";
                if (t) {
                  send({ t: "paste", text: t });
                  setPasteText("");
                  setPanel("");
                }
              })}
              className="btn-brand h-7 flex-1 px-2 text-[11px]"
            >
              {pasteText ? "Paste" : "Paste my clipboard"}
            </button>
          </div>
          {clip && (
            <>
              <p className="pt-1 text-white/60">Copied on Reel’s computer</p>
              <p className="max-h-16 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 px-2 py-1 text-white/80">{clip.text.slice(0, 400)}</p>
              <button
                {...tap(() =>
                  navigator.clipboard?.writeText(clip.text).then(
                    () => setClip({ ...clip, copied: true }),
                    () => {},
                  ),
                )}
                className="btn-outline h-7 w-full px-2 text-[11px]"
              >
                {clip.copied ? "Copied to this device ✓" : "Copy to this device"}
              </button>
            </>
          )}
        </div>
      )}
      {control && clip && !clip.copied && panel !== "clip" && (
        <button
          data-ui
          {...tap(() =>
            navigator.clipboard?.writeText(clip.text).then(
              () => setClip({ ...clip, copied: true }),
              () => setPanel("clip"),
            ),
          )}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/90 px-3 py-1 text-[11px] text-white ring-1 ring-brand-400/60"
        >
          Copied on Reel’s computer — tap to copy here
        </button>
      )}
      {control && kbs.hint && !kbs.open && (
        <button
          {...tap(() => openKb(true))}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ink-900/90 px-2.5 py-1 text-[11px] text-white ring-1 ring-brand-400/60"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Tap to type
        </button>
      )}
      <input
        ref={kb}
        aria-label="Keyboard for Reel’s computer"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        tabIndex={-1}
        onFocus={() => kbBus.set({ open: true, hint: false })}
        onBlur={() => kbBus.set({ open: false, auto: false })}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "v") return; // let the paste event carry the local clipboard
          const k = combo(e);
          if (k) {
            e.preventDefault();
            send({ t: "key", key: k });
          }
        }}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          e.preventDefault();
          if (t) send({ t: "paste", text: t });
          else send({ t: "key", key: "ctrl+v" });
        }}
        onInput={(e) => {
          const t = e.currentTarget;
          const v = t.value;
          t.value = "";
          if (v) send({ t: "type", text: v });
        }}
      />
    </div>
  );
}
