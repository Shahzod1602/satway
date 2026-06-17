"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, ChevronLeft, ChevronRight, Flag, Highlighter, Eraser, Quote,
  Calculator, BookOpen, X, LayoutGrid, ArrowLeft, Check, Loader2,
} from "lucide-react";
import type {
  ClientExamMeta, ClientModule, AnswerMap, SubmitModuleResult,
} from "@/lib/types";
import QuestionInput from "./QuestionInput";
import CalculatorPanel from "./CalculatorPanel";
import FormulaSheet from "./FormulaSheet";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type MockResult = {
  skill: string;
  attemptId: string;
  scaledScore: number | null;
  rawScore: number | null;
  total: number | null;
};

type FlowStage = "loading" | "active" | "review" | "transition" | "submitting" | "error";

export default function ExamRunner({
  test,
  userName,
  mode,
  practiceModule,
  mockMode = false,
  mockProgress,
  onSubmitted,
}: {
  test: ClientExamMeta;
  userName?: string;
  mode: "full" | "module";
  practiceModule?: number;
  mockMode?: boolean;
  mockProgress?: { step: number; total: number };
  onSubmitted?: (r: MockResult) => void;
}) {
  const router = useRouter();
  const isRW = test.skill === "READING_WRITING";
  const isMath = test.skill === "MATH";

  const [stage, setStage] = useState<FlowStage>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [mod, setMod] = useState<ClientModule | null>(null);
  const [nextMod, setNextMod] = useState<ClientModule | null>(null);
  const [qi, setQi] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [crossed, setCrossed] = useState<Record<string, string[]>>({});

  const [showNav, setShowNav] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const startedRef = useRef(false);
  const submittingRef = useRef(false);

  // ───────── Resume (localStorage) ─────────
  // Practice/full attempts survive a refresh or dropped connection. Mock runs
  // are sequenced by MockRunner and intentionally not persisted here.
  const persist = !mockMode;
  const STORAGE_KEY = `satway:exam:v1:${test.id}:${mode}:${practiceModule ?? "full"}`;
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;

  const clearSession = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, [STORAGE_KEY]);

  const saveSnapshot = useCallback(
    (snap: {
      attemptId: string;
      module: ClientModule;
      qi: number;
      timeLeft: number;
      answers: AnswerMap;
      marked: string[];
      crossed: Record<string, string[]>;
    }) => {
      if (!persist) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snap, savedAt: Date.now() })); } catch { /* ignore */ }
    },
    [persist, STORAGE_KEY],
  );

  const questions = mod?.questions ?? [];
  const q = questions[qi];
  const answeredCount = questions.filter((x) => {
    const v = answers[x.id];
    return Array.isArray(v) ? v.length > 0 : !!v?.trim();
  }).length;

  // ───────── Start the attempt (or resume a saved one) ─────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Try to resume an unfinished session first.
    if (persist) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s?.attemptId && s?.module?.questions?.length && Date.now() - (s.savedAt ?? 0) < MAX_AGE_MS) {
            setAttemptId(s.attemptId);
            setMod(s.module);
            setQi(Math.min(s.qi ?? 0, s.module.questions.length - 1));
            setTimeLeft(s.timeLeft ?? s.module.durationSec);
            setAnswers(s.answers ?? {});
            setMarked(new Set<string>(s.marked ?? []));
            setCrossed(s.crossed ?? {});
            setStage("active");
            return;
          }
        }
      } catch { /* fall through to a fresh start */ }
    }

    (async () => {
      try {
        const res = await fetch("/api/attempts/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId: test.id, mode, module: practiceModule }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start the test");
        setAttemptId(data.attemptId);
        setMod(data.firstModule);
        setTimeLeft(data.firstModule.durationSec);
        setStage("active");
        saveSnapshot({ attemptId: data.attemptId, module: data.firstModule, qi: 0, timeLeft: data.firstModule.durationSec, answers: {}, marked: [], crossed: {} });
      } catch (e) {
        setErrorMsg((e as Error).message);
        setStage("error");
      }
    })();
  }, [test.id, mode, practiceModule]);

  // ───────── Submit current module ─────────
  const submitModule = useCallback(async () => {
    if (submittingRef.current || !attemptId || !mod) return;
    submittingRef.current = true;
    setStage("submitting");
    try {
      // Only this module's answers (server is authoritative anyway).
      const ids = new Set(mod.questions.map((x) => x.id));
      const moduleAnswers: AnswerMap = {};
      for (const [k, v] of Object.entries(answers)) if (ids.has(k)) moduleAnswers[k] = v;

      const res = await fetch(`/api/attempts/${attemptId}/submit-module`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: moduleAnswers }),
      });
      const data: SubmitModuleResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");

      if (data.stage === "module2") {
        // Overwrite the saved session with Module 2 so a refresh during the
        // transition resumes Module 2 (never re-submits Module 1).
        saveSnapshot({ attemptId, module: data.module, qi: 0, timeLeft: data.module.durationSec, answers: {}, marked: [], crossed: {} });
        setNextMod(data.module);
        setStage("transition");
        submittingRef.current = false;
      } else {
        clearSession();
        if (mockMode && onSubmitted) {
          onSubmitted({
            skill: test.skill,
            attemptId: data.attemptId,
            scaledScore: data.scaledScore,
            rawScore: data.rawScore,
            total: data.total,
          });
        } else {
          router.push(`/results/${data.attemptId}`);
        }
      }
    } catch (e) {
      submittingRef.current = false;
      setStage("review");
      alert((e as Error).message);
    }
  }, [attemptId, mod, answers, mockMode, onSubmitted, router, test.skill, saveSnapshot, clearSession]);

  // Autosave the live session so a refresh / disconnect can resume.
  useEffect(() => {
    if (!attemptId || !mod) return;
    if (stage !== "active" && stage !== "review") return;
    saveSnapshot({ attemptId, module: mod, qi, timeLeft, answers, marked: [...marked], crossed });
  }, [attemptId, mod, qi, timeLeft, answers, marked, crossed, stage, saveSnapshot]);

  // ───────── Continue to Module 2 ─────────
  const beginNextModule = () => {
    if (!nextMod) return;
    setMod(nextMod);
    setNextMod(null);
    setQi(0);
    setMarked(new Set());
    setCrossed({});
    setTimeLeft(nextMod.durationSec);
    stimulusStore.current = {};
    curStimRef.current = null;
    setStage("active");
    setShowNav(false);
  };

  // ───────── Timer (per module) ─────────
  useEffect(() => {
    if (stage !== "active" && stage !== "review") return;
    const id = setInterval(() => setTimeLeft((t) => (t <= 0 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (timeLeft > 0) return;
    if (stage === "active" || stage === "review") {
      const t = setTimeout(() => submitModule(), 0);
      return () => clearTimeout(t);
    }
  }, [timeLeft, stage, submitModule]);

  const lowTime = timeLeft <= 60;

  // ───────── Answer / mark / cross-out helpers ─────────
  const setAnswer = (id: string, v: string | string[]) =>
    setAnswers((p) => ({ ...p, [id]: v }));

  const toggleMark = () => {
    if (!q) return;
    setMarked((p) => {
      const n = new Set(p);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
  };

  const toggleCross = (optVal: string) => {
    if (!q) return;
    setCrossed((p) => {
      const cur = new Set(p[q.id] ?? []);
      if (cur.has(optVal)) cur.delete(optVal);
      else cur.add(optVal);
      return { ...p, [q.id]: [...cur] };
    });
  };

  const goPrev = () => setQi((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (qi < questions.length - 1) setQi((i) => i + 1);
    else setStage("review");
  };

  // ───────── Highlight / Note on the R&W stimulus ─────────
  const stimulusRef = useRef<HTMLDivElement>(null);
  const stimulusStore = useRef<Record<string, string>>({});
  const curStimRef = useRef<string | null>(null);
  const noteIdRef = useRef(0);
  const notesRef = useRef<Record<string, string>>({});
  const savedRangeRef = useRef<Range | null>(null);
  const [selBar, setSelBar] = useState<{ x: number; y: number; hasMarks: boolean } | null>(null);
  const [notePop, setNotePop] = useState<{ x: number; y: number; id: string; text: string } | null>(null);

  // Load / persist per-question stimulus HTML (keeps annotations on navigation).
  useEffect(() => {
    if (!isRW) return;
    const prev = curStimRef.current;
    if (prev && stimulusRef.current) stimulusStore.current[prev] = stimulusRef.current.innerHTML;
    const cur = questions[qi];
    curStimRef.current = cur?.id ?? null;
    if (stimulusRef.current) {
      stimulusRef.current.innerHTML =
        cur?.id && stimulusStore.current[cur.id] != null
          ? stimulusStore.current[cur.id]
          : cur?.stimulus ?? "";
    }
    setSelBar(null);
    setNotePop(null);
  }, [qi, mod, isRW, questions]);

  const stimRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const cont = stimulusRef.current;
    if (!cont || !cont.contains(range.commonAncestorContainer)) return null;
    return range;
  };

  const unwrap = (el: Element) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  };

  const rangeMarks = (range: Range) => {
    const cont = stimulusRef.current;
    if (!cont) return [];
    return Array.from(cont.querySelectorAll<HTMLElement>(".exam-hl, .exam-note"))
      .filter((m) => range.intersectsNode(m));
  };

  const onStimMouseUp = () => {
    const range = stimRange();
    if (!range) { savedRangeRef.current = null; setSelBar(null); return; }
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) { savedRangeRef.current = null; setSelBar(null); return; }
    savedRangeRef.current = range.cloneRange();
    setSelBar({ x: rect.left + rect.width / 2, y: rect.top, hasMarks: rangeMarks(range).length > 0 });
  };

  const wrapRange = (range: Range, make: () => HTMLElement) => {
    const cont = stimulusRef.current;
    if (!cont || range.collapsed) return [];
    const walker = document.createTreeWalker(cont, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const tn = n as Text;
      if (!tn.nodeValue) continue;
      const nr = document.createRange();
      nr.selectNodeContents(tn);
      const overlaps =
        range.compareBoundaryPoints(Range.END_TO_START, nr) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, nr) > 0;
      if (overlaps) nodes.push(tn);
    }
    const created: HTMLElement[] = [];
    nodes.forEach((tn) => {
      if (tn.parentElement?.closest(".exam-hl, .exam-note")) return;
      const len = tn.nodeValue!.length;
      let s = tn === range.startContainer ? range.startOffset : 0;
      let e = tn === range.endContainer ? range.endOffset : len;
      s = Math.max(0, Math.min(s, len));
      e = Math.max(0, Math.min(e, len));
      if (s >= e || !tn.nodeValue!.slice(s, e).trim()) return;
      const r = document.createRange();
      r.setStart(tn, s); r.setEnd(tn, e);
      const mark = make();
      try { r.surroundContents(mark); created.push(mark); } catch { /* skip */ }
    });
    return created;
  };

  const wrapWhole = (range: Range, make: () => HTMLElement) => {
    const mark = make();
    try { range.surroundContents(mark); return [mark]; }
    catch {
      try { mark.appendChild(range.extractContents()); range.insertNode(mark); return [mark]; }
      catch { return []; }
    }
  };

  const annotate = (make: () => HTMLElement) => {
    const range = stimRange() ?? savedRangeRef.current;
    if (!range || range.collapsed) return [];
    let created = wrapRange(range, make);
    if (!created.length) created = wrapWhole(range.cloneRange(), make);
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    return created;
  };

  const applyHighlight = () => {
    annotate(() => { const m = document.createElement("mark"); m.className = "exam-hl"; return m; });
    setSelBar(null);
  };

  const addNote = () => {
    const range = stimRange() ?? savedRangeRef.current;
    const rect = range?.getBoundingClientRect();
    const id = `n${++noteIdRef.current}`;
    const created = annotate(() => {
      const m = document.createElement("mark");
      m.className = "exam-note"; m.dataset.noteId = id; return m;
    });
    setSelBar(null);
    if (created.length && rect) {
      notesRef.current[id] = "";
      setNotePop({ x: rect.left + rect.width / 2, y: rect.bottom, id, text: "" });
    }
  };

  const clearSelection = () => {
    const range = stimRange() ?? savedRangeRef.current;
    if (!range) { setSelBar(null); return; }
    rangeMarks(range).forEach((m) => {
      if (m.classList.contains("exam-note") && m.dataset.noteId) delete notesRef.current[m.dataset.noteId];
      unwrap(m);
    });
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    setSelBar(null);
  };

  const onStimClick = (e: React.MouseEvent) => {
    const cont = stimulusRef.current;
    if (!cont) return;
    const note = (e.target as HTMLElement).closest(".exam-note") as HTMLElement | null;
    if (note && cont.contains(note) && note.dataset.noteId) {
      e.preventDefault(); e.stopPropagation();
      const id = note.dataset.noteId;
      const rect = note.getBoundingClientRect();
      setNotePop({ x: rect.left + rect.width / 2, y: rect.bottom, id, text: notesRef.current[id] ?? "" });
    }
  };

  const marksFor = (id: string) =>
    stimulusRef.current?.querySelectorAll<HTMLElement>(`.exam-note[data-note-id="${id}"]`) ?? [];

  const saveNote = () => {
    if (!notePop) return;
    notesRef.current[notePop.id] = notePop.text;
    marksFor(notePop.id).forEach((m) => {
      m.title = notePop.text;
      m.classList.toggle("has-note", !!notePop.text.trim());
    });
    setNotePop(null);
  };

  const deleteNote = () => {
    if (!notePop) return;
    marksFor(notePop.id).forEach((m) => unwrap(m));
    delete notesRef.current[notePop.id];
    setNotePop(null);
  };

  useEffect(() => {
    if (!selBar) return;
    const dismiss = (ev: Event) => {
      const t = ev.target as HTMLElement;
      if (t.closest?.("[data-sel-bar]")) return;
      setSelBar(null);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [selBar]);

  // ─────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────

  if (stage === "loading") {
    return (
      <div className="grid h-screen place-items-center bg-white text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
          <p className="text-sm">Preparing your test…</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="grid h-screen place-items-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-bold text-slate-900">Couldn&rsquo;t start the test</h2>
          <p className="mt-2 text-sm text-slate-500">{errorMsg}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Module-to-module transition (full adaptive test).
  if (stage === "transition" && nextMod) {
    const harder = nextMod.difficulty === "HARD";
    return (
      <div className="grid h-screen place-items-center bg-slate-50 px-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Module 1 complete</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            You&rsquo;re moving on to <strong>Module 2</strong>
            {harder ? " (harder set)" : ""}. You&rsquo;ll have{" "}
            <strong>{Math.round(nextMod.durationSec / 60)} minutes</strong> and{" "}
            <strong>{nextMod.questions.length} questions</strong>. You cannot return to Module 1.
          </p>
          <button
            onClick={beginNextModule}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start Module 2 <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const moduleLabel = mod?.title || `Module ${mod?.module ?? 1}`;
  const skillLabel = isRW ? "Reading & Writing" : "Math";

  // ───────── Review screen ─────────
  if (stage === "review" || stage === "submitting") {
    const isFinalModule = mode === "module" || mod?.module === 2;
    return (
      <div className="flex h-screen flex-col bg-white">
        <ExamHeader
          test={test} userName={userName} moduleLabel={moduleLabel}
          mockProgress={mockProgress} timeLeft={timeLeft} lowTime={lowTime}
          isMath={isMath} showCalc={showCalc} setShowCalc={setShowCalc}
          showFormula={showFormula} setShowFormula={setShowFormula}
          formulaSheet={mod?.formulaSheet} onBack={() => router.push("/dashboard")}
          hideTools
        />
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <div className="w-full max-w-2xl">
            <h2 className="text-center text-xl font-bold text-slate-900">
              Check your work — {moduleLabel}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              You&rsquo;ve answered {answeredCount} of {questions.length} questions.
              Review any you flagged before submitting.
            </p>
            <div className="mt-8 grid grid-cols-6 gap-2 sm:grid-cols-9">
              {questions.map((x, i) => {
                const v = answers[x.id];
                const done = Array.isArray(v) ? v.length > 0 : !!v?.trim();
                const flag = marked.has(x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => { setQi(i); setStage("active"); }}
                    className={`relative grid h-10 place-items-center rounded-lg border text-sm font-semibold ${
                      done
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-dashed border-slate-300 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {i + 1}
                    {flag && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                onClick={() => setStage("active")}
                disabled={stage === "submitting"}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Back to questions
              </button>
              <button
                onClick={submitModule}
                disabled={stage === "submitting"}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {stage === "submitting"
                  ? (<><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>)
                  : isFinalModule ? "Submit test" : "Submit & continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────── Active question screen ─────────
  const crossedForQ = q ? crossed[q.id] ?? [] : [];
  const isFlagged = q ? marked.has(q.id) : false;

  return (
    <div className="flex h-screen flex-col bg-white">
      <ExamHeader
        test={test} userName={userName} moduleLabel={moduleLabel}
        mockProgress={mockProgress} timeLeft={timeLeft} lowTime={lowTime}
        isMath={isMath} showCalc={showCalc} setShowCalc={setShowCalc}
        showFormula={showFormula} setShowFormula={setShowFormula}
        formulaSheet={mod?.formulaSheet} onBack={() => router.push("/dashboard")}
      />

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* R&W: stimulus on the left */}
        {isRW && (
          <div className="hidden min-h-0 w-1/2 flex-col border-r border-slate-200 lg:flex">
            <div className="exam-scroll flex-1 overflow-y-auto px-8 py-8" onMouseUp={onStimMouseUp} onClick={onStimClick}>
              {q?.groupTitle && (
                <p className="mb-4 rounded-r border-l-2 border-brand-500 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  {q.groupTitle}
                </p>
              )}
              <div ref={stimulusRef} className="passage select-text text-[15px] leading-relaxed text-slate-800" />
              {q?.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="mt-5 w-full max-w-lg rounded-lg border border-slate-200" />
              )}
              {!q?.stimulus && !q?.imageUrl && (
                <p className="text-sm italic text-slate-400">No passage for this question.</p>
              )}
            </div>
          </div>
        )}

        {/* Question + answer panel */}
        <div className={`flex min-h-0 flex-1 flex-col ${isRW ? "lg:w-1/2" : ""}`}>
          <div className="exam-scroll flex-1 overflow-y-auto px-6 py-8 sm:px-10">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-sm font-bold text-white">
                  {qi + 1}
                </span>
                <button
                  onClick={toggleMark}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isFlagged ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Flag className={`h-4 w-4 ${isFlagged ? "fill-amber-400 text-amber-500" : ""}`} />
                  {isFlagged ? "Marked" : "Mark for review"}
                </button>
              </div>

              {/* On small screens, show stimulus inline above the question */}
              {isRW && (q?.stimulus || q?.imageUrl) && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 lg:hidden">
                  {q?.stimulus && (
                    <div className="passage text-[15px] leading-relaxed text-slate-800"
                      dangerouslySetInnerHTML={{ __html: q.stimulus }} />
                  )}
                  {q?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="" className="mt-3 w-full rounded-lg border border-slate-200" />
                  )}
                </div>
              )}

              {/* Math figure */}
              {isMath && q?.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="mt-5 w-full max-w-md rounded-lg border border-slate-200" />
              )}

              {q?.prompt && (
                <p className="mt-5 text-[16px] leading-relaxed text-slate-900">{q.prompt}</p>
              )}

              <div className="mt-6">
                {q && (
                  <QuestionInput
                    question={q}
                    value={answers[q.id]}
                    onChange={(v) => setAnswer(q.id, v)}
                    crossedOut={crossedForQ}
                    onToggleCrossOut={q.options ? toggleCross : undefined}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="relative flex items-center justify-between border-t border-slate-200 px-5 py-3">
        <span className="hidden text-sm text-slate-400 sm:block">{userName}</span>
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => setShowNav((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <LayoutGrid className="h-4 w-4" />
            Question {qi + 1} of {questions.length}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={qi === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {qi < questions.length - 1 ? (<>Next <ChevronRight className="h-4 w-4" /></>) : "Review"}
          </button>
        </div>
      </footer>

      {/* Navigator popover */}
      {showNav && (
        <div className="fixed inset-0 z-30" onClick={() => setShowNav(false)}>
          <div
            className="absolute bottom-16 left-1/2 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{moduleLabel}</span>
              <button onClick={() => setShowNav(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-brand-600 bg-brand-50" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-slate-300" /> Unanswered</span>
              <span className="flex items-center gap-1.5"><Flag className="h-3 w-3 fill-amber-400 text-amber-500" /> Marked</span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
              {questions.map((x, i) => {
                const v = answers[x.id];
                const done = Array.isArray(v) ? v.length > 0 : !!v?.trim();
                const flag = marked.has(x.id);
                const current = i === qi;
                return (
                  <button
                    key={x.id}
                    onClick={() => { setQi(i); setShowNav(false); }}
                    className={`relative grid h-10 place-items-center rounded-lg border text-sm font-semibold ${
                      current ? "border-slate-900 ring-1 ring-slate-900" : ""
                    } ${
                      done ? "border-brand-600 bg-brand-50 text-brand-700"
                           : "border-dashed border-slate-300 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {i + 1}
                    {flag && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowNav(false); setStage("review"); }}
              className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to review page
            </button>
          </div>
        </div>
      )}

      {/* Calculator & formula slide-overs (Math) */}
      {isMath && showCalc && <CalculatorPanel onClose={() => setShowCalc(false)} />}
      {isMath && showFormula && mod?.formulaSheet !== false && <FormulaSheet onClose={() => setShowFormula(false)} />}

      {/* Selection toolbar (R&W) */}
      {isRW && selBar && (
        <div data-sel-bar style={{ left: selBar.x, top: selBar.y - 12 }}
          className="fixed z-40 -translate-x-1/2 -translate-y-full">
          <div className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <button onMouseDown={(e) => { e.preventDefault(); addNote(); }}
              className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 hover:bg-slate-50">
              <Quote className="h-5 w-5" /><span className="text-xs font-medium">Note</span>
            </button>
            <div className="w-px bg-slate-200" />
            <button onMouseDown={(e) => { e.preventDefault(); applyHighlight(); }}
              className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 hover:bg-amber-50">
              <Highlighter className="h-5 w-5 text-amber-500" /><span className="text-xs font-medium">Highlight</span>
            </button>
            {selBar.hasMarks && (
              <>
                <div className="w-px bg-slate-200" />
                <button onMouseDown={(e) => { e.preventDefault(); clearSelection(); }}
                  className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 hover:bg-red-50">
                  <Eraser className="h-5 w-5 text-red-400" /><span className="text-xs font-medium">Clear</span>
                </button>
              </>
            )}
          </div>
          <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-slate-200 bg-white" />
        </div>
      )}

      {/* Note editor */}
      {isRW && notePop && (
        <div data-sel-bar style={{ left: notePop.x, top: notePop.y + 10 }}
          className="fixed z-40 w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Quote className="h-3.5 w-3.5" /> Note
          </div>
          <textarea autoFocus value={notePop.text}
            onChange={(e) => setNotePop({ ...notePop, text: e.target.value })}
            placeholder="Write a note…"
            className="h-24 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm text-slate-800 outline-none focus:border-brand-600" />
          <div className="mt-2 flex items-center justify-between">
            <button onClick={deleteNote} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600">
              <Eraser className="h-3.5 w-3.5" /> Delete
            </button>
            <div className="flex gap-2">
              <button onClick={() => (notePop.text.trim() ? setNotePop(null) : deleteNote())}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
              <button onClick={saveNote}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Shared header ─────────
function ExamHeader({
  test, userName, moduleLabel, mockProgress, timeLeft, lowTime,
  isMath, showCalc, setShowCalc, showFormula, setShowFormula, formulaSheet,
  onBack, hideTools = false,
}: {
  test: ClientExamMeta;
  userName?: string;
  moduleLabel: string;
  mockProgress?: { step: number; total: number };
  timeLeft: number;
  lowTime: boolean;
  isMath: boolean;
  showCalc: boolean;
  setShowCalc: (f: (v: boolean) => boolean) => void;
  showFormula: boolean;
  setShowFormula: (f: (v: boolean) => boolean) => void;
  formulaSheet?: boolean;
  onBack: () => void;
  hideTools?: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>
        <span className="flex shrink-0 items-center text-lg font-extrabold tracking-tight text-slate-900">
          SAT<span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
        </span>
        <span className="hidden text-sm font-medium text-slate-600 sm:inline">{moduleLabel}</span>
        {mockProgress && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">
            Mock · {mockProgress.step}/{mockProgress.total}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${
          lowTime ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"
        }`}>
          <Clock className="h-4 w-4" /> {fmt(Math.max(0, timeLeft))}
        </span>
        {isMath && !hideTools && (
          <>
            <button onClick={() => setShowCalc((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                showCalc ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}>
              <Calculator className="h-4 w-4" /> Calculator
            </button>
            {formulaSheet !== false && (
              <button onClick={() => setShowFormula((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  showFormula ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}>
                <BookOpen className="h-4 w-4" /> Reference
              </button>
            )}
          </>
        )}
        {userName && <span className="hidden text-sm text-slate-400 md:inline">{test.title}</span>}
      </div>
    </header>
  );
}
