"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, MoreHorizontal, Plus, Shuffle, Trash2 } from "lucide-react";
import { Bot, Mascot } from "./Mascot";
import { BOT_ACC, BOT_EYES, BOT_PALETTES, BOT_SHAPES, botFor, randomBot, type BotStyle } from "@/lib/botStyle";
import type { AgentLite } from "./AgentChat";

const COLORS = ["#0071e3", "#af52de", "#ff9500", "#34c759", "#ff2d55", "#5ac8fa", "#5856d6", "#a2845e"];
const call = (u: string, m: string, b?: unknown) =>
  fetch(u, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });

function Dot({ a, size = 36, bot }: { a?: AgentLite; size?: number; bot?: BotStyle }) {
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <Bot size={size * 0.92} style={bot || (a ? botFor(a.id, a.bot) : undefined)} />
    </span>
  );
}

const LBL: Record<string, string> = {
  round: "Round",
  tall: "Tall",
  cube: "Cube",
  retro: "Retro",
  glow: "Glow",
  happy: "Happy",
  visor: "Visor",
  pixel: "Pixel",
  sleepy: "Sleepy",
  none: "None",
  headphones: "Headphones",
  cap: "Director’s cap",
  beret: "Beret",
  twin: "Twin antenna",
  bow: "Bow",
  halo: "Halo",
};
function StylePicker({ v, set }: { v: BotStyle; set: (b: BotStyle) => void }) {
  const chips = <K extends "shape" | "eyes" | "acc">(k: K, opts: readonly BotStyle[K][]) => (
    <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {opts.map((o) => (
        <button
          type="button"
          key={o}
          data-t={`bot-${k}-${o}`}
          onClick={() => set({ ...v, [k]: o })}
          className={`flex shrink-0 flex-col items-center rounded-2xl border px-2 pb-1.5 pt-1 text-[11px] ${v[k] === o ? "border-[#0071e3] bg-[#f0f7ff] text-[#0071e3]" : "border-[#e5e5ea] text-[#6e6e73]"}`}
        >
          <Bot size={34} style={{ ...v, [k]: o }} />
          {LBL[o]}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-2" data-t="bot-picker">
      <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-b from-[#f5f5f7] to-[#fff] p-3">
        <Mascot size={86} bot={v} />
        <div className="flex-1 text-sm text-[#6e6e73]">
          Pick a look for this agent. Hover or tap it to say hi.
          <button
            type="button"
            data-t="bot-shuffle"
            onClick={() => set(randomBot())}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-[#fff] px-3 py-1.5 text-[13px] font-medium text-[#0071e3] shadow-sm ring-1 ring-[#e5e5ea]"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle
          </button>
        </div>
      </div>
      <div className="text-sm text-[#6e6e73]">Body{chips("shape", BOT_SHAPES)}</div>
      <div className="text-sm text-[#6e6e73]">
        Colours
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          {BOT_PALETTES.map((p, i) => (
            <button
              type="button"
              key={p.name}
              aria-label={p.name}
              data-t={`bot-pal-${i}`}
              onClick={() => set({ ...v, palette: i })}
              className={`h-8 w-8 rounded-full ring-offset-2 ${v.palette === i ? "ring-2 ring-[#0071e3]" : "ring-1 ring-[#e5e5ea]"}`}
              style={{ background: `linear-gradient(135deg, ${p.body[1]} 50%, ${p.acc[0]} 50%)` }}
            />
          ))}
        </div>
      </div>
      <div className="text-sm text-[#6e6e73]">Eyes{chips("eyes", BOT_EYES)}</div>
      <div className="text-sm text-[#6e6e73]">Accessory{chips("acc", BOT_ACC)}</div>
    </div>
  );
}

/** Agent switcher inside the Reel chat: a light bottom sheet on phones, a popover under the header on desktop. */
export function AgentSwitcher({
  open,
  onClose,
  agents,
  current,
  onPick,
  onNew,
  onChange,
  mobile,
  editId,
  onEdited,
}: {
  editId?: string | null;
  onEdited?: () => void;
  open: boolean;
  onClose: () => void;
  agents: AgentLite[];
  current?: string;
  onPick: (a: AgentLite | null) => void;
  onNew: () => void;
  onChange: () => Promise<unknown>;
  mobile: boolean;
}) {
  const [edit, setEdit] = useState<AgentLite | null>(null);
  const [f, setF] = useState<{ title: string; color: string; topic: string; bot: BotStyle }>({ title: "", color: COLORS[0], topic: "", bot: randomBot() });
  const [isNew, setIsNew] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startEdit = (a: AgentLite, fresh = false) => {
    setIsNew(fresh);
    setEdit(a);
    setF({ title: a.title, color: a.color || COLORS[0], topic: a.topic || "", bot: botFor(a.id, a.bot) });
  };
  useEffect(() => {
    if (!open || !editId) return;
    const a = agents.find((x) => x.id === editId);
    if (a) {
      startEdit(a, true);
      onEdited?.();
    }
  }, [open, editId, agents]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!edit || !f.title.trim()) return;
    await call(`/api/chats/${edit.id}`, "PATCH", { title: f.title.trim().slice(0, 80), color: f.color, topic: f.topic.trim().slice(0, 200), bot: f.bot });
    const fresh = isNew;
    setEdit(null);
    setIsNew(false);
    await onChange();
    if (fresh) onClose();
  };
  const del = async () => {
    if (!edit || !confirm(`Delete “${edit.title}” and its history?`)) return;
    await call(`/api/chats/${edit.id}`, "DELETE");
    if (edit.id === current) onPick(null);
    setEdit(null);
    await onChange();
  };
  const close = () => {
    setEdit(null);
    onClose();
  };
  const row = (a: AgentLite | null) => {
    const on = (a?.id || undefined) === current;
    return (
      <div
        key={a?.id || "reel"}
        className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${on ? "bg-[#f2f2f7]" : "active:bg-[#f2f2f7] md:hover:bg-[#f5f5f7]"}`}
      >
        <button
          data-t="agent-row"
          className="flex min-w-0 flex-1 select-none items-center gap-3 text-left [-webkit-touch-callout:none]"
          onClick={() => onPick(a)}
          onPointerDown={() => {
            if (a)
              press.current = setTimeout(() => {
                press.current = null;
                startEdit(a);
              }, 500);
          }}
          onPointerUp={() => press.current && clearTimeout(press.current)}
          onPointerLeave={() => press.current && clearTimeout(press.current)}
          onContextMenu={(e) => {
            if (a) {
              e.preventDefault();
              startEdit(a);
            }
          }}
        >
          <Dot a={a || undefined} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-medium text-[#1d1d1f]">{a?.title || "Reel"}</span>
            <span className="block truncate text-xs text-[#86868b]">{a ? a.topic || "Producer" : "Default · Producer"}</span>
          </span>
          {on && <Check className="h-4 w-4 shrink-0 text-[#0071e3]" />}
        </button>
        {a && (
          <button
            aria-label={`Edit ${a.title}`}
            data-t="agent-more"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#86868b] hover:bg-[#e8e8ed]"
            onClick={() => startEdit(a)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="absolute inset-0 z-10 bg-[#000]/20 md:bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-label="Your agents"
            data-t="agent-sheet"
            initial={mobile ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={mobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={mobile ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className={`absolute z-20 flex flex-col bg-[#fff] text-[#1d1d1f] ${mobile ? "inset-x-0 bottom-0 max-h-[78%] rounded-t-[28px] pb-safe shadow-[0_-12px_40px_rgba(0,0,0,.12)]" : "left-3 right-3 top-[60px] max-h-[70%] rounded-3xl border border-[#e5e5ea] shadow-[0_24px_60px_-12px_rgba(0,0,0,.25)]"}`}
          >
            {mobile && <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[#d1d1d6]" />}
            {!edit ? (
              <div className="flex min-h-0 flex-col p-3">
                <button
                  data-t="agent-new-sheet"
                  onClick={onNew}
                  className="mb-2 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0071e3] text-[15px] font-semibold text-[#fff] active:scale-[.98]"
                >
                  <Plus className="h-5 w-5" />
                  New agent
                </button>
                <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-[#86868b]">Your agents</p>
                <div className="min-h-0 overflow-y-auto overscroll-contain">
                  {row(null)}
                  {agents.map(row)}
                </div>
                <p className="px-2 pt-2 text-center text-[11px] text-[#86868b]">Press and hold or tap ··· to rename, recolour or delete</p>
              </div>
            ) : (
              <form
                className="space-y-3 overflow-y-auto p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <div className="flex items-center gap-3">
                  <p className="text-[17px] font-semibold">{isNew ? "Meet your new agent" : "Edit agent"}</p>
                </div>
                <StylePicker v={f.bot} set={(bot) => setF({ ...f, bot })} />
                <label className="block text-sm text-[#6e6e73]">
                  Name
                  <input
                    data-t="agent-name"
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] bg-[#fff] px-3 py-2.5 text-[16px] text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  />
                </label>
                <div className="text-sm text-[#6e6e73]">
                  Colour
                  <div className="mt-1.5 flex flex-wrap gap-2.5">
                    {COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        aria-label={c}
                        onClick={() => setF({ ...f, color: c })}
                        className={`h-8 w-8 rounded-full ring-offset-2 ${f.color === c ? "ring-2 ring-[#1d1d1f]" : ""}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <label className="block text-sm text-[#6e6e73]">
                  Topic (optional)
                  <input
                    data-t="agent-topic"
                    value={f.topic}
                    onChange={(e) => setF({ ...f, topic: e.target.value })}
                    placeholder="e.g. Wildlife documentaries"
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] bg-[#fff] px-3 py-2.5 text-[16px] text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEdit(null)} className="h-11 flex-1 rounded-full bg-[#f2f2f7] text-[15px] font-medium">
                    Cancel
                  </button>
                  <button data-t="agent-save" className="h-11 flex-1 rounded-full bg-[#0071e3] text-[15px] font-semibold text-[#fff]">
                    Save
                  </button>
                </div>
                <button
                  type="button"
                  onClick={del}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-[#ff3b30] hover:bg-[#fff1f0]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete agent
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
