import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Import AI-generated + adversarially-verified questions as a new adaptive test pair
// (Reading & Writing + Math). Usage: tsx scripts/import-generated.ts <path-to-json>
// The JSON is the workflow output: { modules: [{ skill, module, difficulty, questions }] }.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type GenQ = {
  type: string;
  stimulus?: string;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
};
type GenModule = {
  skill: "READING_WRITING" | "MATH";
  module: number;
  difficulty: "STANDARD" | "EASY" | "HARD";
  questions: GenQ[];
};

const path = process.argv[2];
if (!path) throw new Error("Usage: tsx scripts/import-generated.ts <json>");
const data = JSON.parse(readFileSync(path, "utf8")) as { modules: GenModule[] };

const pick = (skill: string, module: number, diff: string): GenQ[] =>
  data.modules.find((m) => m.skill === skill && m.module === module && m.difficulty === diff)?.questions ?? [];

function qCreate(items: GenQ[], isMath: boolean) {
  return {
    create: items.map((q, i) => ({
      order: i + 1,
      type: q.type as never,
      stimulus: isMath ? null : q.stimulus || null,
      prompt: q.prompt,
      options: q.options && q.options.length ? q.options : undefined,
      correctAnswers: q.correctAnswers,
      explanation: q.explanation || null,
      difficulty: (q.difficulty as never) ?? null,
    })),
  };
}

async function nextSlug(base: string): Promise<{ slug: string; n: number }> {
  const rows = await prisma.test.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  let n = 2;
  while (rows.some((r) => r.slug === `${base}${n}`)) n++;
  return { slug: `${base}${n}`, n };
}

async function main() {
  const rw = await nextSlug("sat-rw-practice-");
  const math = await nextSlug("sat-math-practice-");

  const rwCounts = [pick("READING_WRITING", 1, "STANDARD"), pick("READING_WRITING", 2, "EASY"), pick("READING_WRITING", 2, "HARD")];
  const mathCounts = [pick("MATH", 1, "STANDARD"), pick("MATH", 2, "EASY"), pick("MATH", 2, "HARD")];

  await prisma.test.create({
    data: {
      title: `Digital SAT — Reading & Writing Practice ${rw.n}`,
      slug: rw.slug,
      skill: "READING_WRITING",
      type: "DIGITAL",
      description: "Adaptive Reading & Writing: Module 1, then an easier or harder Module 2 based on your performance.",
      durationSec: 64 * 60,
      published: true,
      sections: {
        create: [
          { order: 1, module: 1, difficulty: "STANDARD", title: "Module 1", instructions: "Answer all questions. You have 32 minutes.", questions: qCreate(rwCounts[0], false) },
          { order: 2, module: 2, difficulty: "EASY", title: "Module 2 (Standard)", instructions: "You have 32 minutes.", questions: qCreate(rwCounts[1], false) },
          { order: 3, module: 2, difficulty: "HARD", title: "Module 2 (Harder)", instructions: "You have 32 minutes.", questions: qCreate(rwCounts[2], false) },
        ],
      },
    },
  });

  await prisma.test.create({
    data: {
      title: `Digital SAT — Math Practice ${math.n}`,
      slug: math.slug,
      skill: "MATH",
      type: "DIGITAL",
      description: "Adaptive Math: Module 1, then an easier or harder Module 2 based on your performance. Calculator allowed.",
      durationSec: 70 * 60,
      published: true,
      sections: {
        create: [
          { order: 1, module: 1, difficulty: "STANDARD", title: "Module 1", instructions: "You may use a calculator. You have 35 minutes.", formulaSheet: true, questions: qCreate(mathCounts[0], true) },
          { order: 2, module: 2, difficulty: "EASY", title: "Module 2 (Standard)", instructions: "Calculator allowed. You have 35 minutes.", formulaSheet: true, questions: qCreate(mathCounts[1], true) },
          { order: 3, module: 2, difficulty: "HARD", title: "Module 2 (Harder)", instructions: "Calculator allowed. You have 35 minutes.", formulaSheet: true, questions: qCreate(mathCounts[2], true) },
        ],
      },
    },
  });

  console.log(`✅ Imported: ${rw.slug} (RW ${rwCounts.map((c) => c.length).join("/")}) + ${math.slug} (Math ${mathCounts.map((c) => c.length).join("/")})`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
