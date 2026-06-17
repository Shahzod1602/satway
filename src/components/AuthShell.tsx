"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Brain, Calculator, BookOpen, Flag, Check } from "lucide-react";
import ScoreGauge from "@/components/landing/ScoreGauge";

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-extrabold tracking-tight ${className}`}>
      SAT<span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
    </span>
  );
}

const STATS = [
  { icon: Brain, label: "Adaptive Module 2" },
  { icon: Calculator, label: "Built-in Desmos" },
  { icon: BookOpen, label: "1,000+ practice tests" },
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className="min-h-screen bg-[#FBFAF7] lg:grid lg:grid-cols-2">
      {/* ───────── Left: branded showcase (desktop) ───────── */}
      <aside className="relative hidden overflow-hidden bg-slate-900 p-12 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dotgrid opacity-[0.12]" />
        <div aria-hidden className="drift pointer-events-none absolute -left-24 top-[-10%] h-[34rem] w-[34rem] rounded-full bg-brand-500/30 blur-[120px]" />
        <div aria-hidden className="drift pointer-events-none absolute -right-20 bottom-[-12%] h-[30rem] w-[30rem] rounded-full bg-accent-500/20 blur-[120px]" style={{ animationDelay: "-7s" }} />

        <Link href="/" className="relative">
          <Wordmark className="text-2xl text-white" />
        </Link>

        <motion.div
          className="relative"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
        >
          <motion.p
            variants={{ hidden: { opacity: 0, y: reduce ? 0 : 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-300"
          >
            Digital SAT · Bluebook-style
          </motion.p>
          <motion.h2
            variants={{ hidden: { opacity: 0, y: reduce ? 0 : 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}
            className="mt-4 max-w-md font-display text-4xl font-semibold leading-[1.1] tracking-tight text-white"
          >
            Your target score, one module at a time.
          </motion.h2>

          {/* floating score card */}
          <motion.div
            variants={{ hidden: { opacity: 0, scale: reduce ? 1 : 0.94, y: reduce ? 0 : 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.8, ease } } }}
            className="relative mt-10 w-full max-w-xs rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur"
          >
            <ScoreGauge target={1520} />
            <div className="mt-1 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> R&amp;W 760
              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-accent-500" /> Math 760
            </div>
            {/* mini marked question chip */}
            <div className="floaty absolute -right-4 -top-4 hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-600 shadow-lg sm:flex" style={{ ["--r" as string]: "4deg" }}>
              <Flag className="h-3 w-3 fill-amber-400 text-amber-500" /> Marked
            </div>
          </motion.div>

          {/* stat chips */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: reduce ? 0 : 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="mt-8 flex flex-wrap gap-2"
          >
            {STATS.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
                <s.icon className="h-3.5 w-3.5 text-brand-300" /> {s.label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <p className="relative font-mono text-[11px] uppercase tracking-wider text-slate-500">
          satway.online · made for Uzbekistan
        </p>
      </aside>

      {/* ───────── Right: form ───────── */}
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
        {/* ambient blobs for mobile / right side */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
          <div className="drift absolute -left-32 top-[-10%] h-[30rem] w-[30rem] rounded-full bg-brand-500/15 blur-[120px]" />
          <div className="drift absolute right-[-10%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-accent-500/15 blur-[120px]" style={{ animationDelay: "-6s" }} />
        </div>

        <Link href="/" className="mb-8 lg:hidden">
          <Wordmark className="text-xl text-slate-900" />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5"
        >
          {children}
        </motion.div>

        <p className="mt-6 text-xs text-slate-400">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-slate-600">
            <Check className="h-3.5 w-3.5 text-brand-600" /> Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
