import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminGuard";
import { currentUser } from "@/lib/session";
import { generateQuestionsFromPassage } from "@/lib/vertexai";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { SAT_SKILLS } from "@/lib/testEnums";

const bodySchema = z.object({
  passage: z.string().trim().min(1, "passage is required").max(20000),
  skill: z.enum(SAT_SKILLS),
  count: z.number().int().min(1).max(20).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const admin = await currentUser();
  const { passage, skill, count } = await parseJson(req, bodySchema);

  try {
    // origin: ADMIN keeps this out of every per-user cost figure — a question bank is
    // generated once, it is not what the next student who signs up costs us.
    const questions = await generateQuestionsFromPassage(passage, skill, count ?? 5, {
      userId: admin?.id ?? null,
      origin: "ADMIN",
    });
    return Response.json({ questions });
  } catch (e) {
    // Surface a clean message; log details server-side.
    console.error("[generate-test] AI error:", e);
    return jsonError("Failed to generate questions. Check AI configuration and try again.", 502);
  }
});
