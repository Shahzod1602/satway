"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowRight, Calculator, BarChart3, Brain, Timer,
  Flag, Check, X, GraduationCap, Sparkles, ChevronRight, Layers,
  Smartphone, RotateCcw, Wallet,
} from "lucide-react";
import ScoreGauge from "./ScoreGauge";
import CountUp from "./CountUp";
import AITutorDemo from "./AITutorDemo";
import { PREMIUM_PLANS, BASE_MONTHLY, fmtUSD } from "@/lib/plans";

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-extrabold tracking-tight ${className}`}>
      SAT<span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
    </span>
  );
}

// The course price we anchor against (~$330 — mid of the local private-tutor range).
const COURSE_PRICE_USD = "$330";

const BENTO = [
  { icon: Brain, tag: "AI tutor", title: "Ask why you got it wrong", body: "A tutor that explains every mistake in plain English — step by step. Like a private tutor, but 24/7.", span: true },
  { icon: RotateCcw, tag: "Mistake bank", title: "Drill your weak spots", body: "Every wrong answer, grouped by topic, until you own it." },
  { icon: Timer, tag: "Pacing", title: "See where time slips", body: "Per-question timing shows exactly where you slow down." },
  { icon: Layers, tag: "Adaptive", title: "A real Module 2", body: "Module 2 gets harder or easier from your Module 1 — like the real exam." },
  { icon: Smartphone, tag: "Install it", title: "Works on your phone", body: "Add SATway to your home screen. No Play Store, no VPN, works offline." },
  { icon: Calculator, tag: "Test-day tools", title: "Built-in Desmos", body: "The exact graphing calculator you get on test day, in every Math module." },
  { icon: BarChart3, tag: "Scoring", title: "200–800, instantly", body: "College-Board-calibrated scaled scores and a 400–1600 total, in minutes." },
];

// Headline price for the comparison table = the 1-month plan, list → current discount.
const HEADLINE_PLAN = PREMIUM_PLANS.find((p) => p.id === "1m") ?? PREMIUM_PLANS[0];
const HEADLINE_WAS_USD = Math.round((BASE_MONTHLY * HEADLINE_PLAN.months) / 120);

const COMPARE = [
  {
    label: "Price",
    tg: "Free",
    sw: `${fmtUSD(HEADLINE_WAS_USD)} → ${fmtUSD(HEADLINE_PLAN.totalUsd)}/mo`,
    co: "$83–400",
  },
  { label: "Real Bluebook interface", tg: false, sw: true, co: "sometimes" },
  { label: "Adaptive Module 1 → 2", tg: false, sw: true, co: false },
  { label: "Explains every mistake, step by step", tg: false, sw: true, co: true },
  { label: "Mistake bank & timing analytics", tg: false, sw: true, co: false },
  { label: "Structured & self-paced", tg: false, sw: true, co: true },
  { label: "Works on your phone (24/7)", tg: true, sw: true, co: false },
];

export default function Landing({ stats }: { stats?: { students: number; tests: number; questions: number } }) {
  const reduce = useReducedMotion();
  const s = stats ?? { students: 0, tests: 0, questions: 0 };
  const hasStats = s.students > 0 || s.questions > 0;

  const EASE = [0.16, 1, 0.3, 1] as const;
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
  const item: Variants = { hidden: { opacity: 0, y: reduce ? 0 : 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } } };
  const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } } as const;
  const hover = reduce ? {} : { whileHover: { y: -5 }, transition: { type: "spring" as const, stiffness: 300, damping: 22 } };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--background)] text-slate-900">
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-dotgrid" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="drift absolute -left-40 top-[-12%] h-[42rem] w-[42rem] rounded-full bg-brand-500/15 blur-[130px]" />
        <div className="drift absolute right-[-14%] top-[16%] h-[34rem] w-[34rem] rounded-full bg-accent-500/15 blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="drift absolute left-[30%] top-[55%] h-[30rem] w-[30rem] rounded-full bg-brand-400/10 blur-[130px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ───────── Nav ───────── */}
      <motion.header
        initial={{ y: reduce ? 0 : -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="sticky top-0 z-40 border-b border-slate-200/60 bg-[var(--background)]/80 backdrop-blur-md"
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/"><Wordmark className="text-xl text-slate-900" /></Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#tutor" className="hover:text-slate-900">AI tutor</a>
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#compare" className="hover:text-slate-900">Why SATway</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="group inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Get started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* ───────── Hero ───────── */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.p variants={item} className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/60 px-3 py-1 text-[12px] font-medium text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-accent-600" /> The smart middle between free Telegram and expensive courses
          </motion.p>
          <motion.h1 variants={item} className="mt-6 font-display text-5xl font-semibold leading-[1.03] tracking-tight text-slate-900 sm:text-6xl">
            Raise your SAT score — for the{" "}
            <span className="hl-word">price of a lunch.</span>
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Real adaptive Bluebook mocks, an AI tutor that explains every mistake in{" "}
            <span className="font-semibold text-slate-900">plain English</span>, and instant 200–800 scoring —{" "}
            <span className="font-semibold text-slate-900">from $3.71/mo</span>.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
              Start free — get your score
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#tutor" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
              Meet the AI tutor
            </a>
          </motion.div>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            {["Free first mock", "No card required", "Made in Uzbekistan", "Works on your phone"].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> {t}</span>
            ))}
          </motion.div>
        </motion.div>

        {/* gauge + floating cards */}
        <motion.div className="relative" initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}>
          <div className="relative mx-auto grid max-w-sm place-items-center rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
            <ScoreGauge target={1520} />
            <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-brand-600" /> R&amp;W 760
              <span className="ml-3 h-2 w-2 rounded-full bg-accent-500" /> Math 760
            </div>
          </div>

          {/* price-wedge chip */}
          <motion.div
            className="absolute -right-2 -top-4 hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold shadow-lg sm:flex"
            initial={{ opacity: 0, y: reduce ? 0 : -20, rotate: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0, rotate: 3 }} transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
          >
            <span className="text-slate-400 line-through">Course $330</span>
            <ArrowRight className="h-3 w-3 text-brand-500" />
            <span className="text-brand-700">SATway $3.71</span>
          </motion.div>

          {/* mini exam card */}
          <motion.div
            className="absolute -left-6 -bottom-8 hidden w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:block"
            initial={{ opacity: 0, y: reduce ? 0 : 30, rotate: reduce ? 0 : -8 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <span className="grid h-6 w-6 place-items-center rounded bg-slate-900 text-[11px] font-bold text-white">7</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><Flag className="h-3 w-3 fill-amber-400 text-amber-500" /> Marked</span>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-slate-600">Which choice completes the text with the most logical word?</p>
            <div className="mt-2 space-y-1.5">
              <div className="rounded-md border border-brand-500 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">B&nbsp; seminal</div>
              <div className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400 line-through">A&nbsp; trivial</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ───────── Honest stats band ───────── */}
      {hasStats && (
        <motion.div {...inView} variants={container} className="border-y border-slate-200/70 bg-white/50">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4">
            {[
              { n: s.students, suffix: "+", label: "Students preparing" },
              { n: s.tests, suffix: "+", label: "Mock tests taken" },
              { n: s.questions, suffix: "+", label: "Questions answered" },
            ].map((st) => (
              <motion.div key={st.label} variants={item} className="text-center">
                <p className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
                  <CountUp to={st.n} suffix={st.suffix} />
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{st.label}</p>
              </motion.div>
            ))}
            <motion.div variants={item} className="text-center">
              <p className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl">24/7</p>
              <p className="mt-1 text-xs font-medium text-slate-500">AI tutor, in your language</p>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ───────── AI Tutor signature showcase ───────── */}
      <section id="tutor" className="relative mx-auto max-w-6xl px-5 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...inView} variants={container}>
            <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Meet your AI tutor</motion.p>
            <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Wrong answer? Get the <span className="hl-word">why</span> — in your language.
            </motion.h2>
            <motion.p variants={item} className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Every mistake becomes a lesson. Ask <span className="font-medium text-slate-800">&ldquo;why is this wrong?&rdquo;</span> and your tutor
              walks you through it in plain English — with the math written out. Like a private tutor,
              but 24/7 and for a fraction of the price.
            </motion.p>
            <motion.ul variants={item} className="mt-7 space-y-3 text-sm text-slate-700">
              {["Step-by-step, not just the answer", "Explains the concept, not just this question", "Ask follow-ups until it clicks", "Built into every mistake you review"].map((t) => (
                <li key={t} className="flex items-start gap-2.5"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t}</li>
              ))}
            </motion.ul>
            <motion.p variants={item} className="mt-7 text-sm font-medium text-slate-500">
              👉 Every wrong answer becomes a lesson.
            </motion.p>
          </motion.div>

          <motion.div {...inView} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } }}>
            <AITutorDemo />
          </motion.div>
        </div>
      </section>

      {/* ───────── Feature bento ───────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <motion.div className="max-w-2xl" {...inView} variants={container}>
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Everything you need</motion.p>
          <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Test day — minus the test day.
          </motion.h2>
        </motion.div>
        <motion.div className="mt-12 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3" {...inView} variants={container}>
          {BENTO.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              {...hover}
              className={`group rounded-2xl border border-slate-200 bg-white/70 p-6 hover:border-brand-300 hover:shadow-lg hover:shadow-slate-900/5 ${
                f.span ? "sm:col-span-2 sm:row-span-1 bg-gradient-to-br from-white to-brand-50/50" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><f.icon className="h-5 w-5" /></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{f.tag}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ───────── Comparison — the "automated middle" ───────── */}
      <section id="compare" className="mx-auto max-w-5xl px-5 py-20">
        <motion.div className="mx-auto max-w-2xl text-center" {...inView} variants={container}>
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Where SATway fits</motion.p>
          <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            The middle path that actually works.
          </motion.h2>
          <motion.p variants={item} className="mt-4 text-base text-slate-600">
            Telegram is chaotic. A private tutor costs a fortune. SATway is the structured, affordable middle.
          </motion.p>
        </motion.div>

        <motion.div {...inView} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
          className="relative mt-12">
          {/* Floats above the SATway column — kept OUTSIDE the rounded clip below so it
              is never cut off. Left % = centre of the SATway column for these fr ratios. */}
          <span className="pointer-events-none absolute top-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm sm:block" style={{ left: "65.5%" }}>Best value</span>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr_1fr_1.1fr_1fr] text-sm">
              {/* header row */}
              <div className="border-b border-slate-200 px-4 py-4" />
              <div className="border-b border-l border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-500">Free Telegram</div>
              <div className="border-b border-l-2 border-brand-600 bg-brand-50/50 px-3 py-4 text-center">
                <span className="font-bold text-brand-700">SATway</span>
              </div>
              <div className="border-b border-l border-slate-200 px-3 py-4 text-center text-xs font-semibold text-slate-500">Private tutor</div>

              {COMPARE.map((row, i) => (
                <RowCells key={row.label} row={row} last={i === COMPARE.length - 1} />
              ))}
            </div>
          </div>
        </motion.div>
        <motion.p {...inView} variants={item} className="mt-5 text-center text-sm text-slate-500">
          Telegram is chaotic. A private tutor costs a fortune. <span className="font-semibold text-slate-800">SATway is the middle path that works.</span>
        </motion.p>
      </section>

      {/* ───────── Exam interface showcase ───────── */}
      <section id="exam" className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...inView} variants={container}>
            <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">The real interface</motion.p>
            <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A split-screen built for focus.</motion.h2>
            <motion.p variants={item} className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Passage on the left, question on the right. Cross out wrong answers, flag tricky ones,
              and navigate with the question map — every interaction mirrors Bluebook.
            </motion.p>
            <motion.ul variants={item} className="mt-7 space-y-3 text-sm text-slate-700">
              {["One question per screen with Back / Next", "Per-module countdown timer", "Question navigator with answered & marked states", "End-of-module review before you submit"].map((t) => (
                <li key={t} className="flex items-start gap-2.5"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t}</li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div {...inView} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } }} {...hover}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <Wordmark className="text-sm" />
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700"><Timer className="h-3.5 w-3.5" /> 23:14</span>
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
      <section id="adaptive" className="mx-auto max-w-6xl px-5 py-16">
        <motion.div {...inView} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/40 p-8 sm:p-12">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Adaptive by design</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Your second module is earned.</h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">Just like the College Board exam, how you do in Module 1 decides the difficulty — and the score ceiling — of Module 2.</p>
          </div>
          <div className="mt-10 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Step 1</span>
              <h3 className="mt-1 text-lg font-semibold">Module 1</h3>
              <p className="mt-1.5 text-sm text-slate-600">Everyone starts on the same standard set of questions.</p>
            </div>
            <div className="grid place-items-center"><div className="rotate-90 text-brand-400 md:rotate-0"><ArrowRight className="h-6 w-6" /></div></div>
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

      {/* ───────── Price wedge + Pricing ───────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
        <motion.div className="mx-auto max-w-2xl text-center" {...inView} variants={container}>
          <motion.p variants={item} className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-600">Pricing</motion.p>
          <motion.h2 variants={item} className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            About 40× cheaper than a course.
          </motion.h2>
          {/* price wedge */}
          <motion.div variants={item} className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <span className="text-lg font-semibold text-slate-400 line-through">{COURSE_PRICE_USD}</span>
            <span className="text-slate-400">course</span>
            <ArrowRight className="h-4 w-4 text-brand-500" />
            <span className="font-display text-2xl font-semibold text-brand-700">$3.71/mo</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">~40× cheaper</span>
          </motion.div>
          <motion.p variants={item} className="mt-4 text-base text-slate-600">Test 1 is free forever. Premium unlocks every test and full adaptive mocks.</motion.p>
          <motion.div variants={item} className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <Wallet className="h-4 w-4 text-slate-400" />
            {["Visa", "Mastercard"].map((p) => (
              <span key={p} className="rounded-md border border-slate-200 bg-white px-2.5 py-1">{p}</span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div className="mt-12 grid gap-5 md:grid-cols-3" {...inView} variants={container}>
          {PREMIUM_PLANS.map((p) => {
            const originalUsd = Math.round((BASE_MONTHLY * p.months) / 120);
            return (
              <motion.div key={p.id} variants={item} {...hover}
                className={`relative flex flex-col rounded-3xl border bg-white p-7 ${p.popular ? "border-brand-600 shadow-xl shadow-brand-600/10 ring-1 ring-brand-600" : "border-slate-200"}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">Most popular</span>}
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">{p.label}</h3>
                  <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold text-accent-700">−{p.discount}%</span>
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-display text-4xl font-semibold tracking-tight text-slate-900">{fmtUSD(p.totalUsd)}</span>
                  <span className="mb-1 font-mono text-xs uppercase text-slate-400">USD</span>
                </div>
                <p className="mt-1 text-sm text-slate-400 line-through">{fmtUSD(originalUsd)}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                  {["All tests + adaptive mocks", "AI tutor for every mistake", "Mistake bank & timing", "Progress analytics"].map((t) => (
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
        <motion.p {...inView} variants={item} className="mt-6 text-center text-xs text-slate-400">Start free · No card required · Cancel anytime</motion.p>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <motion.div {...inView} variants={{ hidden: { opacity: 0, scale: reduce ? 1 : 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE } } }}
          className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-8 py-16 text-center sm:px-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-ruled opacity-30" />
          <div aria-hidden className="drift absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/30 blur-[100px]" />
          <div aria-hidden className="drift absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-accent-500/20 blur-[100px]" style={{ animationDelay: "-7s" }} />
          <div className="relative">
            <GraduationCap className="mx-auto h-10 w-10 text-accent-400" />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              From your phone to a scholarship.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-slate-300">
              Your target score and a foreign university start with one free mock. Take it today.
            </p>
            <Link href="/register" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              Create your free account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-4 text-xs text-slate-400">Free · Works in your browser · On any phone</p>
          </div>
        </motion.div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row">
          <Wordmark className="text-lg text-slate-900" />
          <p className="font-mono text-xs uppercase tracking-wider">Digital SAT preparation · satway.online</p>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900">Register</Link>
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** One comparison row across the 3 columns. */
function RowCells({ row, last }: { row: (typeof COMPARE)[number]; last: boolean }) {
  const border = last ? "" : "border-b";
  const cell = (v: boolean | string, tone: "tg" | "sw" | "co") => {
    const base = tone === "sw" ? "border-l-2 border-brand-600 bg-brand-50/40" : "border-l border-slate-200";
    if (typeof v === "string") {
      return <div className={`${border} ${base} px-3 py-3.5 text-center text-xs font-semibold ${tone === "sw" ? "text-brand-700" : "text-slate-600"}`}>{v}</div>;
    }
    return (
      <div className={`${border} ${base} grid place-items-center px-3 py-3.5`}>
        {v ? <Check className={`h-4 w-4 ${tone === "sw" ? "text-brand-600" : "text-emerald-500"}`} /> : <X className="h-4 w-4 text-slate-300" />}
      </div>
    );
  };
  return (
    <>
      <div className={`${border} border-slate-200 px-4 py-3.5 text-sm text-slate-700`}>{row.label}</div>
      {cell(row.tg, "tg")}
      {cell(row.sw, "sw")}
      {cell(row.co, "co")}
    </>
  );
}
