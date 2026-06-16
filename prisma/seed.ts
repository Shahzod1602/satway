import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Demo credentials are only seeded outside production. Override via env.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin!Satway2026";
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || "Student!Satway2026";

// ── Small builders ──────────────────────────────────────────────────────────
type Q = {
  type: string;
  stimulus?: string;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
};

function rwQuestions(items: Q[]) {
  return {
    create: items.map((q, i) => ({
      order: i + 1,
      type: q.type as never,
      stimulus: q.stimulus ?? null,
      prompt: q.prompt,
      options: q.options ?? undefined,
      correctAnswers: q.correctAnswers,
    })),
  };
}

function mathQuestions(items: Q[]) {
  return {
    create: items.map((q, i) => ({
      order: i + 1,
      type: q.type as never,
      prompt: q.prompt,
      options: q.options ?? undefined,
      correctAnswers: q.correctAnswers,
    })),
  };
}

// ── Reading & Writing content ───────────────────────────────────────────────
const RW_M1: Q[] = [
  {
    type: "WORDS_IN_CONTEXT",
    stimulus: "<p>Marie Curie's research was so ______ that it reshaped entire fields; her work on radioactivity laid the foundation for both modern physics and chemistry.</p>",
    prompt: "Which choice completes the text with the most logical and precise word?",
    options: ["A) trivial", "B) seminal", "C) tentative", "D) conventional"],
    correctAnswers: ["B"],
  },
  {
    type: "CENTRAL_IDEAS",
    stimulus: "<p>Octopuses can change both the color and the texture of their skin in milliseconds. Specialized cells called chromatophores expand and contract to shift color, while tiny muscles raise or flatten the skin to mimic rocks or coral. This dual ability makes them among the most effective camouflage artists in the animal kingdom.</p>",
    prompt: "Which choice best states the main idea of the text?",
    options: [
      "A) Octopuses rely only on color to hide from predators.",
      "B) Chromatophores are found exclusively in octopuses.",
      "C) Octopuses combine color and texture changes for powerful camouflage.",
      "D) Coral reefs are the only habitat where octopuses can hide.",
    ],
    correctAnswers: ["C"],
  },
  {
    type: "TRANSITIONS",
    stimulus: "<p>The new policy reduced traffic in the city center. ______, air quality measurements showed a noticeable improvement within months.</p>",
    prompt: "Which transition best fits the blank?",
    options: ["A) Nevertheless", "B) Consequently", "C) However", "D) In contrast"],
    correctAnswers: ["B"],
  },
  {
    type: "BOUNDARIES",
    stimulus: "<p>The committee reviewed the proposal ______ it approved the budget the following week.</p>",
    prompt: "Which choice conforms to the conventions of Standard English?",
    options: ["A) carefully,", "B) carefully and", "C) carefully;", "D) carefully"],
    correctAnswers: ["C"],
  },
  {
    type: "INFERENCE",
    stimulus: "<p>Researchers found that students who slept at least eight hours before an exam scored higher than those who studied late into the night. The well-rested group also reported feeling more focused during the test.</p>",
    prompt: "Which choice most logically completes the text's conclusion that ______",
    options: [
      "A) studying is unnecessary for strong exam performance.",
      "B) adequate sleep can support better test outcomes.",
      "C) focus has no relationship to sleep.",
      "D) exams should be scheduled in the evening.",
    ],
    correctAnswers: ["B"],
  },
];

const RW_M2_EASY: Q[] = [
  {
    type: "WORDS_IN_CONTEXT",
    stimulus: "<p>The volunteers were ______ in their efforts, working every weekend to clean the river.</p>",
    prompt: "Which choice completes the text with the most logical word?",
    options: ["A) lazy", "B) diligent", "C) reluctant", "D) careless"],
    correctAnswers: ["B"],
  },
  {
    type: "CENTRAL_IDEAS",
    stimulus: "<p>Bees communicate the location of flowers through a 'waggle dance.' The direction and length of the dance tell other bees where to fly.</p>",
    prompt: "What is the main idea of the text?",
    options: [
      "A) Bees cannot find flowers.",
      "B) Bees use a dance to share where flowers are.",
      "C) Flowers move toward bees.",
      "D) Bees only dance for fun.",
    ],
    correctAnswers: ["B"],
  },
  {
    type: "TRANSITIONS",
    stimulus: "<p>It rained all morning. ______, the match was postponed.</p>",
    prompt: "Which transition best fits the blank?",
    options: ["A) Therefore", "B) However", "C) Nonetheless", "D) Meanwhile"],
    correctAnswers: ["A"],
  },
  {
    type: "BOUNDARIES",
    stimulus: "<p>My sister, who lives in Tashkent ______ visits us every summer.</p>",
    prompt: "Which choice conforms to Standard English conventions?",
    options: ["A) ,", "B) ;", "C) :", "D) —and"],
    correctAnswers: ["A"],
  },
  {
    type: "INFERENCE",
    stimulus: "<p>The library extended its hours, and within a month student visits doubled.</p>",
    prompt: "Which choice most logically completes the text?",
    options: [
      "A) Longer hours discouraged students.",
      "B) Longer hours likely encouraged more visits.",
      "C) Students stopped using the library.",
      "D) The library closed permanently.",
    ],
    correctAnswers: ["B"],
  },
];

const RW_M2_HARD: Q[] = [
  {
    type: "WORDS_IN_CONTEXT",
    stimulus: "<p>Although celebrated in his lifetime, the composer's reputation later became ______: critics oscillated between praising his innovation and dismissing his work as derivative.</p>",
    prompt: "Which choice completes the text with the most logical and precise word?",
    options: ["A) static", "B) mercurial", "C) uniform", "D) negligible"],
    correctAnswers: ["B"],
  },
  {
    type: "TEXTUAL_EVIDENCE",
    stimulus: "<p>A study claims that urban green spaces lower residents' stress. A researcher wants to support the claim that the effect grows with frequency of visits.</p>",
    prompt: "Which finding, if true, would most directly support the researcher's claim?",
    options: [
      "A) Residents who never visited parks reported the same stress as frequent visitors.",
      "B) Stress levels dropped more sharply among residents who visited parks daily than weekly.",
      "C) Parks were equally distributed across the city.",
      "D) Green spaces increased local property values.",
    ],
    correctAnswers: ["B"],
  },
  {
    type: "RHETORICAL_SYNTHESIS",
    stimulus: "<p>Notes: Coral reefs cover under 1% of the ocean floor. They support about 25% of marine species. Reefs are threatened by warming waters.</p>",
    prompt: "The student wants to emphasize the contrast between reefs' small size and their importance. Which choice best uses the notes to accomplish this?",
    options: [
      "A) Coral reefs are threatened by warming waters and cover under 1% of the ocean floor.",
      "B) Though they cover under 1% of the ocean floor, coral reefs support roughly a quarter of all marine species.",
      "C) Coral reefs support about 25% of marine species.",
      "D) Warming waters threaten coral reefs across the ocean.",
    ],
    correctAnswers: ["B"],
  },
  {
    type: "BOUNDARIES",
    stimulus: "<p>The findings were surprising ______ they contradicted decades of accepted theory, prompting a wave of new experiments.</p>",
    prompt: "Which choice conforms to the conventions of Standard English?",
    options: ["A) ; because", "B) : as", "C) because", "D) , and because"],
    correctAnswers: ["C"],
  },
  {
    type: "INFERENCE",
    stimulus: "<p>Economists observed that as automation increased in factories, the demand for highly specialized technicians rose even as routine assembly jobs declined.</p>",
    prompt: "Which choice most logically completes the text?",
    options: [
      "A) Automation eliminates the need for all human workers.",
      "B) Automation can shift, rather than simply reduce, the kinds of skills employers need.",
      "C) Specialized technicians are no longer valued.",
      "D) Routine jobs are unaffected by automation.",
    ],
    correctAnswers: ["B"],
  },
];

// ── Math content ────────────────────────────────────────────────────────────
const MATH_M1: Q[] = [
  { type: "ALGEBRA", prompt: "If 3x + 7 = 22, what is the value of x?", options: ["A) 3", "B) 5", "C) 7", "D) 8"], correctAnswers: ["B"] },
  { type: "ALGEBRA", prompt: "If 2x + 3y = 12 and x − y = 1, what is x + y?", options: ["A) 3", "B) 4", "C) 5", "D) 6"], correctAnswers: ["B"] },
  { type: "PROBLEM_SOLVING", prompt: "A store offers 20% off, then 10% off the reduced price. If the original price is $200, what is the final price?", options: ["A) $140", "B) $144", "C) $150", "D) $160"], correctAnswers: ["B"] },
  { type: "GEOMETRY", prompt: "In a right triangle, one leg is 8 and the hypotenuse is 17. What is the other leg?", options: ["A) 9", "B) 12", "C) 15", "D) 19"], correctAnswers: ["C"] },
  { type: "STUDENT_PRODUCED_RESPONSE", prompt: "The sum of three consecutive integers is 72. What is the largest of the three?", correctAnswers: ["25"] },
];

const MATH_M2_EASY: Q[] = [
  { type: "ALGEBRA", prompt: "If x + 4 = 9, what is x?", options: ["A) 3", "B) 4", "C) 5", "D) 6"], correctAnswers: ["C"] },
  { type: "PROBLEM_SOLVING", prompt: "A car travels 120 miles in 2 hours. What is its average speed in miles per hour?", options: ["A) 40", "B) 50", "C) 60", "D) 70"], correctAnswers: ["C"] },
  { type: "ALGEBRA", prompt: "What is 15% of 80?", options: ["A) 10", "B) 12", "C) 14", "D) 16"], correctAnswers: ["B"] },
  { type: "GEOMETRY", prompt: "A rectangle has length 6 and width 4. What is its area?", options: ["A) 10", "B) 20", "C) 24", "D) 28"], correctAnswers: ["C"] },
  { type: "STUDENT_PRODUCED_RESPONSE", prompt: "If 2x = 14, what is x?", correctAnswers: ["7"] },
];

const MATH_M2_HARD: Q[] = [
  { type: "ADVANCED_MATH", prompt: "A quadratic f(x) = x² + bx + c has roots at x = 2 and x = −3. What is b?", options: ["A) −1", "B) 1", "C) −5", "D) 5"], correctAnswers: ["B"] },
  { type: "ADVANCED_MATH", prompt: "If g(x) = 2ˣ, what is g(3) − g(1)?", options: ["A) 4", "B) 6", "C) 8", "D) 10"], correctAnswers: ["B"] },
  { type: "PROBLEM_SOLVING", prompt: "Which is equivalent to (x²y³)² ÷ (xy²)³?", options: ["A) x", "B) xy", "C) x/y", "D) y/x"], correctAnswers: ["A"] },
  { type: "DATA_ANALYSIS", prompt: "A data set has mean 50 and standard deviation 5. What is the z-score of 62?", options: ["A) 1.2", "B) 2.4", "C) 3.0", "D) 12"], correctAnswers: ["B"] },
  { type: "STUDENT_PRODUCED_RESPONSE", prompt: "The area of a circle is 64π. What is its circumference? (Enter as a multiple of π, e.g. 16π)", correctAnswers: ["16π", "16pi", "50.27", "50.3", "50.265"] },
];

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) {
    console.log("⏭  Skipping demo seed in production (set SEED_FORCE=1 to override).");
    return;
  }

  console.log("🌱 Seeding SATway…");

  const adminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const studentPass = await bcrypt.hash(STUDENT_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@satway.uz" },
    update: {},
    create: { name: "Admin", email: "admin@satway.uz", password: adminPass, role: "ADMIN", emailVerified: true },
  });
  await prisma.user.upsert({
    where: { email: "student@satway.uz" },
    update: {},
    create: { name: "Demo Student", email: "student@satway.uz", password: studentPass, role: "STUDENT", emailVerified: true },
  });

  // Re-seedable in dev: drop the demo tests (cascades to sections/questions).
  await prisma.test.deleteMany({
    where: { slug: { in: ["sat-rw-practice-1", "sat-math-practice-1"] } },
  });

  // ── Reading & Writing (adaptive) ──
  await prisma.test.create({
    data: {
      title: "Digital SAT — Reading & Writing Practice 1",
      slug: "sat-rw-practice-1",
      skill: "READING_WRITING",
      type: "DIGITAL",
      description: "Adaptive Reading & Writing: Module 1, then an easier or harder Module 2 based on your performance.",
      durationSec: 64 * 60,
      published: true,
      sections: {
        create: [
          { order: 1, module: 1, difficulty: "STANDARD", title: "Module 1", instructions: "Answer all questions. You have 32 minutes.", questions: rwQuestions(RW_M1) },
          { order: 2, module: 2, difficulty: "EASY", title: "Module 2 (Standard)", instructions: "You have 32 minutes.", questions: rwQuestions(RW_M2_EASY) },
          { order: 3, module: 2, difficulty: "HARD", title: "Module 2 (Harder)", instructions: "You have 32 minutes.", questions: rwQuestions(RW_M2_HARD) },
        ],
      },
    },
  });

  // ── Math (adaptive) ──
  await prisma.test.create({
    data: {
      title: "Digital SAT — Math Practice 1",
      slug: "sat-math-practice-1",
      skill: "MATH",
      type: "DIGITAL",
      description: "Adaptive Math: Module 1, then an easier or harder Module 2 based on your performance. Calculator allowed.",
      durationSec: 70 * 60,
      published: true,
      sections: {
        create: [
          { order: 1, module: 1, difficulty: "STANDARD", title: "Module 1", instructions: "You may use a calculator. You have 35 minutes.", formulaSheet: true, questions: mathQuestions(MATH_M1) },
          { order: 2, module: 2, difficulty: "EASY", title: "Module 2 (Standard)", instructions: "Calculator allowed. You have 35 minutes.", formulaSheet: true, questions: mathQuestions(MATH_M2_EASY) },
          { order: 3, module: 2, difficulty: "HARD", title: "Module 2 (Harder)", instructions: "Calculator allowed. You have 35 minutes.", formulaSheet: true, questions: mathQuestions(MATH_M2_HARD) },
        ],
      },
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Admin:   admin@satway.uz / ${ADMIN_PASSWORD}`);
  console.log(`   Student: student@satway.uz / ${STUDENT_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
