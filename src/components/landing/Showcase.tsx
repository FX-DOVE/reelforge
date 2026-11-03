"use client";
import { useState } from "react";
import { Play, X } from "lucide-react";

/** Landing showcase: short muted loops cut from a finished ReelForge drama, plus a player for the full film.
 *  Media streams from /api/landing/* (R2 "landing/" prefix). */
const L = (f: string) => `/api/landing/${f}`;
const CLIPS = [
  { v: "clip-1.mp4", p: "clip-1.jpg", t: "The Gala" },
  { v: "clip-2.mp4", p: "clip-2.jpg", t: "The Rooftop" },
  { v: "clip-3.mp4", p: "clip-3.jpg", t: "The Suite" },
  { v: "clip-4.mp4", p: "clip-4.jpg", t: "The Heiress" },
];

export function Showcase() {
  const [open, setOpen] = useState(false);
  return (
    <section id="showcase" className="mx-auto max-w-7xl scroll-mt-20 px-5 pt-20 sm:px-8 sm:pt-28">
      <h2 className="text-center text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">One idea. A whole drama.</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-ink-400">
        A nine-minute vertical drama, made end to end in ReelForge. Here are a few moments.
      </p>
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CLIPS.map((c) => (
          <button
            key={c.v}
            onClick={() => setOpen(true)}
            className="group relative aspect-[9/16] overflow-hidden rounded-3xl bg-ink-900 text-left"
            aria-label={`Watch the full film: ${c.t}`}
          >
            <video
              data-showcase
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              src={L(c.v)}
              poster={L(c.p)}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm font-medium text-white">{c.t}</span>
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-base font-medium text-ink-950 hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Watch the full film
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
          <video
            className="max-h-[90svh] max-w-full rounded-2xl"
            src={L("full.mp4")}
            poster={L("full.jpg")}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
