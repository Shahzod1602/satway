import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminGuard";
import { generateQuestionsFromPassage } from "@/lib/vertexai";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({
  passage: z.string().trim().min(1, "passage is required").max(20000),
  skill: z.enum(["READING_WRITING", "MATH"]),
  count: z.number().int().min(1).max(20).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const { passage, skill, count } = await parseJson(req, bodySchema);

  try {
    const questions = await generateQuestionsFromPassage(passage, skill, count ?? 5);
    return Response.json({ questions });
  } catch (e) {
    // Surface a clean message; log details server-side.
    console.error("[generate-test] AI error:", e);
    return jsonError("Failed to generate questions. Check AI configuration and try again.", 502);
  }
});
