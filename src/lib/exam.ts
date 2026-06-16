// Server-side helpers for the adaptive (two-module) exam flow.
// Central place that decides module timing, selects sections, and — crucially —
// strips correctAnswers before anything is sent to the browser.

import type { ClientModule, ClientQuestion, ModuleDifficulty } from "./types";
import type { SatQuestionType } from "./grading";

export type SatSkill = "READING_WRITING" | "MATH";

/** Per-module time limit (digital SAT): R&W 32 min, Math 35 min. */
export function moduleDurationSec(skill: SatSkill): number {
  return skill === "MATH" ? 35 * 60 : 32 * 60;
}

// Loose shape of a Prisma question row (enough to sanitize).
type DbQuestion = {
  id: string;
  order: number;
  type: string;
  groupTitle: string | null;
  stimulus: string | null;
  imageUrl: string | null;
  prompt: string | null;
  options: unknown;
  meta: unknown;
};

// Loose shape of a Prisma section row with its questions.
type DbSection = {
  id: string;
  order: number;
  module: number;
  difficulty: ModuleDifficulty;
  title: string | null;
  instructions: string | null;
  passageText: string | null;
  formulaSheet: boolean;
  questions: DbQuestion[];
};

/** Strip a DB question down to what the client may see (no correctAnswers). */
export function sanitizeQuestion(q: DbQuestion): ClientQuestion {
  return {
    id: q.id,
    order: q.order,
    type: q.type as SatQuestionType,
    groupTitle: q.groupTitle ?? null,
    stimulus: q.stimulus ?? null,
    imageUrl: q.imageUrl ?? null,
    prompt: q.prompt ?? null,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    meta: (q.meta as Record<string, unknown> | null) ?? null,
  };
}

/** Build the client payload for a single module from its section. */
export function buildClientModule(section: DbSection, skill: SatSkill): ClientModule {
  return {
    module: section.module,
    difficulty: section.difficulty,
    title: section.title,
    instructions: section.instructions,
    passageText: section.passageText ?? null,
    formulaSheet: section.formulaSheet,
    durationSec: moduleDurationSec(skill),
    questions: [...section.questions]
      .sort((a, b) => a.order - b.order)
      .map(sanitizeQuestion),
  };
}

/** The Module 1 (STANDARD) section, with a tolerant fallback for legacy data. */
export function findModule1<T extends { module: number; difficulty: string; order: number }>(
  sections: T[],
): T | undefined {
  return (
    sections.find((s) => s.module === 1 && s.difficulty === "STANDARD") ??
    sections.find((s) => s.module === 1) ??
    [...sections].sort((a, b) => a.order - b.order)[0]
  );
}

/** The Module 2 section for a given difficulty (EASY | HARD). */
export function findModule2<T extends { module: number; difficulty: string }>(
  sections: T[],
  difficulty: "EASY" | "HARD",
): T | undefined {
  return (
    sections.find((s) => s.module === 2 && s.difficulty === difficulty) ??
    // Fallback: any module-2 section, or the other variant if only one exists.
    sections.find((s) => s.module === 2)
  );
}

/** Whether a test has a real adaptive Module 2 (at least one module-2 section). */
export function hasModule2<T extends { module: number }>(sections: T[]): boolean {
  return sections.some((s) => s.module === 2);
}
