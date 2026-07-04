// Auto-grading engine for SAT Reading & Writing + Math.
// Each question stores `correctAnswers` as an array of acceptable values.
// The user `response` is compared after normalization.

export type SatQuestionType =
  | "MCQ_SINGLE"
  | "STUDENT_PRODUCED_RESPONSE"
  | "PARAGRAPH_REFERENCE"
  | "CROSS_TEXT_CONNECTIONS"
  | "TEXTUAL_EVIDENCE"
  | "INFERENCE"
  | "CENTRAL_IDEAS"
  | "WORDS_IN_CONTEXT"
  | "TEXT_STRUCTURE"
  | "RHETORICAL_SYNTHESIS"
  | "TRANSITIONS"
  | "BOUNDARIES"
  | "FORM_STRUCTURE"
  | "DATA_ANALYSIS"
  | "ALGEBRA"
  | "ADVANCED_MATH"
  | "PROBLEM_SOLVING"
  | "GEOMETRY";

/** Derive the stored answer value from a display option.
 *  "A) lorem ipsum" -> "A"  ·  "B. 42" -> "B" */
export function optionValue(opt: string): string {
  const m = opt.match(/^\s*([A-Za-z]{1,4}|\d{1,2})[).]\s*/);
  return m ? m[1] : opt.trim();
}

/** Normalize a free-text answer for comparison (case, spacing, punctuation). */
export function normalize(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?'"`]+$/g, "")
    .replace(/^[.,;:!?'"`]+/g, "");
}

/** Normalize a math answer — handles fractions, decimals, mixed numbers. */
export function normalizeMath(value: unknown): string {
  if (value == null) return "";
  const s = String(value).toLowerCase().trim().replace(/\s+/g, "");
  // Remove trailing zeroes after decimal: "12.50" -> "12.5"
  if (s.includes(".")) {
    const parts = s.split(".");
    parts[1] = parts[1].replace(/0+$/, "");
    if (parts[1] === "") return parts[0];
    return parts.join(".");
  }
  return s;
}

/**
 * Parse a numeric grid-in answer to a number, accepting integers, decimals
 * (incl. leading ".5"), fractions ("3/2", "-1/4"), and a trailing %.
 * Returns null for non-numeric / symbolic answers (e.g. "16π").
 */
export function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\s+/g, "").replace(/%$/, "");
  if (!s) return null;
  const frac = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return null;
    return num / den;
  }
  if (/^-?\d*\.?\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Count significant figures in a numeric string, e.g. "0.333"→3, ".6667"→4, "0.3"→1. */
function sigFigs(s: string): number {
  const digits = s.replace(/^[-+]/, "").replace(".", "").replace(/^0+/, "");
  return digits === "" ? 1 : digits.length;
}

/**
 * Official Digital SAT grid-in rule: a student-produced numeric answer is correct
 * when it equals the exact value, OR — for a non-terminating value like 1/3 — when
 * the student truncated OR rounded it to as many digits as fit the grid.
 * So 1/3 accepts "1/3", ".333", ".3333", ".334"…, but not the imprecise "0.3".
 * The old code required an exact match (|c-r| < 1e-6), which marked ".333" WRONG.
 */
function gridInMatch(correct: number, respStr: string, respNum: number): boolean {
  // Exact value: fractions, integers, and terminating decimals (0.5 == 1/2 == 2/4).
  if (Math.abs(correct - respNum) < 1e-9) return true;
  // Otherwise accept a decimal that truncates/rounds the true value at the
  // precision the student entered, provided they gave at least 3 significant figures.
  const dot = respStr.indexOf(".");
  if (dot === -1) return false;
  const decimals = respStr.length - dot - 1;
  if (decimals < 1 || sigFigs(respStr) < 3) return false;
  const factor = 10 ** decimals;
  const truncated = Math.trunc(correct * factor) / factor;
  const rounded = Math.round(correct * factor) / factor;
  return Math.abs(respNum - truncated) < 1e-9 || Math.abs(respNum - rounded) < 1e-9;
}

/**
 * Grade a single question. Returns true if the response is correct.
 */
export function gradeAnswer(
  type: SatQuestionType,
  correctAnswers: unknown[],
  response: unknown,
): boolean {
  if (response == null || response === "") return false;
  const correct = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];

  // Math student-produced response: accept equivalent forms.
  if (type === "STUDENT_PRODUCED_RESPONSE") {
    // Numeric equivalence first (0.5 == 1/2 == 2/4), plus the official truncate/round
    // rule for non-terminating answers (1/3 accepts ".333"/".3333"/".334").
    const rNum = parseNumeric(response);
    const rStr = String(response).trim().replace(/\s+/g, "").replace(/%$/, "");
    if (rNum != null) {
      for (const c of correct) {
        const cNum = parseNumeric(c);
        if (cNum != null && gridInMatch(cNum, rStr, rNum)) return true;
      }
    }
    // Fall back to normalized-string match (covers symbolic answers like "16π").
    const norm = normalizeMath(response);
    return correct.some((c) => normalizeMath(c) === norm);
  }

  // All other SAT types are single-choice (MCQ variants)
  const norm = normalize(response);
  return correct.some((c) => normalize(c) === norm);
}

/** Grade a whole attempt. */
export function gradeAttempt(
  items: { type: SatQuestionType; correctAnswers: unknown[]; response: unknown }[],
): { rawScore: number; total: number; results: boolean[] } {
  const results = items.map((q) =>
    gradeAnswer(q.type, q.correctAnswers, q.response),
  );
  const rawScore = results.filter(Boolean).length;
  return { rawScore, total: items.length, results };
}
