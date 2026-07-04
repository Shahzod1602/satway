import type { SatQuestionType } from "./grading";

// Group the fine-grained SAT question types into the topics shown to students
// (weakness analytics, mistake bank, targeted practice).
export const TOPIC: Record<string, string> = {
  ALGEBRA: "Algebra",
  ADVANCED_MATH: "Advanced Math",
  PROBLEM_SOLVING: "Problem Solving & Data",
  DATA_ANALYSIS: "Problem Solving & Data",
  GEOMETRY: "Geometry & Trig",
  STUDENT_PRODUCED_RESPONSE: "Math grid-ins",
  WORDS_IN_CONTEXT: "Words in Context",
  TRANSITIONS: "Transitions",
  BOUNDARIES: "Grammar & Boundaries",
  RHETORICAL_SYNTHESIS: "Rhetorical Synthesis",
  CENTRAL_IDEAS: "Central Ideas",
  INFERENCE: "Inference",
  TEXTUAL_EVIDENCE: "Command of Evidence",
  CROSS_TEXT_CONNECTIONS: "Command of Evidence",
  PARAGRAPH_REFERENCE: "Reading Comprehension",
  TEXT_STRUCTURE: "Text Structure",
  FORM_STRUCTURE: "Text Structure",
  MCQ_SINGLE: "General",
};

/** The student-facing topic for a question type. */
export function topicOf(type: SatQuestionType | string): string {
  return TOPIC[type] ?? "Other";
}
