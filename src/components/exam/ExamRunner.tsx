"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronLeft, ChevronRight, Send, Highlighter, Eraser, Quote, Maximize, Minimize, ArrowLeft, Calculator, BookOpen } from "lucide-react";
import type { ClientTest, AnswerMap } from "@/lib/types";
import QuestionInput from "./QuestionInput";

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

export default function ExamRunner({
  test,
  userName,
  initialModule,
  mockMode = false,
  mockProgress,
  onSubmitted,
}: {
  test: ClientTest;
  userName?: string;
  initialModule?: number;
  mockMode?: boolean;
  mockProgress?: { step: number; total: number };
  onSubmitted?: (r: MockResult) => void;
}) {
  const router = useRouter();
  const isRW = test.skill === "READING_WRITING";
  const isMath = test.skill === "MATH";

  const modIdx =
    initialModule != null &&
    initialModule >= 1 &&
    initialModule <= test.sections.length
      ? initialModule - 1
      : null;
  const locked = modIdx != null;

  // Each module gets its proportional share of the total duration
  const modDurationSec = locked
    ? Math.round(test.durationSec / Math.max(1, test.sections.length))
    : test.durationSec;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [sectionIdx, setSectionIdx] = useState(modIdx ?? 0);
  const [timeLeft, setTimeLeft] = useState(modDurationSec);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const submittedRef = useRef(false);

  const section = test.sections[sectionIdx];
  const allQuestions = useMemo(
    () => test.sections.flatMap((s) => s.questions),
    [test.sections],
  );
  const answeredCount = Object.values(answers).filter(
    (v) => (Array.isArray(v) ? v.length > 0 : v?.trim()),
  ).length;

  const setAnswer = (qid: string, v: string | string[]) =>
    setAnswers((prev) => ({ ...prev, [qid]: v }));

  // Question palette reflects the current module
  const paletteQuestions = modIdx != null
    ? test.sections[modIdx]?.questions ?? []
    : allQuestions;
  const paletteAnswered = paletteQuestions.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : v?.trim();
  }).length;

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test.id,
          answers,
          ...(modIdx != null ? { module: modIdx + 1 } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit the test");
      if (mockMode && onSubmitted) {
        onSubmitted({
          skill: test.skill,
          attemptId: data.attemptId,
          scaledScore: data.scaledScore ?? null,
          rawScore: data.rawScore ?? null,
          total: data.total ?? null,
        });
      } else {
        router.push(`/results/${data.attemptId}`);
      }
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      alert((e as Error).message);
    }
  }, [answers, test.id, test.skill, router, modIdx, mockMode, onSubmitted]);

  // Countdown timer
  useEffect(() => {
    const id = setInterval(
      () => setTimeLeft((t) => (t <= 0 ? 0 : t - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft > 0) return;
    const t = setTimeout(() => submit(), 0);
    return () => clearTimeout(t);
  }, [timeLeft, submit]);

  const lowTime = timeLeft <= 60;

  // ───────── Highlight / Note (passages) ─────────
  const bodyRef = useRef<HTMLDivElement>(null);
  const passageHtmlRef = useRef<HTMLDivElement>(null);
  const noteIdRef = useRef(0);
  const notesRef = useRef<Record<string, string>>({});
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const el = passageHtmlRef.current;
    if (el) el.innerHTML = section.passageText ?? "";
  }, [section.passageText]);

  const [selBar, setSelBar] = useState<
    { x: number; y: number; hasMarks: boolean } | null
  >(null);
  const [notePop, setNotePop] = useState<
    { x: number; y: number; id: string; text: string } | null
  >(null);

  // ───────── Calculator & Formula Sheet (Math only) ─────────
  const [showCalc, setShowCalc] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const bodyRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const cont = bodyRef.current;
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
    const cont = bodyRef.current;
    if (!cont) return [];
    return Array.from(
      cont.querySelectorAll<HTMLElement>(".exam-hl, .exam-note"),
    ).filter((m) => range.intersectsNode(m));
  };

  const onBodyMouseUp = () => {
    const range = bodyRange();
    if (!range) {
      savedRangeRef.current = null;
      setSelBar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      savedRangeRef.current = null;
      setSelBar(null);
      return;
    }
    savedRangeRef.current = range.cloneRange();
    setSelBar({
      x: rect.left + rect.width / 2,
      y: rect.top,
      hasMarks: rangeMarks(range).length > 0,
    });
  };

  const wrapRange = (range: Range, make: () => HTMLElement) => {
    const cont = bodyRef.current;
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
      r.setStart(tn, s);
      r.setEnd(tn, e);
      const mark = make();
      try {
        r.surroundContents(mark);
        created.push(mark);
      } catch {
        /* skip */
      }
    });
    return created;
  };

  const wrapWhole = (range: Range, make: () => HTMLElement) => {
    const mark = make();
    try {
      range.surroundContents(mark);
      return [mark];
    } catch {
      try {
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
        return [mark];
      } catch {
        return [];
      }
    }
  };

  const annotate = (make: () => HTMLElement) => {
    const range = bodyRange() ?? savedRangeRef.current;
    if (!range || range.collapsed) return [];
    let created = wrapRange(range, make);
    if (!created.length) created = wrapWhole(range.cloneRange(), make);
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    return created;
  };

  const applyHighlight = () => {
    annotate(() => {
      const m = document.createElement("mark");
      m.className = "exam-hl";
      return m;
    });
    setSelBar(null);
  };

  const addNote = () => {
    const range = bodyRange() ?? savedRangeRef.current;
    const rect = range?.getBoundingClientRect();
    const id = `n${++noteIdRef.current}`;
    const created = annotate(() => {
      const m = document.createElement("mark");
      m.className = "exam-note";
      m.dataset.noteId = id;
      return m;
    });
    setSelBar(null);
    if (created.length && rect) {
      notesRef.current[id] = "";
      setNotePop({ x: rect.left + rect.width / 2, y: rect.bottom, id, text: "" });
    }
  };

  const clearSelection = () => {
    const range = bodyRange() ?? savedRangeRef.current;
    if (!range) {
      setSelBar(null);
      return;
    }
    rangeMarks(range).forEach((m) => {
      if (m.classList.contains("exam-note") && m.dataset.noteId)
        delete notesRef.current[m.dataset.noteId];
      unwrap(m);
    });
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    setSelBar(null);
  };

  const onBodyClick = (e: React.MouseEvent) => {
    const cont = bodyRef.current;
    if (!cont) return;
    const note = (e.target as HTMLElement).closest(
      ".exam-note",
    ) as HTMLElement | null;
    if (note && cont.contains(note) && note.dataset.noteId) {
      e.preventDefault();
      e.stopPropagation();
      const id = note.dataset.noteId;
      const rect = note.getBoundingClientRect();
      setNotePop({
        x: rect.left + rect.width / 2,
        y: rect.bottom,
        id,
        text: notesRef.current[id] ?? "",
      });
    }
  };

  const marksFor = (id: string) =>
    bodyRef.current?.querySelectorAll<HTMLElement>(
      `.exam-note[data-note-id="${id}"]`,
    ) ?? [];

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

  const clearAllMarks = () => {
    bodyRef.current
      ?.querySelectorAll(".exam-hl, .exam-note")
      .forEach((m) => unwrap(m));
    notesRef.current = {};
    setSelBar(null);
    setNotePop(null);
  };

  // ───────── Fullscreen ─────────
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };

  // Dismiss the selection toolbar when clicking elsewhere or scrolling
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

  const jumpTo = (qid: string) => {
    const el = document.getElementById(`q-${qid}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ───────── Inline passage + questions for Reading & Writing ─────────
  const passageQuestionsContent = (
    <div className="exam-scroll min-h-0 flex-1 overflow-y-auto">
      {/* Module header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-6 lg:px-10 py-4">
        <h2 className="text-lg font-bold text-slate-900">
          {section.title || `Module ${sectionIdx + 1}`}
        </h2>
        {section.instructions && (
          <p className="mt-1 text-sm text-slate-500 italic">{section.instructions}</p>
        )}
      </div>

      <div className="px-6 lg:px-10 py-6 space-y-12">
        {/* Passage (if any) */}
        {section.passageText && (
          <div className="max-w-3xl">
            <div
              ref={passageHtmlRef}
              className="passage select-text text-[15px] text-slate-800"
            />
          </div>
        )}

        {/* Image */}
        {section.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={section.imageUrl}
            alt="Question image"
            className="w-full max-w-xl rounded-lg border border-slate-200"
          />
        )}

        {/* Questions */}
        <div className="max-w-3xl space-y-6">
          {section.questions.map((q, i) => {
            const prevGroup = i > 0 ? section.questions[i - 1].groupTitle : null;
            const showGroup = q.groupTitle && q.groupTitle !== prevGroup;
            return (
              <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                {showGroup && (
                  <p className="text-sm font-semibold text-slate-700 bg-slate-50 border-l-2 border-brand-500 px-3 py-2 rounded-r mb-4">
                    {q.groupTitle}
                  </p>
                )}
                <div className="flex gap-3">
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0">
                    {q.order}
                  </span>
                  <div className="flex-1">
                    {q.prompt && (
                      <p className="text-[15px] text-slate-800 mb-3">{q.prompt}</p>
                    )}
                    <QuestionInput
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswer(q.id, v)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module nav */}
        <div className={`mt-8 flex items-center justify-between max-w-3xl ${locked ? "hidden" : ""}`}>
          <button
            disabled={sectionIdx === 0}
            onClick={() => setSectionIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            <ChevronLeft className="w-4 h-4" /> Previous Module
          </button>
          <button
            disabled={sectionIdx === test.sections.length - 1}
            onClick={() => setSectionIdx((i) => Math.min(test.sections.length - 1, i + 1))}
            className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            Next Module <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ───────── Math content ─────────
  const mathContent = (
    <div className="exam-scroll min-h-0 flex-1 overflow-y-auto">
      {/* Module header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-6 lg:px-10 py-4">
        <h2 className="text-lg font-bold text-slate-900">
          {section.title || `Module ${sectionIdx + 1}`}
        </h2>
        {section.instructions && (
          <p className="mt-1 text-sm text-slate-500 italic">{section.instructions}</p>
        )}
      </div>

      <div className="px-6 lg:px-10 py-6 space-y-6">
        {/* Questions */}
        <div className="max-w-2xl space-y-6">
          {section.questions.map((q, i) => {
            const prevGroup = i > 0 ? section.questions[i - 1].groupTitle : null;
            const showGroup = q.groupTitle && q.groupTitle !== prevGroup;
            return (
              <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                {showGroup && (
                  <p className="text-sm font-semibold text-slate-700 bg-slate-50 border-l-2 border-brand-500 px-3 py-2 rounded-r mb-4">
                    {q.groupTitle}
                  </p>
                )}
                <div className="flex gap-3">
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0">
                    {q.order}
                  </span>
                  <div className="flex-1">
                    {q.prompt && (
                      <p className="text-[15px] text-slate-800 mb-3">{q.prompt}</p>
                    )}
                    <QuestionInput
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswer(q.id, v)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module nav */}
        <div className={`mt-8 flex items-center justify-between max-w-2xl ${locked ? "hidden" : ""}`}>
          <button
            disabled={sectionIdx === 0}
            onClick={() => setSectionIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            <ChevronLeft className="w-4 h-4" /> Previous Module
          </button>
          <button
            disabled={sectionIdx === test.sections.length - 1}
            onClick={() => setSectionIdx((i) => Math.min(test.sections.length - 1, i + 1))}
            className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            Next Module <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calculator panel (slide-over) */}
      {showCalc && (
        <div className="fixed inset-y-0 right-0 w-[340px] max-w-[90vw] z-20 bg-white border-l border-slate-200 shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Calculator className="w-4 h-4" /> Calculator
            </span>
            <button
              onClick={() => setShowCalc(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Calculator className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Desmos calculator
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Embedded calculator will be available here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formula Sheet panel (slide-over) */}
      {showFormula && (
        <div className="fixed inset-y-0 right-0 w-[380px] max-w-[90vw] z-20 bg-white border-l border-slate-200 shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Formula Sheet
            </span>
            <button
              onClick={() => setShowFormula(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="exam-scroll flex-1 overflow-y-auto p-6">
            <div className="space-y-6 text-sm text-slate-700">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Area &amp; Volume</h4>
                <ul className="space-y-1 text-slate-600">
                  <li>Circle: <em>A = &pi;r&sup2;</em></li>
                  <li>Circumference: <em>C = 2&pi;r</em></li>
                  <li>Rectangle area: <em>A = lw</em></li>
                  <li>Triangle area: <em>A = &frac12;bh</em></li>
                  <li>Trapezoid area: <em>A = &frac12;(b&sb1; + b&sb2;)h</em></li>
                  <li>Sphere volume: <em>V = &#8531; &pi;r&sup3;</em></li>
                  <li>Sphere surface: <em>SA = 4&pi;r&sup2;</em></li>
                  <li>Cone volume: <em>V = &#8531; &pi;r&sup2;h</em></li>
                  <li>Cylinder volume: <em>V = &pi;r&sup2;h</em></li>
                  <li>Pyramid volume: <em>V = &#8531;Bh</em></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Pythagorean Theorem</h4>
                <p className="text-slate-600"><em>a&sup2; + b&sup2; = c&sup2;</em></p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Special Right Triangles</h4>
                <p className="text-slate-600">30-60-90 and 45-45-90 triangle side ratios</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Quadratic Formula</h4>
                <p className="text-slate-600">x = [&minus;b &plusmn; &radic;(b&sup2; &minus; 4ac)] / 2a</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Distance in Coordinate Plane</h4>
                <p className="text-slate-600">d = &radic;[(x&sb2; &minus; x&sb1;)&sup2; + (y&sb2; &minus; y&sb1;)&sup2;]</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Slope-Intercept Form</h4>
                <p className="text-slate-600">y = mx + b</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">CIRCLE Equation</h4>
                <p className="text-slate-600">(x &minus; h)&sup2; + (y &minus; k)&sup2; = r&sup2;</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Degrees &amp; Radians</h4>
                <p className="text-slate-600">180&deg; = &pi; radians</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Exponent Rules</h4>
                <ul className="space-y-1 text-slate-600">
                  <li>x&bull; x&bull; = x&bull;+&bull;</li>
                  <li>x&bull; / x&bull; = x&bull;&minus;&bull;</li>
                  <li>(x&bull;)&bull; = x&bull;&bull;</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const skillLabel = isRW ? "Reading & Writing" : "Math";

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top bar */}
      <header className="border-b border-slate-200 px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="flex items-center text-lg font-extrabold tracking-tight text-slate-900 shrink-0">
            SAT
            <span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
          </span>
          {mockProgress && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 shrink-0">
              Mock &middot; {skillLabel} {mockProgress.step}/{mockProgress.total}
            </span>
          )}
          {userName && (
            <span className="hidden md:inline text-sm text-slate-400 truncate">{userName}</span>
          )}
          <span className="hidden sm:inline text-sm text-slate-400 truncate">{test.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {isRW && (
            <>
              <button
                onClick={clearAllMarks}
                title="Clear all highlights and notes"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                <Eraser className="w-4 h-4" /> Clear
              </button>
            </>
          )}
          {isMath && (
            <>
              <button
                onClick={() => setShowCalc((v) => !v)}
                title="Toggle calculator"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  showCalc
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Calculator className="w-4 h-4" /> Calculator
              </button>
              <button
                onClick={() => setShowFormula((v) => !v)}
                title="Formula reference sheet"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  showFormula
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <BookOpen className="w-4 h-4" /> Formulas
              </button>
            </>
          )}
          <button
            onClick={toggleFullscreen}
            title={isFs ? "Exit fullscreen" : "Fullscreen"}
            className="grid place-items-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            {isFs ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${
              lowTime ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Clock className="w-4 h-4" /> {fmt(Math.max(0, timeLeft))}
          </span>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="w-4 h-4" /> Submit
          </button>
        </div>
      </header>

      {/* Module tabs (hidden when locked to a single module) */}
      {test.sections.length > 1 && !locked && (
        <div className="border-b border-slate-200 px-5 flex gap-1 shrink-0 overflow-x-auto">
          {test.sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSectionIdx(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                i === sectionIdx
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {s.title || `Module ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        ref={bodyRef}
        onMouseUp={isRW ? onBodyMouseUp : undefined}
        onClick={isRW ? onBodyClick : undefined}
        className="flex-1 min-h-0 flex flex-col"
      >
        {isRW
          ? passageQuestionsContent
          : isMath
            ? mathContent
            : null}
      </div>

      {/* Question palette */}
      <footer className="relative border-t border-slate-200 px-5 py-2.5 shrink-0">
        <span className="absolute left-5 top-1/2 hidden -translate-y-1/2 text-xs text-slate-400 sm:block">
          {locked ? paletteAnswered : answeredCount}/{paletteQuestions.length}
        </span>
        <div className="flex justify-center gap-1.5 overflow-x-auto">
          {paletteQuestions.map((q) => {
            const a = answers[q.id];
            const done = Array.isArray(a) ? a.length > 0 : a?.trim();
            return (
              <button
                key={q.id}
                onClick={() => {
                  const si = test.sections.findIndex((s) =>
                    s.questions.some((x) => x.id === q.id),
                  );
                  if (si !== sectionIdx) setSectionIdx(si);
                  setTimeout(() => jumpTo(q.id), 50);
                }}
                className={`w-7 h-7 rounded text-xs font-medium shrink-0 ${
                  done
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {q.order}
              </button>
            );
          })}
        </div>
      </footer>

      {/* Selection toolbar — Note | Highlight | Clear (Reading & Writing only) */}
      {isRW && selBar && (
        <div
          data-sel-bar
          style={{ left: selBar.x, top: selBar.y - 12 }}
          className="fixed z-30 -translate-x-1/2 -translate-y-full"
        >
          <div className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                addNote();
              }}
              className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Quote className="h-5 w-5" />
              <span className="text-xs font-medium">Note</span>
            </button>
            <div className="w-px bg-slate-200" />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyHighlight();
              }}
              className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 transition-colors hover:bg-amber-50"
            >
              <Highlighter className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-medium">Highlight</span>
            </button>
            {selBar.hasMarks && (
              <>
                <div className="w-px bg-slate-200" />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearSelection();
                  }}
                  className="flex flex-col items-center gap-1 px-6 py-3 text-slate-700 transition-colors hover:bg-red-50"
                >
                  <Eraser className="h-5 w-5 text-red-400" />
                  <span className="text-xs font-medium">Clear</span>
                </button>
              </>
            )}
          </div>
          <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-slate-200 bg-white" />
        </div>
      )}

      {/* Note editor popover */}
      {isRW && notePop && (
        <div
          data-sel-bar
          style={{ left: notePop.x, top: notePop.y + 10 }}
          className="fixed z-30 w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Quote className="h-3.5 w-3.5" /> Note
          </div>
          <textarea
            autoFocus
            value={notePop.text}
            onChange={(e) => setNotePop({ ...notePop, text: e.target.value })}
            placeholder="Write a note for this text…"
            className="h-24 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm text-slate-800 outline-none focus:border-brand-600"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={deleteNote}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
            >
              <Eraser className="h-3.5 w-3.5" /> Delete
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => (notePop.text.trim() ? setNotePop(null) : deleteNote())}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-20 bg-black/40 grid place-items-center px-5">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-lg text-slate-900">Submit the test?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You have answered {locked ? paletteAnswered : answeredCount} of{" "}
              {paletteQuestions.length} questions. Once submitted, your answers
              can&rsquo;t be changed.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
