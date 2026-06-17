import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import type { SatQuestionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const VALID_SKILLS = ["READING_WRITING", "MATH"] as const;
const VALID_QUESTION_TYPES = [
  "MCQ_SINGLE",
  "STUDENT_PRODUCED_RESPONSE",
  "PARAGRAPH_REFERENCE",
  "CROSS_TEXT_CONNECTIONS",
  "TEXTUAL_EVIDENCE",
  "INFERENCE",
  "CENTRAL_IDEAS",
  "WORDS_IN_CONTEXT",
  "TEXT_STRUCTURE",
  "RHETORICAL_SYNTHESIS",
  "TRANSITIONS",
  "BOUNDARIES",
  "FORM_STRUCTURE",
  "DATA_ANALYSIS",
  "ALGEBRA",
  "ADVANCED_MATH",
  "PROBLEM_SOLVING",
  "GEOMETRY",
] as const;

export async function POST(req: NextRequest) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: {
    title?: unknown;
    slug?: unknown;
    skill?: unknown;
    type?: unknown;
    description?: unknown;
    durationSec?: unknown;
    published?: unknown;
    sections?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, slug, skill, type, description, durationSec, published, sections } = body;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (typeof skill !== "string" || !VALID_SKILLS.includes(skill as typeof VALID_SKILLS[number])) {
    return NextResponse.json({ error: "skill must be READING_WRITING or MATH" }, { status: 400 });
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: "sections must be a non-empty array" }, { status: 400 });
  }

  const testType = typeof type === "string" && (type === "DIGITAL" || type === "PAPER") ? type : "DIGITAL";
  const dur = typeof durationSec === "number" && durationSec > 0 ? durationSec : 3900;

  const existing = await prisma.test.findUnique({ where: { slug: slug.trim() } });
  if (existing) {
    return NextResponse.json({ error: "A test with this slug already exists" }, { status: 409 });
  }

  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    if (typeof s.order !== "number" || s.order < 1) {
      return NextResponse.json({ error: `sections[${si}].order must be a positive number` }, { status: 400 });
    }
    if (!Array.isArray(s.questions) || s.questions.length === 0) {
      return NextResponse.json({ error: `sections[${si}].questions must be a non-empty array` }, { status: 400 });
    }
    for (let qi = 0; qi < s.questions.length; qi++) {
      const q = s.questions[qi];
      if (typeof q.order !== "number" || q.order < 1) {
        return NextResponse.json({ error: `sections[${si}].questions[${qi}].order must be a positive number` }, { status: 400 });
      }
      if (typeof q.type !== "string" || !VALID_QUESTION_TYPES.includes(q.type as typeof VALID_QUESTION_TYPES[number])) {
        return NextResponse.json(
          { error: `sections[${si}].questions[${qi}].type "${q.type}" is invalid` },
          { status: 400 },
        );
      }
      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
        return NextResponse.json(
          { error: `sections[${si}].questions[${qi}].correctAnswers must be a non-empty array` },
          { status: 400 },
        );
      }
    }
  }

  const test = await prisma.test.create({
    data: {
      title: title.trim(),
      slug: slug.trim(),
      skill: skill as "READING_WRITING" | "MATH",
      type: testType as "DIGITAL" | "PAPER",
      description: typeof description === "string" ? description : null,
      durationSec: dur,
      published: published === true,
      sections: {
        create: sections.map((s: Record<string, unknown>) => ({
          order: s.order as number,
          module: s.module === 2 ? 2 : 1,
          difficulty:
            s.difficulty === "EASY" || s.difficulty === "HARD" ? s.difficulty : "STANDARD",
          title: typeof s.title === "string" ? s.title : null,
          instructions: typeof s.instructions === "string" ? s.instructions : null,
          passageText: typeof s.passageText === "string" ? s.passageText : null,
          imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : null,
          formulaSheet: s.formulaSheet === true,
          questions: {
            create: (s.questions as Record<string, unknown>[]).map((q) => ({
              order: q.order as number,
              type: q.type as SatQuestionType,
              groupTitle: typeof q.groupTitle === "string" ? q.groupTitle : null,
              stimulus: typeof q.stimulus === "string" ? q.stimulus : null,
              imageUrl: typeof q.imageUrl === "string" ? q.imageUrl : null,
              prompt: typeof q.prompt === "string" ? q.prompt : null,
              explanation: typeof q.explanation === "string" ? q.explanation : null,
              options: Array.isArray(q.options) ? q.options : undefined,
              correctAnswers: q.correctAnswers as Prisma.InputJsonValue,
              meta: q.meta ? (q.meta as Prisma.InputJsonValue) : undefined,
            })),
          },
        })) as unknown as Prisma.SectionCreateWithoutTestInput[],
      },
    },
  });

  return NextResponse.json({ id: test.id, title: test.title, slug: test.slug }, { status: 201 });
}
