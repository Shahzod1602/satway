/**
 * Bulk test generator — creates many adaptive SAT practice tests.
 *
 *   npx tsx prisma/generate-tests.ts            # default: 500 R&W + 500 Math
 *   RW_COUNT=100 MATH_COUNT=100 npx tsx prisma/generate-tests.ts
 *
 * Each test has the real Digital SAT shape: Module 1 (STANDARD) plus two
 * Module 2 variants (EASY and HARD) the engine routes between adaptively.
 *
 * Math questions are computed (genuinely correct answers, with worked
 * explanations). Reading & Writing questions are drawn from a template bank.
 * Content is synthetic — meant for volume/demo, not exam realism.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const RW_COUNT = parseInt(process.env.RW_COUNT || "500", 10);
const MATH_COUNT = parseInt(process.env.MATH_COUNT || "500", 10);
const RW_PER_MODULE = parseInt(process.env.RW_PER_MODULE || "27", 10);
const MATH_PER_MODULE = parseInt(process.env.MATH_PER_MODULE || "22", 10);

type Diff = "EASY" | "STANDARD" | "HARD";
type Row = {
  order: number;
  type: string;
  stimulus?: string | null;
  prompt: string;
  explanation?: string;
  options?: string[];
  correctAnswers: string[];
};

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const LETTERS = ["A", "B", "C", "D"];

function mcq(correct: string, distractors: string[]): { options: string[]; correctAnswers: string[] } {
  const uniq = Array.from(new Set(distractors.filter((d) => d !== correct)));
  const three = shuffle(uniq).slice(0, 3);
  let pad = 1;
  while (three.length < 3) {
    const c = `${correct} (alt ${pad++})`;
    if (!three.includes(c)) three.push(c);
  }
  const all = shuffle([correct, ...three]);
  const options = all.map((t, i) => `${LETTERS[i]}) ${t}`);
  const correctAnswers = [LETTERS[all.indexOf(correct)]];
  return { options, correctAnswers };
}

// ── Math generators (computed, with explanations) ────────────────────────────
function mathEasy(): Omit<Row, "order"> {
  const kind = rnd(1, 4);
  if (kind === 1) {
    const x = rnd(1, 20), b = rnd(1, 20), c = x + b;
    return { type: "ALGEBRA", prompt: `If x + ${b} = ${c}, what is the value of x?`, explanation: `Subtract ${b} from both sides: x = ${c} − ${b} = ${x}.`, ...mcq(`${x}`, [`${c}`, `${b}`, `${x + 1}`]) };
  }
  if (kind === 2) {
    const a = rnd(2, 9), x = rnd(2, 12), c = a * x;
    return { type: "ALGEBRA", prompt: `If ${a}x = ${c}, what is the value of x?`, explanation: `Divide both sides by ${a}: x = ${c} ÷ ${a} = ${x}.`, ...mcq(`${x}`, [`${c}`, `${x + 1}`, `${a}`]) };
  }
  if (kind === 3) {
    const p = pick([10, 20, 25, 50]), n = rnd(2, 20) * 10, ans = (p / 100) * n;
    return { type: "PROBLEM_SOLVING", prompt: `What is ${p}% of ${n}?`, explanation: `${p}% of ${n} = ${p}/100 × ${n} = ${ans}.`, ...mcq(`${ans}`, [`${ans * 2}`, `${ans + 10}`, `${n - ans}`]) };
  }
  const l = rnd(3, 12), w = rnd(2, 10), area = l * w;
  return { type: "GEOMETRY", prompt: `A rectangle has length ${l} and width ${w}. What is its area?`, explanation: `Area = length × width = ${l} × ${w} = ${area}.`, ...mcq(`${area}`, [`${2 * (l + w)}`, `${l + w}`, `${area + l}`]) };
}

function mathStandard(): Omit<Row, "order"> {
  const kind = rnd(1, 5);
  if (kind === 1) {
    const a = rnd(2, 6), x = rnd(2, 12), b = rnd(1, 15), c = a * x + b;
    return { type: "ALGEBRA", prompt: `If ${a}x + ${b} = ${c}, what is the value of x?`, explanation: `${a}x = ${c} − ${b} = ${a * x}, so x = ${a * x} ÷ ${a} = ${x}.`, ...mcq(`${x}`, [`${x + 1}`, `${x - 1}`, `${c}`]) };
  }
  if (kind === 2) {
    const x = rnd(2, 10), y = rnd(1, x - 1 > 0 ? x - 1 : 1), s = x + y, d = x - y;
    return { type: "ALGEBRA", prompt: `If x + y = ${s} and x − y = ${d}, what is the value of x?`, explanation: `Add the equations: 2x = ${s} + ${d} = ${s + d}, so x = ${x}.`, ...mcq(`${x}`, [`${y}`, `${s}`, `${d}`]) };
  }
  if (kind === 3) {
    const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]];
    const [a, b, c] = pick(triples);
    return { type: "GEOMETRY", prompt: `In a right triangle, one leg is ${a} and the hypotenuse is ${c}. What is the other leg?`, explanation: `By the Pythagorean theorem: other leg = √(${c}² − ${a}²) = √${c * c - a * a} = ${b}.`, ...mcq(`${b}`, [`${a}`, `${c}`, `${b + 1}`]) };
  }
  if (kind === 4) {
    const nums = Array.from({ length: 5 }, () => rnd(2, 20));
    const sum = nums.reduce((s, n) => s + n, 0);
    const mean = sum / nums.length;
    return { type: "DATA_ANALYSIS", prompt: `What is the mean of the data set {${nums.join(", ")}}?`, explanation: `Mean = sum ÷ count = ${sum} ÷ ${nums.length} = ${mean}.`, ...mcq(`${mean}`, [`${mean + 1}`, `${mean - 1}`, `${Math.max(...nums)}`]) };
  }
  const x1 = rnd(0, 4), y1 = rnd(0, 6), dx = rnd(1, 4), m = rnd(1, 4);
  const x2 = x1 + dx, y2 = y1 + m * dx;
  return { type: "ALGEBRA", prompt: `A line passes through (${x1}, ${y1}) and (${x2}, ${y2}). What is its slope?`, explanation: `Slope = (y₂ − y₁)/(x₂ − x₁) = (${y2} − ${y1})/(${x2} − ${x1}) = ${m}.`, ...mcq(`${m}`, [`${m + 1}`, `${m - 1}`, `${dx}`]) };
}

function mathHard(): Omit<Row, "order"> {
  const kind = rnd(1, 5);
  if (kind === 1) {
    const r1 = rnd(-6, 6) || 2, r2 = rnd(-6, 6) || -3, b = -(r1 + r2);
    return { type: "ADVANCED_MATH", prompt: `A quadratic x² + bx + c has roots at x = ${r1} and x = ${r2}. What is b?`, explanation: `For roots r₁, r₂: b = −(r₁ + r₂) = −(${r1} + ${r2}) = ${b}.`, ...mcq(`${b}`, [`${-b}`, `${r1 * r2}`, `${r1 + r2}`]) };
  }
  if (kind === 2) {
    const a = rnd(2, 5), b = rnd(0, a - 1), val = 2 ** a - 2 ** b;
    return { type: "ADVANCED_MATH", prompt: `If g(x) = 2ˣ, what is g(${a}) − g(${b})?`, explanation: `g(${a}) − g(${b}) = 2^${a} − 2^${b} = ${2 ** a} − ${2 ** b} = ${val}.`, ...mcq(`${val}`, [`${2 ** a + 2 ** b}`, `${2 ** a}`, `${val + 2}`]) };
  }
  if (kind === 3) {
    const mean = rnd(40, 60), sd = pick([2, 4, 5, 10]), z = rnd(1, 3), v = mean + z * sd;
    return { type: "DATA_ANALYSIS", prompt: `A data set has mean ${mean} and standard deviation ${sd}. What is the z-score of ${v}?`, explanation: `z = (value − mean)/sd = (${v} − ${mean})/${sd} = ${z}.`, ...mcq(`${z}`, [`${z + 1}`, `${z - 1}`, `${v - mean}`]) };
  }
  if (kind === 4) {
    const a = rnd(1, 3), b = rnd(1, 4), x = rnd(2, 4);
    const val = a * x * x - b * x + 1;
    return { type: "STUDENT_PRODUCED_RESPONSE", prompt: `If f(x) = ${a}x² − ${b}x + 1, what is f(${x})?`, explanation: `f(${x}) = ${a}·${x}² − ${b}·${x} + 1 = ${a * x * x} − ${b * x} + 1 = ${val}.`, correctAnswers: [`${val}`] };
  }
  const r = rnd(2, 9), area = r * r;
  return { type: "STUDENT_PRODUCED_RESPONSE", prompt: `The area of a circle is ${area}π. What is its radius?`, explanation: `Area = πr², so r² = ${area} and r = √${area} = ${r}.`, correctAnswers: [`${r}`] };
}

function mathRow(diff: Diff, order: number): Row {
  const gen = diff === "EASY" ? mathEasy : diff === "HARD" ? mathHard : mathStandard;
  return { order, ...gen() };
}

// ── Reading & Writing template bank ──────────────────────────────────────────
type RWItem = { type: string; stimulus: string; prompt: string; correct: string; distractors: string[]; explanation: string };

const RW_WORDS: RWItem[] = [
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>The scientist's findings were so ______ that they transformed the entire field.</p>", prompt: "Which choice completes the text with the most logical and precise word?", correct: "groundbreaking", distractors: ["trivial", "ordinary", "doubtful", "outdated"], explanation: "“Transformed the entire field” signals major impact, so “groundbreaking” fits; the others suggest little or negative impact." },
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>Despite the team's ______ efforts, the project was completed weeks ahead of schedule.</p>", prompt: "Which choice completes the text with the most logical word?", correct: "diligent", distractors: ["careless", "minimal", "reluctant", "sporadic"], explanation: "Finishing early implies hard, careful work — “diligent.” The others would not produce an early finish." },
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>The critic praised the novel's ______ prose, noting how every sentence felt carefully chosen.</p>", prompt: "Which choice completes the text with the most logical word?", correct: "deliberate", distractors: ["sloppy", "random", "hasty", "vague"], explanation: "“Carefully chosen” matches “deliberate”; the distractors imply the opposite of careful." },
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>Her argument was ______: it accounted for every objection the audience raised.</p>", prompt: "Which choice completes the text with the most logical word?", correct: "comprehensive", distractors: ["incomplete", "biased", "confusing", "brief"], explanation: "Addressing every objection means it was thorough — “comprehensive.”" },
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>The ancient manuscript was remarkably ______, surviving centuries with little damage.</p>", prompt: "Which choice completes the text with the most logical word?", correct: "durable", distractors: ["fragile", "fictional", "recent", "ornate"], explanation: "Surviving with little damage indicates durability." },
  { type: "WORDS_IN_CONTEXT", stimulus: "<p>Although celebrated now, the artist's style was initially ______ by traditional critics.</p>", prompt: "Which choice completes the text with the most logical word?", correct: "dismissed", distractors: ["embraced", "imitated", "funded", "praised"], explanation: "“Although celebrated now” sets up a contrast with the past, so the style was at first rejected — “dismissed.”" },
];

const RW_TRANS: RWItem[] = [
  { type: "TRANSITIONS", stimulus: "<p>The bridge was closed for repairs. ______, commuters had to find alternate routes.</p>", prompt: "Which transition best fits the blank?", correct: "Consequently", distractors: ["However", "Nevertheless", "In contrast", "For example"], explanation: "The second sentence is a result of the first, so a cause-effect transition (“Consequently”) fits." },
  { type: "TRANSITIONS", stimulus: "<p>The data supported the hypothesis. ______, a few results remained unexplained.</p>", prompt: "Which transition best fits the blank?", correct: "Nevertheless", distractors: ["Therefore", "As a result", "Likewise", "For instance"], explanation: "There is a contrast between support and unexplained results, so a concessive transition (“Nevertheless”) fits." },
  { type: "TRANSITIONS", stimulus: "<p>Sales rose sharply in spring. ______, profits reached a record high that quarter.</p>", prompt: "Which transition best fits the blank?", correct: "As a result", distractors: ["However", "In contrast", "Nonetheless", "Regardless"], explanation: "Record profits follow from rising sales — a result relationship." },
  { type: "TRANSITIONS", stimulus: "<p>Many cited rising costs. ______, others pointed to shifting consumer tastes.</p>", prompt: "Which transition best fits the blank?", correct: "However", distractors: ["Therefore", "Consequently", "Thus", "Hence"], explanation: "Two contrasting explanations are given, so a contrast transition (“However”) fits." },
  { type: "TRANSITIONS", stimulus: "<p>The recipe calls for fresh basil. ______, dried basil can be used in a pinch.</p>", prompt: "Which transition best fits the blank?", correct: "Alternatively", distractors: ["Therefore", "Consequently", "As a result", "Thus"], explanation: "An alternative option is offered, so “Alternatively” fits." },
];

const RW_IDEAS: RWItem[] = [
  { type: "CENTRAL_IDEAS", stimulus: "<p>Honeybees perform a 'waggle dance' to tell hivemates the direction and distance of food. The angle of the dance indicates direction relative to the sun, and its duration signals distance.</p>", prompt: "Which choice best states the main idea of the text?", correct: "Honeybees use a dance to communicate the location of food.", distractors: ["Honeybees cannot locate food without help.", "The sun moves to guide honeybees.", "Honeybees dance only for entertainment.", "Distance is unimportant to honeybees."], explanation: "The text explains how the dance encodes direction and distance to food — i.e., it communicates location." },
  { type: "INFERENCE", stimulus: "<p>After the city added protected bike lanes, the number of cycling commuters tripled within a year, and reported collisions involving cyclists fell.</p>", prompt: "Which choice most logically completes the text's conclusion?", correct: "Safer infrastructure can encourage more people to cycle.", distractors: ["Cycling is inherently dangerous.", "Bike lanes reduced the number of cars to zero.", "Commuters dislike cycling.", "Collisions are unrelated to infrastructure."], explanation: "More cyclists plus fewer collisions after adding lanes supports that safer infrastructure encourages cycling." },
  { type: "CENTRAL_IDEAS", stimulus: "<p>Mangrove forests buffer coastlines from storms, store large amounts of carbon, and shelter young fish. Yet they are cleared faster than almost any other forest type.</p>", prompt: "Which choice best states the main idea of the text?", correct: "Mangroves are highly valuable yet rapidly disappearing.", distractors: ["Mangroves are useless to wildlife.", "Storms strengthen mangrove forests.", "Fish destroy mangrove forests.", "Mangroves store no carbon."], explanation: "The text lists major benefits, then contrasts with rapid clearing — value vs. loss." },
  { type: "INFERENCE", stimulus: "<p>Participants who took brief walking breaks during study sessions recalled more material than those who studied continuously for the same total time.</p>", prompt: "Which choice most logically completes the text?", correct: "Short breaks may improve how well information is retained.", distractors: ["Walking prevents all learning.", "Longer study time always helps.", "Breaks erase memory.", "Continuous study is most effective."], explanation: "The break group recalled more for the same time, suggesting breaks aid retention." },
];

const RW_BOUND: RWItem[] = [
  { type: "BOUNDARIES", stimulus: "<p>The results were unexpected ______ they overturned a long-held theory.</p>", prompt: "Which choice conforms to the conventions of Standard English?", correct: "because", distractors: ["; because", ": as", ", and because"], explanation: "A subordinating conjunction (“because”) joins the dependent clause without extra punctuation." },
  { type: "BOUNDARIES", stimulus: "<p>She studied marine biology ______ she now researches coral reefs.</p>", prompt: "Which choice conforms to the conventions of Standard English?", correct: "; ", distractors: [", ", " ", ": "], explanation: "Two independent clauses need a semicolon (or a comma + conjunction); a comma alone is a splice." },
  { type: "BOUNDARIES", stimulus: "<p>My cousin, who lives abroad ______ visits every winter.</p>", prompt: "Which choice conforms to the conventions of Standard English?", correct: ", ", distractors: ["; ", ": ", " — and"], explanation: "The nonessential clause “who lives abroad” needs a closing comma to match the opening one." },
];

const RW_POOLS: RWItem[][] = [RW_WORDS, RW_TRANS, RW_IDEAS, RW_BOUND];

function rwRow(diff: Diff, order: number): Row {
  const pool =
    diff === "EASY" ? pick([RW_WORDS, RW_TRANS])
    : diff === "HARD" ? pick([RW_IDEAS, RW_BOUND, RW_WORDS])
    : pick(RW_POOLS);
  const item = pick(pool);
  const { options, correctAnswers } = mcq(item.correct, item.distractors);
  return { order, type: item.type, stimulus: item.stimulus, prompt: item.prompt, explanation: item.explanation, options, correctAnswers };
}

function buildModule(skill: "RW" | "MATH", diff: Diff, count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) rows.push(skill === "RW" ? rwRow(diff, i + 1) : mathRow(diff, i + 1));
  return rows;
}

async function createTest(skill: "RW" | "MATH", n: number) {
  const isRW = skill === "RW";
  const per = isRW ? RW_PER_MODULE : MATH_PER_MODULE;
  const slug = isRW ? `rw-test-${n}` : `math-test-${n}`;
  const title = isRW ? `SAT Reading & Writing — Test ${n}` : `SAT Math — Test ${n}`;

  const test = await prisma.test.create({
    data: {
      title, slug,
      skill: isRW ? "READING_WRITING" : "MATH",
      type: "DIGITAL",
      description: isRW
        ? "Adaptive Reading & Writing practice test (Module 1 → adaptive Module 2)."
        : "Adaptive Math practice test (Module 1 → adaptive Module 2). Calculator allowed.",
      durationSec: isRW ? 64 * 60 : 70 * 60,
      published: true,
      sections: {
        create: [
          { order: 1, module: 1, difficulty: "STANDARD", title: "Module 1", instructions: isRW ? "You have 32 minutes." : "Calculator allowed. You have 35 minutes.", formulaSheet: !isRW },
          { order: 2, module: 2, difficulty: "EASY", title: "Module 2 (Standard)", instructions: isRW ? "You have 32 minutes." : "Calculator allowed. You have 35 minutes.", formulaSheet: !isRW },
          { order: 3, module: 2, difficulty: "HARD", title: "Module 2 (Harder)", instructions: isRW ? "You have 32 minutes." : "Calculator allowed. You have 35 minutes.", formulaSheet: !isRW },
        ],
      },
    },
    include: { sections: true },
  });

  const byKey = (m: number, d: string) => test.sections.find((s) => s.module === m && s.difficulty === d)!;
  const m1 = byKey(1, "STANDARD"), m2e = byKey(2, "EASY"), m2h = byKey(2, "HARD");

  const rowsFor = (sectionId: string, rows: Row[]): Prisma.QuestionCreateManyInput[] =>
    rows.map((r) => ({
      sectionId,
      order: r.order,
      type: r.type as never,
      stimulus: r.stimulus ?? null,
      prompt: r.prompt,
      explanation: r.explanation ?? null,
      options: (r.options ?? undefined) as Prisma.InputJsonValue | undefined,
      correctAnswers: r.correctAnswers as Prisma.InputJsonValue,
    }));

  await prisma.question.createMany({
    data: [
      ...rowsFor(m1.id, buildModule(skill, "STANDARD", per)),
      ...rowsFor(m2e.id, buildModule(skill, "EASY", per)),
      ...rowsFor(m2h.id, buildModule(skill, "HARD", per)),
    ],
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) {
    console.log("⏭  Refusing to bulk-generate in production (set SEED_FORCE=1).");
    return;
  }

  console.log(`🏭 Generating ${RW_COUNT} R&W + ${MATH_COUNT} Math tests…`);

  const del = await prisma.test.deleteMany({
    where: { OR: [{ slug: { startsWith: "rw-test-" } }, { slug: { startsWith: "math-test-" } }] },
  });
  if (del.count) console.log(`   cleared ${del.count} previously generated tests`);

  let made = 0;
  for (let n = 1; n <= RW_COUNT; n++) {
    await createTest("RW", n);
    if (++made % 50 === 0) console.log(`   R&W ${made}/${RW_COUNT}`);
  }
  made = 0;
  for (let n = 1; n <= MATH_COUNT; n++) {
    await createTest("MATH", n);
    if (++made % 50 === 0) console.log(`   Math ${made}/${MATH_COUNT}`);
  }

  const total = await prisma.test.count();
  console.log(`✅ Done. Tests in database: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
