"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, ChevronRight, Loader2 } from "lucide-react";

// Desmos graphing calculator (same engine the real Digital SAT embeds).
// The default key is Desmos's public demo key; override in production via
// NEXT_PUBLIC_DESMOS_API_KEY.
const DESMOS_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || "dcb31709b452b1cf9dc26972add0fda6";
const DESMOS_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_KEY}`;

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        el: HTMLElement,
        opts?: Record<string, unknown>,
      ) => { destroy: () => void };
    };
  }
}

let desmosPromise: Promise<void> | null = null;

function loadDesmos(): Promise<void> {
  if (typeof window !== "undefined" && window.Desmos) return Promise.resolve();
  if (desmosPromise) return desmosPromise;
  desmosPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = DESMOS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { desmosPromise = null; reject(new Error("Failed to load calculator")); };
    document.head.appendChild(s);
  });
  return desmosPromise;
}

export default function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let calc: { destroy: () => void } | null = null;
    let cancelled = false;
    loadDesmos()
      .then(() => {
        if (cancelled || !mountRef.current || !window.Desmos) return;
        calc = window.Desmos.GraphingCalculator(mountRef.current, {
          keypad: true,
          expressions: true,
          settingsMenu: false,
          border: false,
          lockViewport: false,
        });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      try { calc?.destroy(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-[440px] max-w-[95vw] flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Calculator className="h-4 w-4" /> Calculator
        </span>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="relative flex-1">
        <div ref={mountRef} className="absolute inset-0" />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-white text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              <span className="text-sm">Loading calculator…</span>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-white px-6 text-center text-slate-500">
            <p className="text-sm">Calculator couldn&rsquo;t load. Check your connection and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
