"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated SAT score dial — counts a ring + number up to `target` on first view.
 * Honors prefers-reduced-motion.
 */
export default function ScoreGauge({
  target = 1520,
  max = 1600,
}: {
  target?: number;
  max?: number;
}) {
  const [val, setVal] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const dur = 1900;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  const r = 78;
  const C = 2 * Math.PI * r;
  const pct = Math.min(1, val / max);
  const offset = C * (1 - pct);

  return (
    <div ref={wrapRef} className="relative grid place-items-center">
      {/* conic glow */}
      <div
        aria-hidden
        className="spin-slow absolute h-[260px] w-[260px] rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(37,99,235,0.35), rgba(245,158,11,0.30), rgba(37,99,235,0.35))",
        }}
      />
      <svg viewBox="0 0 200 200" className="relative h-56 w-56 -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
          Target
        </span>
        <span className="font-display text-6xl font-semibold tabular-nums text-slate-900">
          {val}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
          / {max}
        </span>
      </div>
    </div>
  );
}
