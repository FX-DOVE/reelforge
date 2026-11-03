"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Box of a floating window in viewport px. */
export type Box = { x: number; y: number; w: number; h: number };
const KEY = "rf-chat-box";
const MIN_W = 340,
  MIN_H = 420,
  M = 8; // margin kept from the viewport edge

/** Default: bottom-right, 520 wide, up to 760 tall (matches the old fixed layout). */
function defaults(): Box {
  const w = Math.min(520, innerWidth - 2 * M - 16),
    h = Math.min(760, innerHeight - 48);
  return { x: innerWidth - w - 24, y: innerHeight - h - 24, w, h };
}
/** Clamp a box so it fits fully inside the viewport. */
function clamp(b: Box): Box {
  const w = Math.max(Math.min(MIN_W, innerWidth - 2 * M), Math.min(b.w, innerWidth - 2 * M));
  const h = Math.max(Math.min(MIN_H, innerHeight - 2 * M), Math.min(b.h, innerHeight - 2 * M));
  return { w, h, x: Math.min(Math.max(M, b.x), innerWidth - w - M), y: Math.min(Math.max(M, b.y), innerHeight - h - M) };
}

/** Which edges a resize handle moves. */
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Draggable + resizable floating window state, persisted in localStorage. Disabled (returns null box) when `enabled` is false (mobile). */
export function useFloatBox(enabled: boolean) {
  const [box, setBox] = useState<Box | null>(null);
  const live = useRef<Box | null>(null);
  live.current = box;

  // Load the saved box (or default) when enabled; keep it in bounds on window resize.
  useEffect(() => {
    if (!enabled) return setBox(null);
    let saved: Box | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {}
    setBox(clamp(saved && saved.w ? saved : defaults()));
    const onResize = () => setBox((b) => (b ? clamp(b) : b));
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [enabled]);

  // Shared pointer-drag helper: `apply` maps the pointer delta onto the starting box.
  const track = useCallback((e: React.PointerEvent, apply: (s: Box, dx: number, dy: number) => Box, cursor: string) => {
    if (!live.current || e.button > 0) return;
    e.preventDefault();
    const s = live.current,
      x0 = e.clientX,
      y0 = e.clientY;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => setBox(clamp(apply(s, ev.clientX - x0, ev.clientY - y0)));
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      document.body.style.cursor = document.body.style.userSelect = "";
      if (live.current) localStorage.setItem(KEY, JSON.stringify(live.current));
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }, []);

  /** Header drag: ignore presses that start on buttons/inputs/links so they stay clickable. */
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,a,input,textarea,select,[role=button]")) return;
    track(e, (s, dx, dy) => ({ ...s, x: s.x + dx, y: s.y + dy }), "grabbing");
  };

  /** Edge/corner resize; the opposite edge stays put, size respects the minimum. */
  const onResizeStart = (edge: Edge) => (e: React.PointerEvent) =>
    track(
      e,
      (s, dx, dy) => {
        const b = { ...s };
        if (edge.includes("e")) b.w = Math.max(MIN_W, s.w + dx);
        if (edge.includes("s")) b.h = Math.max(MIN_H, s.h + dy);
        if (edge.includes("w")) {
          b.w = Math.max(MIN_W, s.w - dx);
          b.x = s.x + s.w - b.w;
        }
        if (edge.includes("n")) {
          b.h = Math.max(MIN_H, s.h - dy);
          b.y = s.y + s.h - b.h;
        }
        return b;
      },
      `${edge}-resize`,
    );

  /** Reset to the default position and size. */
  const reset = () => {
    localStorage.removeItem(KEY);
    setBox(clamp(defaults()));
  };

  return { box, onDragStart, onResizeStart, reset };
}

/** Invisible hit areas for each edge and corner. */
export const EDGES: { edge: Edge; cls: string }[] = [
  { edge: "n", cls: "top-0 inset-x-3 h-1.5 cursor-n-resize" },
  { edge: "s", cls: "bottom-0 inset-x-3 h-1.5 cursor-s-resize" },
  { edge: "w", cls: "left-0 inset-y-3 w-1.5 cursor-w-resize" },
  { edge: "e", cls: "right-0 inset-y-3 w-1.5 cursor-e-resize" },
  { edge: "nw", cls: "left-0 top-0 h-3 w-3 cursor-nw-resize" },
  { edge: "ne", cls: "right-0 top-0 h-3 w-3 cursor-ne-resize" },
  { edge: "sw", cls: "left-0 bottom-0 h-3 w-3 cursor-sw-resize" },
  { edge: "se", cls: "right-0 bottom-0 h-4 w-4 cursor-se-resize" },
];
