import type { SatQuestionType } from "./grading";

export type ClientQuestion = {
  id: string;
  order: number;
  type: SatQuestionType;
  groupTitle: string | null;
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
