import type { SatQuestionType } from "./grading";

/** A question as sent to the browser — never includes correctAnswers. */
export type ClientQuestion = {
  id: string;
  order: number;
  type: SatQuestionType;
  groupTitle: string | null;
  stimulus: string | null; // per-question passage / text (R&W split-screen)
  imageUrl: string | null; // per-question figure / graph
  prompt: string | null;
  options: string[] | null;
  meta: Record<string, unknown> | null;
};

export type ClientSection = {
  id: string;
  order: number;
  title: string | null;
  instructions: string | null;
  passageText: string | null;
  imageUrl: string | null;
  formulaSheet: boolean;
  questions: ClientQuestion[];
};

export type ClientTest = {
  id: string;
  title: string;
  slug: string;
  skill: "READING_WRITING" | "MATH";
  type: "DIGITAL" | "PAPER";
  durationSec: number;
  sections: ClientSection[];
};

export type AnswerMap = Record<string, string | string[]>;

// ─────────────────────────────────────────────────────────────
// Adaptive exam payloads (Bluebook-style flow)
// ─────────────────────────────────────────────────────────────

export type ModuleDifficulty = "STANDARD" | "EASY" | "HARD";

/** A single module's worth of work served to the client at one time. */
export type ClientModule = {
  module: number; // 1 or 2
  difficulty: ModuleDifficulty;
  title: string | null;
  instructions: string | null;
  passageText: string | null; // legacy shared passage (R&W); per-question stimulus preferred
  formulaSheet: boolean;
  durationSec: number;
  questions: ClientQuestion[];
};

/** Lightweight test metadata for the runner (no questions). */
export type ClientExamMeta = {
  id: string;
  title: string;
  slug: string;
  skill: "READING_WRITING" | "MATH";
  type: "DIGITAL" | "PAPER";
};

/** What /test/[slug] hands to <ExamRunner> for a full adaptive test. */
export type ExamStartPayload = {
  test: ClientExamMeta;
  mode: "full" | "module";
  practiceModule?: number; // for single-module practice
  firstModule: ClientModule; // Module 1 (full) or the practiced module
};

/** Result of submitting a module via the adaptive API. */
export type SubmitModuleResult =
  | { stage: "module2"; module: ClientModule }
  | {
      stage: "done";
      attemptId: string;
      scaledScore: number | null;
      rawScore: number | null;
      total: number | null;
    };
