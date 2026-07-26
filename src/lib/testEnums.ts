/**
 * Single source of truth for the test-related string enums.
 *
 * These mirror the Prisma enums in `prisma/schema.prisma` (SatSkill, TestType, TestLevel,
 * SectionDifficulty, SatQuestionType). Before this file existed, each one was re-derived
 * as an inline literal in the routes that validate them — `tests/route.ts`,
 * `tests/[id]/route.ts`, `generate-test/route.ts`, plus the type unions in `scoring.ts`,
 * `exam.ts`, `grading.ts`. Five hand-maintained copies of the same list drift the moment a
 * question type is added, so every consumer now imports from here.
 *
 * `TEST_LEVELS` is re-exported from `level.ts` rather than duplicated, because that file
 * owns the level metadata (labels, badges, suggestions) and we don't want two arrays.
 */

export const SAT_SKILLS = ["READING_WRITING", "MATH"] as const;
export type SatSkill = (typeof SAT_SKILLS)[number];

export const TEST_TYPES = ["DIGITAL", "PAPER"] as const;
export type TestType = (typeof TEST_TYPES)[number];

// TEST_LEVELS lives in level.ts (it owns the labels/badges too). Re-export so consumers
// have one import for every test enum.
export { TEST_LEVELS } from "./level";
import type { TestLevel } from "@/generated/prisma/enums";
export type { TestLevel };

export const SECTION_DIFFICULTIES = ["STANDARD", "EASY", "HARD"] as const;
export type SectionDifficulty = (typeof SECTION_DIFFICULTIES)[number];

/** All 18 SAT question types — MCQ_SINGLE + STUDENT_PRODUCED_RESPONSE (the two answer
 *  shapes) plus the 16 skill domains the grader/grouping cares about. */
export const SAT_QUESTION_TYPES = [
  "MCQ_SINGLE",
  "STUDENT_PRODUCED_RESPONSE",
  "PARAGRAPH_REFERENCE",
  "CROSS_TEXT_CONNECTIONS",
  "TEXTUAL_EVIDENCE",
  "INFERENCE",
  "CENTRAL_IDEAS",
  "WORDS_IN_CONTEXT",
  "TEXT_STRUCTURE",
  "RHETORICAL_SYNTHESIS",
  "TRANSITIONS",
  "BOUNDARIES",
  "FORM_STRUCTURE",
  "DATA_ANALYSIS",
  "ALGEBRA",
  "ADVANCED_MATH",
  "PROBLEM_SOLVING",
  "GEOMETRY",
] as const;

/** The two answer-bearing shapes — used to decide whether `options` is required. */
export const ANSWER_TYPES = ["MCQ_SINGLE", "STUDENT_PRODUCED_RESPONSE"] as const;
