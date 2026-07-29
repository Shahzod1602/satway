"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Calculator, Trophy, Shuffle, Lock, Crown, Flame, ClipboardCheck } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PremiumExpiredBanner from "@/components/PremiumExpiredBanner";
import { canAccessTest } from "@/lib/access";
import { LEVEL_LABEL, LEVEL_BADGE } from "@/lib/level";

interface TestData {
  id: string;
  title: string;
  slug: string;
  skill: string;
  type: string;
  description: string | null;
  durationSec: number;
  published: boolean;
  level: string;
  createdAt: string;
  _count: { sections: number };
}

const LEVEL_ORDER = ["EASY", "MEDIUM", "HARD"] as const;

type Tab = "READING_WRITING" | "MATH" | "REAL" | "MOCK";
const TABS: Tab[] = ["READING_WRITING", "MATH", "REAL", "MOCK"];
const PAGE_SIZE = 24;

const SKILL_LABELS: Record<string, string> = {
  READING_WRITING: "Reading & Writing",
  MATH: "Math",
};

export default function DashboardClient({
  user,
  tests,
  plan = "FREE",
  premiumExpired = false,
  initialTab,
  streak = 0,
  userLevel = null,
  suggestedLevel = "MEDIUM",
}: {
  user: { name: string; role: string };
  tests: TestData[];
  plan?: string;
  premiumExpired?: boolean;
  initialTab?: string;
  streak?: number;
  userLevel?: string | null;
  suggestedLevel?: string;
}) {
  const router = useRouter();
  const isPremium = plan === "PREMIUM";
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "READING_WRITING",
  );
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // The student's own level drives which tests are shown by default; "ALL" is opt-in
  // browsing. myLevel is what we've persisted (null until they choose); the filter
  // starts on their level, or the suggestion if they've never picked one.
  const [myLevel, setMyLevel] = useState<string | null>(userLevel);
  const [levelFilter, setLevelFilter] = useState<string>(userLevel ?? suggestedLevel);

  async function pickLevel(lv: string) {
    setLevelFilter(lv);
    if (lv === "ALL" || lv === myLevel) return; // browsing all never changes the saved level
    setMyLevel(lv);
    try {
      await fetch("/api/user/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: lv }),
      });
    } catch {
      // A failed save only means the next visit re-suggests — the filter still worked.
    }
  }

  const SKILL_PARTS: Record<string, { label: string; count: number }> = {
    READING_WRITING: { label: "Module", count: 2 },
    MATH: { label: "Module", count: 2 },
  };
  const partCfg = SKILL_PARTS[activeTab] ?? { label: "Module", count: 2 };
  const categoryPills = [
    "Full test",
    ...Array.from({ length: partCfg.count }, (_, i) => `${partCfg.label} ${i + 1}`),
  ];
  const selectedModule =
    category !== "All" && category !== "Full test"
      ? parseInt(category.replace(/\D/g, ""), 10)
      : null;

  // Reset filters when the active skill tab changes (R&W vs Math), and reset to page 1
  // whenever the visible set changes. setState-in-effect is the right pattern for "reset
  // UI state when a higher-level control changes" — there is no derived alternative.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategory("All");
    setQuery("");
    setPage(1);
  }, [activeTab]);

  // Reset to the first page whenever the visible set changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [category, query, levelFilter]);

  const startRandomMock = () => {
    if (!isPremium) {
      router.push("/upgrade");
      return;
    }
    const pool = tests;
    const pickRandom = (skill: string) => {
      const opts = pool.filter((t) => t.skill === skill);
      return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
    };
    const rw = pickRandom("READING_WRITING");
    const m = pickRandom("MATH");
    if (!rw || !m) {
      alert("Not enough tests to build a mock.");
      return;
    }
    router.push(
      `/mock?rw=${encodeURIComponent(rw.slug)}&m=${encodeURIComponent(m.slug)}`,
    );
  };

  // A "Real Exam" is a single skill run as a full 2-module adaptive test — the same engine
  // a normal /test/[slug] visit uses (mode="full"), surfaced here as its own practice mode.
  // Module 1 → adaptive Module 2 (EASY/HARD) → 200–800 scaled score on /results/[id].
  // Premium-gated like Mock. Only full tests (≥2 sections) are eligible candidates.
  const startRealExam = (skill: "READING_WRITING" | "MATH") => {
    if (!isPremium) {
      router.push("/upgrade");
      return;
    }
    const pool = tests.filter((t) => t.skill === skill && t._count.sections >= 2);
    if (!pool.length) {
      alert("No full tests available yet.");
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/test/${pick.slug}`); // mode=full by default → 2-modulli adaptive
  };

  const filteredTests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tests.filter((t) => {
      if (t.skill !== activeTab) return false;
      if (levelFilter !== "ALL" && t.level !== levelFilter) return false;
      if (category === "Full test" && t._count.sections < 2) return false;
      if (category !== "All" && category !== "Full test") {
        const n = parseInt(category.replace(/\D/g, ""), 10);
        if (t._count.sections < n) return false;
      }
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const accessRank = (t: TestData) => (canAccessTest(plan, t.slug) ? 0 : 1);
    list.sort((a, b) => accessRank(a) - accessRank(b));
    return list;
  }, [tests, activeTab, category, plan, query, levelFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedTests = filteredTests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />

      <div className="min-w-0 flex-1">
        <main className="px-6 pt-6 pb-10">
          {streak > 0 && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-700">
              <Flame className="h-4 w-4 fill-amber-400 text-amber-500" />
              {streak}-day streak — keep it going!
            </div>
          )}
          {!isPremium &&
            (premiumExpired ? (
              <PremiumExpiredBanner className="mb-4" />
            ) : (
              <Link
                href="/upgrade"
                className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-5 py-4 transition-colors hover:border-amber-300"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-600">
                    <Crown className="h-5 w-5" />
                  </span>
                  <span className="text-sm text-slate-700">
                    <strong className="font-semibold text-slate-900">Get Premium</strong> — unlock all SAT practice tests and full mock exams.
                  </span>
                </span>
                <span className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
                  Get Premium
                </span>
              </Link>
            ))}
          <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[#EAEAEA]">
              <button
                onClick={() => setActiveTab("READING_WRITING")}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "READING_WRITING"
                    ? "text-brand-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Reading & Writing
                </div>
                {activeTab === "READING_WRITING" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("MATH")}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "MATH"
                    ? "text-brand-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Math
                </div>
                {activeTab === "MATH" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("MOCK")}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "MOCK"
                    ? "text-brand-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Mock
                </div>
                {activeTab === "MOCK" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("REAL")}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === "REAL"
                    ? "text-brand-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  Real Exam
                </div>
                {activeTab === "REAL" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
                )}
              </button>
            </div>

            {activeTab === "MOCK" ? (
              <div className="mt-8 rounded-2xl border border-[#EAEAEA] bg-gradient-to-br from-accent-50/50 to-white p-8 sm:p-12 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-50 text-accent-600">
                  <Trophy className="h-8 w-8" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">Full mock test</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  A full Digital SAT simulation —{" "}
                  <strong>Reading & Writing</strong>, then{" "}
                  <strong>Math</strong> in sequence with real timing.
                </p>
                <button
                  onClick={startRandomMock}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {isPremium ? (
                    <><Shuffle className="h-4 w-4" /> Start a random mock test</>
                  ) : (
                    <><Lock className="h-4 w-4" /> Unlock with Premium</>
                  )}
                </button>
                <p className="mt-3 text-xs text-slate-400">
                  2 sections · timed like the real Digital SAT{isPremium ? "" : " · Premium feature"}
                </p>
              </div>
            ) : activeTab === "REAL" ? (
              <div className="mt-8 rounded-2xl border border-[#EAEAEA] bg-gradient-to-br from-brand-50/40 to-white p-8 sm:p-12">
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <ClipboardCheck className="h-8 w-8" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-slate-900">Real Exam</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Run a single section as a full 2-module adaptive test — real timing, a
                    scaled <strong>200–800</strong> score, the same as one half of the real
                    Digital SAT. Pick a section to start a random full test.
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    Module 1 → adaptive Module 2{isPremium ? "" : " · Premium feature"}
                  </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => startRealExam("READING_WRITING")}
                    className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white px-6 py-6 text-left transition-all hover:shadow-sm ${
                      isPremium ? "border-[#EAEAEA] hover:border-brand-300" : "border-amber-200"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                          <BookOpen className="h-5 w-5" />
                        </span>
                        <span className="text-base font-semibold text-slate-900">
                          Reading &amp; Writing
                        </span>
                      </span>
                      <span className="mt-2 block text-xs text-slate-500">
                        2 modules · ~64 min · 200–800
                      </span>
                    </span>
                    {isPremium ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-400 transition-colors group-hover:text-brand-600">
                        <Shuffle className="w-3.5 h-3.5" /> Start
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => startRealExam("MATH")}
                    className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white px-6 py-6 text-left transition-all hover:shadow-sm ${
                      isPremium ? "border-[#EAEAEA] hover:border-brand-300" : "border-amber-200"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                          <Calculator className="h-5 w-5" />
                        </span>
                        <span className="text-base font-semibold text-slate-900">Math</span>
                      </span>
                      <span className="mt-2 block text-xs text-slate-500">
                        2 modules · ~70 min · 200–800
                      </span>
                    </span>
                    {isPremium ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-400 transition-colors group-hover:text-brand-600">
                        <Shuffle className="w-3.5 h-3.5" /> Start
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Level matcher — tests shown are matched to the student's level */}
                <div className="mt-8 rounded-2xl border border-[#EAEAEA] bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-sm font-semibold text-slate-700">Your level</span>
                    <div className="flex flex-wrap gap-2">
                      {LEVEL_ORDER.map((lv) => {
                        const active = levelFilter === lv;
                        const suggested = myLevel === null && suggestedLevel === lv;
                        return (
                          <button
                            key={lv}
                            onClick={() => pickLevel(lv)}
                            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                              active
                                ? `${LEVEL_BADGE[lv]} ring-2 ring-slate-300 ring-offset-1`
                                : "border-[#EAEAEA] bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {LEVEL_LABEL[lv]}
                            {suggested && <span className="ml-1 text-xs opacity-70">· suggested</span>}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => pickLevel("ALL")}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                          levelFilter === "ALL"
                            ? "border-brand-600 bg-brand-50 text-brand-600"
                            : "border-[#EAEAEA] bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        All levels
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {levelFilter === "ALL"
                      ? "Showing tests of every level."
                      : myLevel === null
                        ? `Showing ${LEVEL_LABEL[levelFilter as "EASY" | "MEDIUM" | "HARD"]} tests — tap a level to save it as yours.`
                        : "Showing tests matched to your level. Tap another level any time."}
                  </p>
                </div>

                {/* Filter pills */}
                <div className="mt-5 flex flex-wrap gap-3">
                  {categoryPills.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory((prev) => (prev === c ? "All" : c))}
                      className={`rounded-full border px-6 py-2 text-sm font-medium transition-colors ${
                        category === c
                          ? "border-brand-600 bg-brand-50 text-brand-600"
                          : "border-[#EAEAEA] text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {SKILL_LABELS[activeTab] ?? activeTab} tests
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {filteredTests.length}
                    </span>
                  </h2>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tests…"
                    className="w-full max-w-xs rounded-lg border border-[#EAEAEA] px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {filteredTests.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-[#EAEAEA] bg-slate-50 p-12 text-center">
                    <p className="text-slate-400 text-sm">
                      {levelFilter === "ALL"
                        ? "No tests yet."
                        : `No ${LEVEL_LABEL[levelFilter as "EASY" | "MEDIUM" | "HARD"]} tests in this section yet.`}
                    </p>
                    {levelFilter !== "ALL" && (
                      <button
                        onClick={() => setLevelFilter("ALL")}
                        className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Show all levels
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pagedTests.map((t) => {
                      const locked = !canAccessTest(plan, t.slug);
                      const href = locked
                        ? "/upgrade"
                        : selectedModule
                          ? `/test/${t.slug}?module=${selectedModule}`
                          : `/test/${t.slug}`;
                      return (
                        <Link
                          key={t.id}
                          href={href}
                          className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-6 transition-all hover:shadow-sm ${
                            locked
                              ? "border-amber-200 hover:border-amber-300"
                              : "border-[#EAEAEA] hover:border-slate-300"
                          }`}
                        >
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
                              {t.title}
                            </h3>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE[t.level as "EASY" | "MEDIUM" | "HARD"]}`}
                              >
                                {LEVEL_LABEL[t.level as "EASY" | "MEDIUM" | "HARD"]}
                              </span>
                              <span className="text-sm text-slate-400">
                                {selectedModule
                                  ? `Module ${selectedModule}`
                                  : `${SKILL_LABELS[t.skill] ?? t.skill}`}
                              </span>
                            </div>
                          </div>
                          {locked ? (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              <Lock className="w-3 h-3" /> Premium
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-slate-400 transition-colors group-hover:text-brand-600">
                              Start
                              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {pageCount > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="rounded-lg border border-[#EAEAEA] px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500">
                      Page {safePage} of {pageCount}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      disabled={safePage >= pageCount}
                      className="rounded-lg border border-[#EAEAEA] px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
