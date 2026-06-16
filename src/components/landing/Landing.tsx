"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowRight, BookOpen, Calculator, Highlighter, BarChart3, Brain, Timer,
  Flag, Check, GraduationCap, Sparkles, Target, ChevronRight, Layers,
} from "lucide-react";
import ScoreGauge from "./ScoreGauge";
import { PREMIUM_PLANS, BASE_MONTHLY, fmtUZS } from "@/lib/plans";

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-extrabold tracking-tight ${className}`}>
      SAT<span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
    </span>
  );
}

const FEATURES = [
  { icon: Brain, title: "Adaptive engine", body: "Module 2 adjusts to your Module 1 performance — easier or harder — exactly like the real Digital SAT." },
  { icon: BookOpen, title: "Bluebook interface", body: "One question per screen, split-screen Reading & Writing, mark-for-review and answer cross-out." },
  { icon: Calculator, title: "Built-in Desmos", body: "The same graphing calculator you get on test day, embedded right inside every Math module." },
  { icon: Target, title: "200–800 scoring", body: "Instant scaled scores per section and a 400–1600 total — calibrated to College Board curves." },
  { icon: Highlighter, title: "Highlight & annotate", body: "Mark up passages with highlights and notes that stay with you across every question." },
  { icon: BarChart3, title: "Progress tracking", body: "Watch your scores climb over time with clear charts for every attempt and section." },
];

export default function Landing() {
  const reduce = useReducedMotion();

  const EASE = [0.16, 1, 0.3, 1] as const;
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
  };
  const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } } as const;
  const hover = reduce ? {} : { whileHover: { y: -5 }, transition: { type: "spring" as const, stiffness: 300, damping: 22 } };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FBFAF7] text-slate-900">
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-dotgrid" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="drift absolute -left-40 top-[-12%] h-[42rem] w-[42rem] rounded-full bg-brand-500/15 blur-[130px]" />
        <div className="drift absolute right-[-14%] top-[18%] h-[34rem] w-[34rem] rounded-full bg-accent-500/15 blur-[130px]" style={{ animationDelay: "-8s" }} />
      </div>

      {/* ───────── Nav ───────── */}
      <motion.header
        initial={{ y: reduce ? 0 : -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FBFAF7]/80 backdrop-blur-md"
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/"><Wordmark className="text-xl text-slate-900" /></Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#exam" className="hover:text-slate-900">The exam</a>
            <a href="#adaptive" className="hover:text-slate-900">Adaptive</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/register" className="group inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* ───────── Hero ───────── */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.p variants={item} className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-accent-600" /> Digital SAT · Bluebook-style
          </motion.p>
          <motion.h1 variants={item} className="mt-6 font-display text-5xl font-semibold leading-[1.04] tracking-tight text-slate-900 sm:text-6xl">
            Practice the SAT the way it&rsquo;s{" "}
            <span className="hl-word">actually taken.</span>
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Full adaptive mock exams, an authentic test-day interface, and instant 200–800 scoring.
            Over <span className="font-semibold text-slate-900">1,000 practice tests</span> across Reading &amp; Writing and Math.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
              Start practicing free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#exam" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
              See the interface
            </a>
          </motion.div>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Free Test 1</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> No card required</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Made for Uzbekistan</span>
          </motion.div>
        </motion.div>

        {/* gauge + floating exam card */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
        >
          <div className="relative mx-auto grid max-w-sm place-items-center rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
            <ScoreGauge target={1520} />
            <div className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-brand-600" /> Reading &amp; Writing 760
              <span className="ml-3 h-2 w-2 rounded-full bg-accent-500" /> Math 760
            </div>
          </div>

          <motion.div
            className="absolute -left-6 -bottom-8 hidden w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:block"
            initial={{ opacity: 0, y: reduce ? 0 : 30, rotate: reduce ? 0 : -8 }}
            animate={{ opacity: 1, y: 0, rotate: -4 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <span className="grid h-6 w-6 place-items-center rounded bg-slate-900 text-[11px] font-bold text-white">7</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <Flag className="h-3 w-3 fill-amber-400 text-amber-500" /> Marked
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-slate-600">Which choice completes the text with the most logical word?</p>
            <div className="mt-2 space-y-1.5">
              <div className="rounded-md border border-brand-500 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">B&nbsp; seminal</div>
              <div className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400 line-through">A&nbsp; trivial</div>
            </div>
          </motion.div>

          <motion.div
            className="absolute -right-2 -top-4 hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-lg sm:flex"
            initial={{ opacity: 0, y: reduce ? 0 : -20, rotate: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0, rotate: 3 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}
          >
            <Layers className="h-3.5 w-3.5 text-brand-600" /> Module 2 · Harder
          </motion.div>
        </motion.div>
      </section>

      {/* ───────── Stats ticker ───────── */}
      <div className="relative border-y border-slate-200/70 bg-white/50 py-4">
        <div className="marquee-mask overflow-hidden">
          <div className="ticker flex w-max items-center gap-10 whitespace-nowrap font-mono text-sm text-slate-500">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                {[
                  "1,000+ practice tests", "Adaptive Module 2", "200–800 scaled scoring",
                  "Built-in Desmos", "Highlight & notes", "Mark for review",
                  "Reading · Writing · Math", "Real Bluebook timing",
                ].map((t) => (
                  <span key={t} className="flex items-center gap-10">
                    <span>{t}</span>
                    <span className="text-accent-500">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── Features ───────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-24">
        <motion.div className="max-w-2xl" {...inView} variants={container}>
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Why SATway</motion.p>
          <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Everything from test day — minus the test day.
          </motion.h2>
        </motion.div>
        <motion.div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" {...inView} variants={container}>
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              {...hover}
              className="rounded-2xl border border-slate-200 bg-white/70 p-6 hover:border-brand-300 hover:shadow-lg hover:shadow-slate-900/5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ───────── Exam interface showcase ───────── */}
      <section id="exam" className="relative mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...inView} variants={container}>
            <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">The real interface</motion.p>
            <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A split-screen built for focus.
            </motion.h2>
            <motion.p variants={item} className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Passage on the left, question on the right. Cross out wrong answers, flag tricky
              ones, and navigate with the question map — every interaction mirrors Bluebook.
            </motion.p>
            <motion.ul variants={item} className="mt-7 space-y-3 text-sm text-slate-700">
              {["One question per screen with Back / Next", "Per-module countdown timer", "Question navigator with answered & marked states", "End-of-module review before you submit"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            {...inView}
            variants={{ hidden: { opacity: 0, y: reduce ? 0 : 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } }}
            {...hover}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <Wordmark className="text-sm" />
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">
                <Timer className="h-3.5 w-3.5" /> 23:14
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="bg-slate-50/60 p-4 text-[12px] leading-relaxed text-slate-600">
                <p>Marie Curie&rsquo;s research was so <mark className="exam-hl">seminal</mark> that it reshaped entire fields; her work on radioactivity laid the foundation for both modern physics and chemistry.</p>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-6 w-6 place-items-center rounded bg-slate-900 text-[11px] font-bold text-white">7</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"><Flag className="h-3 w-3" /> Mark</span>
                </div>
                <p className="text-[12px] font-medium text-slate-800">Which word best completes the text?</p>
                <div className="mt-3 space-y-1.5 text-[11px]">
                  <div className="rounded-md border border-brand-500 bg-brand-50 px-2.5 py-1.5 font-medium text-brand-700">B&nbsp; seminal</div>
                  <div className="rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-400 line-through">A&nbsp; trivial</div>
                  <div className="rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600">C&nbsp; tentative</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <span key={n} className={`grid h-5 w-5 place-items-center rounded text-[10px] font-semibold ${n === 7 ? "bg-slate-900 text-white" : n < 7 ? "bg-brand-50 text-brand-700" : "border border-dashed border-slate-300 text-slate-400"}`}>{n}</span>
                ))}
              </div>
              <span className="rounded-md bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white">Next</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────── Adaptive explainer ───────── */}
      <section id="adaptive" className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...inView} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/40 p-8 sm:p-12">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Adaptive by design</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Your second module is earned.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              Just like the College Board exam, how you do in Module 1 decides the difficulty —
              and the score ceiling — of Module 2.
            </p>
          </div>
          <div className="mt-10 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Step 1</span>
              <h3 className="mt-1 text-lg font-semibold">Module 1</h3>
              <p className="mt-1.5 text-sm text-slate-600">Everyone starts on the same standard set of questions.</p>
            </div>
            <div className="grid place-items-center">
              <div className="rotate-90 text-brand-400 md:rotate-0"><ArrowRight className="h-6 w-6" /></div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-700">Module 2 · Standard</span>
                <p className="mt-1 text-sm text-slate-600">Steady performance keeps you on the standard path.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <span className="font-mono text-[11px] uppercase tracking-wider text-amber-700">Module 2 · Harder</span>
                <p className="mt-1 text-sm text-slate-600">A strong Module 1 unlocks the harder set — and a higher ceiling.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
        <motion.div className="mx-auto max-w-2xl text-center" {...inView} variants={container}>
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Pricing</motion.p>
          <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Start free. Go Premium when you&rsquo;re ready.
          </motion.h2>
          <motion.p variants={item} className="mt-4 text-base text-slate-600">Test 1 is free forever. Premium unlocks every test and full adaptive mocks.</motion.p>
        </motion.div>
        <motion.div className="mt-12 grid gap-5 md:grid-cols-3" {...inView} variants={container}>
          {PREMIUM_PLANS.map((p) => {
            const original = BASE_MONTHLY * p.months;
            return (
              <motion.div
                key={p.id}
                variants={item}
                {...hover}
                className={`relative flex flex-col rounded-3xl border bg-white p-7 ${p.popular ? "border-brand-600 shadow-xl shadow-brand-600/10 ring-1 ring-brand-600" : "border-slate-200"}`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">Most popular</span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">{p.label}</h3>
                  <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-700">−{p.discount}%</span>
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-display text-4xl font-semibold tracking-tight text-slate-900">{fmtUZS(p.total)}</span>
                  <span className="mb-1 font-mono text-xs uppercase text-slate-400">so&rsquo;m</span>
                </div>
                <p className="mt-1 text-sm text-slate-400 line-through">{fmtUZS(original)} so&rsquo;m</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                  {["All 1,000+ tests", "Full adaptive mock exams", "Desmos + reference sheet", "Progress analytics"].map((t) => (
                    <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t}</li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${p.popular ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-800 hover:border-slate-400"}`}>
                  Choose {p.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <motion.div
          {...inView}
          variants={{ hidden: { opacity: 0, scale: reduce ? 1 : 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE } } }}
          className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-8 py-16 text-center sm:px-16"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-ruled opacity-30" />
          <div aria-hidden className="drift absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/30 blur-[100px]" />
          <div aria-hidden className="drift absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-accent-500/20 blur-[100px]" style={{ animationDelay: "-7s" }} />
          <div className="relative">
            <GraduationCap className="mx-auto h-10 w-10 text-accent-400" />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              Your target score is closer than you think.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-slate-300">
              Join SATway and take your first adaptive test today — free.
            </p>
            <Link href="/register" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              Create your free account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row">
          <Wordmark className="text-lg text-slate-900" />
          <p className="font-mono text-xs uppercase tracking-wider">Digital SAT preparation · satway.online</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
