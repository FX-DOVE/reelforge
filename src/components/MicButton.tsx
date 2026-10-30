"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

const MAX = 60;
const pickType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/webm", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
};

/** Voice input: tap to record, tap to stop → Meta wav2vec2 on our own server → text handed to onText. */
export function MicButton({ onText, onSend, className = "", dark = true }: { onText: (t: string) => void; onSend?: (t: string) => void; className?: string; dark?: boolean }) {
  const [st, setSt] = useState<"idle" | "rec" | "busy">("idle");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), stream = useRef<MediaStream | null>(null);
  const cv = useRef<HTMLCanvasElement>(null), raf = useRef(0), timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined), ctx = useRef<AudioContext | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => { setSupported(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"); return () => cleanup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 4000); return () => clearTimeout(t); }, [err]);

  const cleanup = () => { cancelAnimationFrame(raf.current); clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; ctx.current?.close().catch(() => {}); ctx.current = null; };

  const draw = (an: AnalyserNode) => {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!; const d = new Uint8Array(an.fftSize);
    const loop = () => {
      an.getByteTimeDomainData(d); g.clearRect(0, 0, c.width, c.height); const n = 18, w = c.width / n;
      for (let i = 0; i < n; i++) { let m = 0; for (let j = 0; j < 32; j++) m = Math.max(m, Math.abs(d[(i * 32 + j) % d.length] - 128)); const h = Math.max(3, (m / 128) * c.height * 1.6); g.fillStyle = "#0071e3"; g.beginPath(); g.roundRect(i * w + w * 0.25, (c.height - Math.min(h, c.height)) / 2, w * 0.5, Math.min(h, c.height), 2); g.fill(); }
      raf.current = requestAnimationFrame(loop);
    }; loop();
  };

  const start = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); stream.current = s;
      const type = pickType(); const r = new MediaRecorder(s, type ? { mimeType: type } : undefined); rec.current = r; chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => upload(new Blob(chunks.current, { type: r.mimeType || type || "audio/webm" }));
      r.start(250); setSt("rec"); setSecs(0); const t0 = Date.now();
      timer.current = setInterval(() => { const x = Math.floor((Date.now() - t0) / 1000); setSecs(x); if (x >= MAX) stop(); }, 250);
      try { const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const a = new A(); ctx.current = a; const an = a.createAnalyser(); an.fftSize = 1024; a.createMediaStreamSource(s).connect(an); requestAnimationFrame(() => draw(an)); } catch { /* waveform optional */ }
    } catch { setErr("Allow microphone access to talk to Reel."); cleanup(); setSt("idle"); }
  };
  const stop = () => { if (rec.current?.state === "recording") { rec.current.stop(); setSt("busy"); } cleanup(); };

  const upload = async (b: Blob) => {
    setSt("busy");
    try {
      const fd = new FormData(); fd.append("audio", b, "voice." + (b.type.includes("mp4") || b.type.includes("aac") ? "m4a" : b.type.includes("ogg") ? "ogg" : "webm"));
      const r = await fetch("/api/transcribe", { method: "POST", body: fd }); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't transcribe that.");
      const t = String(j.text || "").trim(); if (!t) throw new Error("I didn't catch that. Try again a bit closer to the mic.");
      if (onSend && localStorage.getItem("rf-voice-autosend") === "1") onSend(t); else onText(t);
    } catch (e) { setErr((e as Error).message); } finally { setSt("idle"); }
  };

  if (!supported) return null;
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className={`relative flex shrink-0 items-center ${className}`}>
      {st === "rec" && <div className="mr-1 flex items-center gap-1.5 rounded-full px-2 py-1" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,113,227,.08)" }}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /><canvas ref={cv} width={72} height={20} className="h-5 w-[72px]" /><span className={`text-xs tabular-nums ${dark ? "text-ink-300" : "text-[#1d1d1f]"}`}>{mm}</span>
      </div>}
      <button type="button" data-t="mic" aria-label={st === "rec" ? "Stop recording" : st === "busy" ? "Transcribing" : "Talk instead of typing"} disabled={st === "busy"} onClick={() => (st === "rec" ? stop() : start())}
        className={`m-1 grid h-8 w-8 place-items-center rounded-full transition ${st === "rec" ? "bg-red-500 text-white" : dark ? "text-ink-400 hover:bg-white/5 hover:text-white" : "text-[#6e6e73] hover:bg-black/5 hover:text-[#1d1d1f]"}`}>
        {st === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : st === "rec" ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-[18px] w-[18px]" />}
      </button>
      {err && <div role="status" className="absolute bottom-full right-0 mb-2 w-56 rounded-xl px-3 py-2 text-xs shadow-lg" style={{ background: "#fff", color: "#1d1d1f", border: "1px solid rgba(0,0,0,.08)" }}>{err}</div>}
    </div>
  );
}
