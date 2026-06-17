"use client";

import { useEffect, useState } from "react";
import {
  BookText,
  ArrowLeft,
  ArrowRight,
  Shuffle,
  RotateCcw,
  Check,
  X,
  Sparkles,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import type { VocabDeck, VocabWord } from "@/lib/vocabulary";

const STORAGE_KEY = "satway_vocab_known";

type Mode = { kind: "decks" } | { kind: "study"; deckId: string } | { kind: "quiz"; deckId: string };

function loadKnown(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabularyClient({ decks }: { decks: VocabDeck[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "decks" });
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage hydration */
    setKnown(loadKnown());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const persist = (next: Set<string>) => {
    setKnown(new Set(next));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // ignore quota / private-mode errors
    }
  };

  const toggleKnown = (id: string, value: boolean) => {
    const next = new Set(known);
    if (value) next.add(id);
    else next.delete(id);
    persist(next);
  };

  const activeDeck = mode.kind !== "decks" ? decks.find((d) => d.id === mode.deckId) : undefined;

  if (mode.kind === "study" && activeDeck) {
    return (
      <StudyMode
        deck={activeDeck}
        known={known}
        onSetKnown={toggleKnown}
        onExit={() => setMode({ kind: "decks" })}
        onQuiz={() => setMode({ kind: "quiz", deckId: activeDeck.id })}
      />
    );
  }

  if (mode.kind === "quiz" && activeDeck) {
    return (
      <QuizMode
        deck={activeDeck}
        onMarkKnown={(id) => toggleKnown(id, true)}
        onExit={() => setMode({ kind: "decks" })}
        onStudy={() => setMode({ kind: "study", deckId: activeDeck.id })}
      />
    );
  }

  const total = decks.reduce((n, d) => n + d.words.length, 0);
  const knownTotal = decks.reduce(
    (n, d) => n + d.words.filter((w) => known.has(w.id)).length,
    0,
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <BookText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vocabulary</h1>
          <p className="text-sm text-slate-500">
            Master the words that show up most on the SAT — flashcards &amp; quizzes.
          </p>
        </div>
      </div>

      {hydrated && total > 0 && (
        <div className="mt-6 rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Words mastered</span>
            <span className="font-bold text-brand-600">
              {knownTotal} / {total}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${total ? (knownTotal / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {decks.map((deck) => {
          const deckKnown = deck.words.filter((w) => known.has(w.id)).length;
          const done = hydrated && deckKnown === deck.words.length;
          return (
            <div
              key={deck.id}
              className="flex flex-col rounded-2xl border border-[#EAEAEA] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{deck.title}</h2>
                {done && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
              </div>
              <p className="mt-1 flex-1 text-sm text-slate-500">{deck.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{deck.words.length} words</span>
                {hydrated && (
                  <span className="font-medium text-brand-600">{deckKnown} mastered</span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setMode({ kind: "study", deckId: deck.id })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Sparkles className="h-4 w-4" /> Study
                </button>
                <button
                  onClick={() => setMode({ kind: "quiz", deckId: deck.id })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <GraduationCap className="h-4 w-4" /> Quiz
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Study mode — flashcards
// ─────────────────────────────────────────────────────────────

function StudyMode({
  deck,
  known,
  onSetKnown,
  onExit,
  onQuiz,
}: {
  deck: VocabDeck;
  known: Set<string>;
  onSetKnown: (id: string, value: boolean) => void;
  onExit: () => void;
  onQuiz: () => void;
}) {
  const [order, setOrder] = useState<VocabWord[]>(deck.words);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = order[idx];
  const isKnown = known.has(card.id);

  const go = (delta: number) => {
    setFlipped(false);
    setIdx((i) => (i + delta + order.length) % order.length);
  };

  const reshuffle = () => {
    setOrder(shuffle(deck.words));
    setIdx(0);
    setFlipped(false);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> All decks
        </button>
        <button
          onClick={reshuffle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Shuffle className="h-4 w-4" /> Shuffle
        </button>
      </div>

      <h1 className="mt-4 text-xl font-bold text-slate-900">{deck.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Card {idx + 1} of {order.length} · tap the card to flip
      </p>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="mt-5 flex min-h-[15rem] w-full flex-col items-center justify-center rounded-3xl border border-[#EAEAEA] bg-white p-8 text-center shadow-sm transition-colors hover:border-brand-200"
      >
        {!flipped ? (
          <>
            <span className="text-3xl font-bold text-slate-900">{card.word}</span>
            <span className="mt-2 text-sm italic text-slate-400">{card.pos}</span>
            <span className="mt-6 text-xs uppercase tracking-wide text-slate-300">
              Tap to reveal definition
            </span>
          </>
        ) : (
          <>
            <p className="text-lg text-slate-800">{card.definition}</p>
            <p className="mt-4 text-sm italic text-slate-500">&ldquo;{card.example}&rdquo;</p>
            {card.synonyms && card.synonyms.length > 0 && (
              <p className="mt-4 text-xs text-slate-400">
                Synonyms: {card.synonyms.join(", ")}
              </p>
            )}
          </>
        )}
      </button>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          onClick={() => go(-1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
          aria-label="Previous card"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button
          onClick={() => onSetKnown(card.id, !isKnown)}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            isKnown
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {isKnown ? (
            <>
              <Check className="h-4 w-4" /> Mastered — tap to unmark
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Mark as mastered
            </>
          )}
        </button>

        <button
          onClick={() => go(1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
          aria-label="Next card"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={onQuiz}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <GraduationCap className="h-4 w-4" /> Quiz this deck
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Quiz mode — multiple choice (word → definition)
// ─────────────────────────────────────────────────────────────

interface QuizItem {
  word: VocabWord;
  options: string[]; // definitions
  answer: number;
}

function buildQuiz(deck: VocabDeck): QuizItem[] {
  const words = shuffle(deck.words);
  return words.map((word) => {
    const distractors = shuffle(deck.words.filter((w) => w.id !== word.id))
      .slice(0, 3)
      .map((w) => w.definition);
    const options = shuffle([word.definition, ...distractors]);
    return { word, options, answer: options.indexOf(word.definition) };
  });
}

function QuizMode({
  deck,
  onMarkKnown,
  onExit,
  onStudy,
}: {
  deck: VocabDeck;
  onMarkKnown: (id: string) => void;
  onExit: () => void;
  onStudy: () => void;
}) {
  // QuizMode only ever mounts after a client interaction, so building the quiz
  // (which uses Math.random) in a lazy initializer is safe — no SSR / hydration.
  const [quiz, setQuiz] = useState<QuizItem[]>(() => buildQuiz(deck));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const restart = () => {
    setQuiz(buildQuiz(deck));
    setIdx(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  if (quiz.length === 0) return null;

  if (done) {
    const pct = Math.round((score / quiz.length) * 100);
    return (
      <div className="py-6">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> All decks
        </button>
        <div className="mt-8 rounded-3xl border border-[#EAEAEA] bg-white p-10 text-center">
          <span className="grid mx-auto h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <GraduationCap className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">
            {score} / {quiz.length} correct
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {pct >= 80
              ? "Excellent — these words are sticking!"
              : pct >= 50
                ? "Good progress. Review the misses and try again."
                : "Keep studying — repetition is how vocab sticks."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              onClick={onStudy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Sparkles className="h-4 w-4" /> Study deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  const item = quiz[idx];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === item.answer) {
      setScore((s) => s + 1);
      onMarkKnown(item.word.id);
    }
  };

  const next = () => {
    if (idx + 1 >= quiz.length) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> All decks
        </button>
        <span className="text-sm font-medium text-slate-500">
          {idx + 1} / {quiz.length}
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${(idx / quiz.length) * 100}%` }}
        />
      </div>

      <p className="mt-6 text-sm text-slate-500">What does this word mean?</p>
      <h2 className="mt-1 text-3xl font-bold text-slate-900">{item.word.word}</h2>
      <p className="text-sm italic text-slate-400">{item.word.pos}</p>

      <div className="mt-5 space-y-3">
        {item.options.map((opt, i) => {
          const isAnswer = i === item.answer;
          const isPicked = i === picked;
          let style = "border-slate-200 bg-white hover:border-brand-300";
          if (picked !== null) {
            if (isAnswer) style = "border-emerald-300 bg-emerald-50";
            else if (isPicked) style = "border-red-300 bg-red-50";
            else style = "border-slate-200 bg-white opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm text-slate-700 transition-colors ${style}`}
            >
              <span>{opt}</span>
              {picked !== null && isAnswer && (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              {picked !== null && isPicked && !isAnswer && (
                <X className="h-4 w-4 shrink-0 text-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-5">
          <p className="text-sm italic text-slate-500">
            &ldquo;{item.word.example}&rdquo;
          </p>
          <button
            onClick={next}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {idx + 1 >= quiz.length ? "See results" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
