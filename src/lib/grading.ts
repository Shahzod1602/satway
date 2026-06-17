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

/** A multi-select answer is correct iff the chosen set equals the correct set. */
function gradeMulti(response: unknown, correct: unknown[]): boolean {
  const chosen = Array.isArray(response) ? response : [];
  const a = [...new Set(chosen.map(normalize).filter(Boolean))].sort();
  const b = [...new Set(correct.map(normalize).filter(Boolean))].sort();
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
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
    // Numeric equivalence first (0.5 == 1/2 == 2/4), with a tiny tolerance.
    const rNum = parseNumeric(response);
    if (rNum != null) {
      for (const c of correct) {
        const cNum = parseNumeric(c);
        if (cNum != null && Math.abs(cNum - rNum) < 1e-6) return true;
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
