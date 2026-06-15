import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

/**
 * Generate test questions from a PDF or text passage using Gemini.
 * Returns a JSON array of question objects ready for admin/test-builder.
 */
export async function generateQuestionsFromPassage(
  passage: string,
  skill: string,
  count = 5,
): Promise<Record<string, unknown>[]> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-pro";

  const prompt = `
You are an SAT test author. Based on the following passage, create ${count} SAT-style questions.

For READING_WRITING: Create multiple-choice questions testing comprehension, vocabulary in context, text structure, inference, or rhetorical synthesis.
For MATH: Create multiple-choice or grid-in questions testing algebra, advanced math, or data analysis.

Passage:
${passage}

Return a JSON array of question objects with:
- type: one of MCQ_SINGLE, STUDENT_PRODUCED_RESPONSE (math only), PARAGRAPH_REFERENCE, WORDS_IN_CONTEXT, INFERENCE, CENTRAL_IDEAS, DATA_ANALYSIS, ALGEBRA, etc.
- prompt: the question text
- options: array of choices like ["A) ...", "B) ...", "C) ...", "D) ..."] (for MCQ)
- correctAnswers: array of correct values, e.g. ["B"] or ["12"]
- meta: optional object with extra config

Return ONLY valid JSON, no other text.
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 0.7, maxOutputTokens: 4096 },
  });

  const text = response.text;
  if (!text) throw new Error("Empty AI response");

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in AI response");

  return JSON.parse(jsonMatch[0]);
}
