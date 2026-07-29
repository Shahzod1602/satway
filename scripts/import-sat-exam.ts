/**
 * Import a parsed SAT Math exam (2 modules) into the database as a Premium test.
 *
 * Input: a JSON file produced by OCR of a PDF, shaped as:
 *   {
 *     "title": "September 13th, 2025 US 1",
 *     "module1": [ { order, type, prompt, options?, correctAnswers, stimulus? }... ],
 *     "module2": [ { ... }... ]
 *   }
 *
 * Creates one Test (skill=MATH, type=DIGITAL, level=MEDIUM, published=true, isPremium=true)
 * with two Sections: module 1 (STANDARD) and module 2 (HARD). Questions are nested.
 *
 * Usage:
 *   npx tsx scripts/import-sat-exam.ts <path-to-json> [more-json...]
 *   npx tsx scripts/import-sat-exam.ts /tmp/exams/*.json
 *
 * Idempotent by slug: re-running with the same title updates the existing test in place
 * (sections + questions replaced atomically) rather than creating duplicates.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs"; // keep the seed-style import parity (unused)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface ParsedQuestion {
  order: number;
  type: string; // "MCQ_SINGLE" | "STUDENT_PRODUCED_RESPONSE"
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  stimulus?: string | null;
}

interface ParsedExam {
  title: string;
  module1: ParsedQuestion[];
  module2: ParsedQuestion[];
}

const VALID_QTYPES = new Set([
  "MCQ_SINGLE",
  "STUDENT_PRODUCED_RESPONSE",
]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeQ(q: ParsedQuestion, fallbackOrder: number): ParsedQuestion {
  const order = Number.isFinite(q.order) && q.order > 0 ? q.order : fallbackOrder;
  const type = VALID_QTYPES.has(q.type) ? q.type : "MCQ_SINGLE";
  // MCQ must have options; grid-in must not. Trim and filter empties.
  let options: string[] | undefined = Array.isArray(q.options)
    ? q.options.map((o) => String(o)).filter((o) => o.length > 0)
    : undefined;
  if (type === "STUDENT_PRODUCED_RESPONSE") options = undefined;
  if (type === "MCQ_SINGLE" && (!options || options.length < 2)) {
    throw new Error(`Q${order}: MCQ_SINGLE requires >=2 options`);
  }
  const correctAnswers = Array.isArray(q.correctAnswers)
    ? q.correctAnswers.map((a) => String(a).trim()).filter((a) => a.length > 0)
    : [];
  if (correctAnswers.length === 0) throw new Error(`Q${order}: correctAnswers empty`);
  return {
    order,
    type,
    prompt: String(q.prompt ?? "").trim(),
    options,
    correctAnswers,
    stimulus: q.stimulus ? String(q.stimulus).trim() : null,
  };
}

async function importExam(parsed: ParsedExam) {
  const title = parsed.title.trim();
  const slug = slugify(title);
  if (!parsed.module1.length || !parsed.module2.length) {
    throw new Error(`"${title}": both modules must be non-empty`);
  }

  const m1 = parsed.module1.map((q, i) => normalizeQ(q, i + 1));
  const m2 = parsed.module2.map((q, i) => normalizeQ(q, i + 1));

  // Sort by order to keep the exam order stable regardless of OCR drift.
  m1.sort((a, b) => a.order - b.order);
  m2.sort((a, b) => a.order - b.order);

  const existing = await prisma.test.findUnique({ where: { slug } });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      // Replace sections+questions atomically (cascade delete handles questions).
      await tx.section.deleteMany({ where: { testId: existing.id } });
      await tx.test.update({
        where: { id: existing.id },
        data: { title, sections: { create: buildSections(m1, m2) } },
      });
    } else {
      await tx.test.create({
        data: {
          title,
          slug,
          skill: "MATH",
          type: "DIGITAL",
          description: "Real Digital SAT Math exam (2 modules, adaptive).",
          durationSec: 35 * 60 * 2, // Math: 35 min per module
          published: true,
          isPremium: true,
          level: "MEDIUM",
          sections: { create: buildSections(m1, m2) },
        },
      });
    }
  });

  console.log(
    `✓ ${title} — ${existing ? "updated" : "created"} · M1: ${m1.length} Q · M2: ${m2.length} Q · slug=${slug}`,
  );
}

function buildSections(m1: ParsedQuestion[], m2: ParsedQuestion[]) {
  return [
    {
      order: 1,
      module: 1,
      difficulty: "STANDARD",
      title: "Module 1",
      questions: { create: m1.map((q) => toQuestionCreate(q)) },
    },
    {
      order: 2,
      module: 2,
      difficulty: "HARD",
      title: "Module 2",
      questions: { create: m2.map((q) => toQuestionCreate(q)) },
    },
  ];
}

function toQuestionCreate(q: ParsedQuestion) {
  return {
    order: q.order,
    type: q.type as never,
    prompt: q.prompt,
    stimulus: q.stimulus,
    options: q.options,
    correctAnswers: q.correctAnswers,
  };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: npx tsx scripts/import-sat-exam.ts <json...>");
    process.exit(1);
  }
  let ok = 0;
  let fail = 0;
  for (const f of files) {
    try {
      const parsed = JSON.parse(await readFile(f)) as ParsedExam;
      await importExam(parsed);
      ok++;
    } catch (e) {
      console.error(`✗ ${f}: ${(e as Error).message}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} imported, ${fail} failed.`);
}

import { readFile as rf } from "fs/promises";
async function readFile(p: string): Promise<string> {
  return rf(p, "utf8");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Silence the unused import lint (parity with seed.ts).
void bcrypt;
