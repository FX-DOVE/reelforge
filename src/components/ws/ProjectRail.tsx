"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { ArrowLeft, ChevronsLeft, ChevronsRight, Settings2, Workflow, X } from "lucide-react";
import { StatusPill } from "../AppShell";

// Width limits (px) for the drag-to-resize edge, and the icon-only width.
const MIN = 200,
  MAX = 380,
  ICONS = 68;
const KEY = "rf-rail"; // localStorage key: { w, collapsed }

type Tab = { id: string; label: string; icon: ComponentType<{ className?: string }> };

/** Project left rail: fixed to the viewport, collapsible to icons, resizable by its edge, and a slide-in drawer on mobile. */
export function ProjectRail({
  title,
  tabs,
  tab,
  setTab,
  counts,
  badges,
  onPipeline,
  onSettings,
  mobileOpen,
  setMobileOpen,
}: {
  title: string;
  tabs: readonly Tab[];
  tab: string;
  setTab: (id: string) => void;
  counts: Record<string, string | number>;
  badges: string[];
  onPipeline: () => void;
  onSettings: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const [w, setW] = useState(232);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef(false);

  // Restore the saved width / collapsed state once on mount.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (typeof s.w === "number") setW(Math.min(MAX, Math.max(MIN, s.w)));
      if (typeof s.collapsed === "boolean") setCollapsed(s.collapsed);
    } catch {}
  }, []);
  // Persist on every change.
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ w, collapsed }));
  }, [w, collapsed]);

  // Drag the right edge to resize (pointer events cover mouse + touch).
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = true;
    const move = (ev: PointerEvent) => drag.current && setW(Math.min(MAX, Math.max(MIN, ev.clientX)));
    const up = () => {
      drag.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const width = collapsed ? ICONS : w;

  // Shared rail body; `mini` = icons only with tooltips.
  const body = (mini: boolean, mobile = false) => (
    <>
      <div className={`flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] ${mini ? "justify-center px-2" : "px-4"}`}>
        <Link href="/dashboard" className="btn-ghost h-8 w-8 shrink-0 px-0" aria-label="Back to projects" title="Back to projects">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {!mini && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>}
        {mobile && (
          <button className="btn-ghost h-8 w-8 px-0" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className={`flex flex-col gap-1 ${mini ? "items-center p-2" : "overflow-y-auto p-3"}`}>
        {tabs.map((t, i) => {
          const on = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              title={mini ? t.label : undefined}
              aria-label={t.label}
              onClick={() => {
                setTab(t.id);
                setMobileOpen(false);
              }}
              className={`group relative flex h-10 items-center gap-3 rounded-xl text-sm transition ${mini ? "w-11 justify-center" : "px-3"} ${on ? "bg-white/[0.08] text-white" : "text-ink-300 hover:bg-white/[0.04] hover:text-white"}`}
            >
              {mini ? (
                <Icon className={`h-[18px] w-[18px] ${on ? "text-brand-400" : ""}`} />
              ) : (
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold ${on ? "bg-brand-500 text-ink-950" : "bg-white/[0.06]"}`}
                >
                  {i + 1}
                </span>
              )}
              {!mini && <span className="flex-1 truncate text-left">{t.label}</span>}
              {!mini && counts[t.id] !== "" && <span className="text-xs text-ink-400">{counts[t.id]}</span>}
              {mini && <Tip text={t.label} />}
            </button>
          );
        })}
        <button
          onClick={() => {
            onPipeline();
            setMobileOpen(false);
          }}
          aria-label="Pipeline"
          className={`group relative mt-2 flex h-10 items-center gap-3 rounded-xl text-sm text-ink-300 transition hover:bg-white/[0.04] hover:text-white ${mini ? "w-11 justify-center" : "px-3"}`}
        >
          <Workflow className="h-4 w-4 shrink-0 text-sky-300" />
          {!mini && <span className="flex-1 text-left">Pipeline</span>}
          {!mini && <span className="text-[10px] text-sky-300">Built with Meta</span>}
          {mini && <Tip text="Pipeline · Built with Meta" />}
        </button>
      </nav>
      <div className={`mt-auto space-y-3 border-t border-white/[0.06] text-xs text-ink-400 ${mini ? "flex flex-col items-center p-2" : "p-4"}`}>
        {!mini && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span key={b} className="badge bg-white/[0.06] text-ink-300">
                {b}
              </span>
            ))}
          </div>
        )}
        <button
          className={`group relative btn-outline h-9 ${mini ? "w-11 px-0" : "w-full"}`}
          onClick={() => {
            onSettings();
            setMobileOpen(false);
          }}
          aria-label="Project settings"
        >
          <Settings2 className="h-4 w-4" /> {!mini && "Project settings"}
          {mini && <Tip text="Project settings" />}
        </button>
        {!mini && <StatusPill />}
        {!mobile && (
          <button
            className={`group relative btn-ghost h-8 text-ink-400 ${mini ? "w-11 px-0" : "w-full justify-start"}`}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {mini ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!mini && <span>Collapse</span>}
            {mini && <Tip text="Expand sidebar" />}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Spacer keeps page content beside the fixed rail (desktop). */}
      <div className="hidden shrink-0 lg:block" style={{ width }} aria-hidden />
      <aside className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.06] bg-ink-900/95 backdrop-blur lg:flex" style={{ width }}>
        {body(collapsed)}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={startDrag}
            onDoubleClick={() => setW(232)}
            className="absolute inset-y-0 -right-1 w-2 cursor-col-resize hover:bg-brand-500/30"
          />
        )}
      </aside>
      {/* Mobile / tablet: the same rail as a slide-in drawer. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-white/[0.06] bg-ink-900">{body(false, true)}</aside>
        </div>
      )}
    </>
  );
}

/** Hover tooltip shown to the right of an icon-only rail button. */
function Tip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100">
      {text}
    </span>
  );
}
