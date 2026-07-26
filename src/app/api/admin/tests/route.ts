import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { parseJson } from "@/lib/validation";
import {
  SAT_SKILLS,
  TEST_TYPES,
  SAT_QUESTION_TYPES,
} from "@/lib/testEnums";
import { TEST_LEVELS } from "@/lib/level";
import type { Prisma } from "@/generated/prisma/client";

// The shape of a question in the create payload. `options` is required for MCQ_SINGLE
// (a choice question with no choices is corrupt data the exam runner cannot render) and
// forbidden for STUDENT_PRODUCED_RESPONSE (a grid-in has no options). `correctAnswers` is
// a non-empty array of strings — `[null]` or `[123]` no longer slip through.
const questionSchema = z.object({
  order: z.number().int().positive(),
  type: z.enum(SAT_QUESTION_TYPES),
  groupTitle: z.string().optional(),
  stimulus: z.string().optional(),
  imageUrl: z.string().optional(),
  prompt: z.string().optional(),
  explanation: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswers: z.array(z.string().min(1)).min(1),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// Refine: enforce the options rule per question type. Doing this in `superRefine` (rather
// than a discriminated union on `type`) keeps the schema readable and keeps the create
// payload a single flat shape, which the Prisma write below expects.
const sectionSchema = z.object({
  order: z.number().int().positive(),
  module: z.union([z.literal(1), z.literal(2)]),
  difficulty: z.enum(["STANDARD", "EASY", "HARD"]),
  title: z.string().optional(),
  instructions: z.string().optional(),
  passageText: z.string().optional(),
  imageUrl: z.string().optional(),
  formulaSheet: z.boolean().optional(),
  questions: z.array(questionSchema).min(1),
});

const bodySchema = z
  .object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    skill: z.enum(SAT_SKILLS),
    type: z.enum(TEST_TYPES).optional(),
    description: z.string().optional(),
    durationSec: z.number().int().positive().optional(),
    published: z.boolean().optional(),
    isPremium: z.boolean().optional(),
    level: z.enum(TEST_LEVELS).optional(),
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.sections.forEach((s, si) => {
      s.questions.forEach((q, qi) => {
        if (q.type === "MCQ_SINGLE") {
          if (!q.options || q.options.length < 2) {
            ctx.addIssue({
              code: "custom",
              message: `sections[${si}].questions[${qi}]: MCQ_SINGLE requires at least 2 options`,
              path: ["sections", si, "questions", qi, "options"],
            });
          }
        }
        if (q.type === "STUDENT_PRODUCED_RESPONSE" && q.options) {
          ctx.addIssue({
            code: "custom",
            message: `sections[${si}].questions[${qi}]: STUDENT_PRODUCED_RESPONSE must not have options`,
            path: ["sections", si, "questions", qi, "options"],
          });
        }
      });
    });
  });

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const b = await parseJson(req, bodySchema);

  const existing = await prisma.test.findUnique({ where: { slug: b.slug } });
  if (existing) return jsonError("A test with this slug already exists", 409);

  const test = await prisma.test.create({
    data: {
      title: b.title,
      slug: b.slug,
      skill: b.skill,
      type: b.type ?? "DIGITAL",
      description: b.description ?? null,
      durationSec: b.durationSec ?? 3900,
      published: b.published ?? false,
      isPremium: b.isPremium ?? true,
      level: b.level ?? "MEDIUM",
      sections: {
        create: b.sections.map((s) => ({
          order: s.order,
          module: s.module,
          difficulty: s.difficulty,
          title: s.title ?? null,
          instructions: s.instructions ?? null,
          passageText: s.passageText ?? null,
          imageUrl: s.imageUrl ?? null,
          formulaSheet: s.formulaSheet ?? false,
          questions: {
            create: s.questions.map((q) => ({
              order: q.order,
              type: q.type,
              groupTitle: q.groupTitle ?? null,
              stimulus: q.stimulus ?? null,
              imageUrl: q.imageUrl ?? null,
              prompt: q.prompt ?? null,
              explanation: q.explanation ?? null,
              options: q.options,
              correctAnswers: q.correctAnswers as Prisma.InputJsonValue,
              meta: q.meta as Prisma.InputJsonValue | undefined,
            })),
          },
        })) as unknown as Prisma.SectionCreateWithoutTestInput[],
      },
    },
  });

  return Response.json({ id: test.id, title: test.title, slug: test.slug }, { status: 201 });
});
