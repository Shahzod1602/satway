import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({ level: z.enum(["EASY", "MEDIUM", "HARD"]) });

// POST { level } — the student picks their own practice level. The dashboard seeds the
// picker with a suggestion (from past scores / target), but the choice is theirs and it
// only ever changes which tests are highlighted — never what they can access.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Sign in to continue", 401);

  const { level } = await parseJson(req, bodySchema);
  await prisma.user.update({ where: { id: user.id }, data: { level } });

  return Response.json({ ok: true, level });
});
