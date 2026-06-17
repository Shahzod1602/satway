"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Calculator, Trophy, Shuffle, Lock, Crown, Flame } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { canAccessTest } from "@/lib/access";

interface TestData {
  id: string;
  title: string;
  slug: string;
  skill: string;
  type: string;
  description: string | null;
  durationSec: number;
  published: boolean;
  createdAt: string;
  _count: { sections: number };
}

type Tab = "READING_WRITING" | "MATH" | "MOCK";
const TABS: Tab[] = ["READING_WRITING", "MATH", "MOCK"];
const PAGE_SIZE = 24;

const SKILL_LABELS: Record<string, string> = {
  READING_WRITING: "Reading & Writing",
  MATH: "Math",
};

export default function DashboardClient({
  user,
  tests,
  plan = "FREE",
  initialTab,
  streak = 0,
}: {
  user: { name: string; role: string };
  tests: TestData[];
  plan?: string;
  initialTab?: string;
  streak?: number;
}) {
  const router = useRouter();
  const isPremium = plan === "PREMIUM";
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "READING_WRITING",
  );
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setCategory("All");
    setQuery("");
    setPage(1);
  }, [activeTab]);

  // Reset to the first page whenever the visible set changes.
  useEffect(() => {
    setPage(1);
  }, [category, query]);

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

  const filteredTests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tests.filter((t) => {
      if (t.skill !== activeTab) return false;
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
  }, [tests, activeTab, category, plan, query]);

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
          {!isPremium && (
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
          )}
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
            ) : (
              <>
                {/* Filter pills */}
                <div className="mt-8 flex flex-wrap gap-3">
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
                    <p className="text-slate-400 text-sm">No tests yet.</p>
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
                            <p className="mt-2.5 text-sm text-slate-400">
                              {selectedModule
                                ? `Module ${selectedModule}`
                                : `${SKILL_LABELS[t.skill] ?? t.skill}`}
                            </p>
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
