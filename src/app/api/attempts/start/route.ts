import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { canAccessTest, effectivePlan } from "@/lib/access";
import { buildClientModule, findModule1, findModule2 } from "@/lib/exam";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import type { SatSkill } from "@/lib/exam";

const bodySchema = z.object({
  testId: z.string().min(1).max(40),
  mode: z.enum(["full", "module"]).default("full"),
  module: z.number().int().min(1).max(2).optional(),
});

// Begin an attempt. Creates an IN_PROGRESS record and returns ONLY the first
// module's questions (Module 1 for a full test, or the practiced module).
// Module 2 is never sent here — it is served adaptively after Module 1.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const { testId, mode, module } = await parseJson(req, bodySchema);

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { sections: { include: { questions: true } } },
  });
  if (!test || !test.published) return jsonError("Test not available", 404);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (!canAccessTest(effectivePlan(dbUser?.plan, dbUser?.premiumUntil), test.slug)) {
    return jsonError("This test requires Premium.", 403);
  }

  const skill = test.skill as SatSkill;

  // Choose which section to serve first.
  let section;
  let practiceModule: number | undefined;
  if (mode === "module" && module) {
    practiceModule = module;
    section =
      module === 1
        ? findModule1(test.sections)
        : findModule2(test.sections, "HARD") ?? findModule2(test.sections, "EASY");
  } else {
    section = findModule1(test.sections);
  }
  if (!section || section.questions.length === 0) {
    return jsonError("This test has no questions yet.", 400);
  }

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: user.id,
      testId: test.id,
      status: "IN_PROGRESS",
      module: mode === "module" ? practiceModule : null,
      // Record which Module 2 variant a practice run is using.
      module2Difficulty:
        mode === "module" && practiceModule === 2 && section.difficulty !== "STANDARD"
          ? section.difficulty
          : null,
    },
  });

  return Response.json({
    attemptId: attempt.id,
    mode,
    practiceModule,
    firstModule: buildClientModule(section, skill),
  });
});
