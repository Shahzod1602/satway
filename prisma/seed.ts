import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Demo credentials are only seeded outside production. Override via env.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin!Satway2026";
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || "Student!Satway2026";

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
    create: {
      name: "Admin",
      email: "admin@satway.uz",
      password: adminPass,
      role: "ADMIN",
      emailVerified: true,
    },
  });
  await prisma.user.upsert({
    where: { email: "student@satway.uz" },
    update: {},
    create: {
      name: "Demo Student",
      email: "student@satway.uz",
      password: studentPass,
      role: "STUDENT",
      emailVerified: true,
    },
  });

  // Tests use unique slugs and aren't upsertable as a tree — seed them once.
  if ((await prisma.test.count()) > 0) {
    console.log("ℹ️  Tests already present, skipping test seed.");
    console.log("✅ Seed complete.");
    return;
  }

  // ── Reading & Writing test ──
  const RW_PASSAGE_1 = `
<p><strong>The Rise of Digital Currencies</strong></p>
<p>In 2009, an anonymous figure using the pseudonym Satoshi Nakamoto introduced Bitcoin, the world's first decentralized digital currency. Unlike traditional currencies, which are issued and regulated by central banks, Bitcoin operates on a peer-to-peer network without any central authority. Transactions are verified by network nodes through cryptography and recorded on a public distributed ledger called a blockchain.</p>
<p>For the first few years of its existence, Bitcoin was largely the domain of cryptography enthusiasts and those skeptical of traditional financial institutions. Its value was negligible—in 2010, a programmer famously paid 10,000 bitcoins for two pizzas, a transaction that would later be valued at hundreds of millions of dollars.</p>
<p>The appeal of cryptocurrencies lies partly in their resistance to censorship and their potential to provide financial services to the unbanked. However, they have also attracted criticism for their energy consumption, their use in illicit transactions, and their extreme price volatility. Despite these concerns, by 2024, more than 20,000 different cryptocurrencies existed, and major financial institutions had begun to offer cryptocurrency-related services to their clients.</p>
`.trim();

  await prisma.test.create({
    data: {
      title: "Digital SAT — Reading & Writing Practice 1",
      slug: "sat-rw-practice-1",
      skill: "READING_WRITING",
      type: "DIGITAL",
      description: "Reading & Writing section with 2 modules. Module 1 with passage-based questions and discrete questions.",
      durationSec: 3840, // 64 minutes for both modules
      published: true,
      sections: {
        create: [
          {
            order: 1,
            title: "Module 1",
            instructions: "Answer all questions in this module. You have 32 minutes.",
            passageText: RW_PASSAGE_1,
            questions: {
              create: [
                {
                  order: 1,
                  type: "CENTRAL_IDEAS",
                  groupTitle: "Questions 1–4 refer to the following passage.",
                  prompt: "Which choice best describes the main idea of the passage?",
                  options: [
                    "A) Bitcoin was created by an anonymous programmer in 2009.",
                    "B) Digital currencies have evolved from a niche interest to a significant financial phenomenon, despite ongoing concerns.",
                    "C) Cryptocurrencies consume too much energy and should be regulated.",
                    "D) Blockchain technology is too complex for everyday use.",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 2,
                  type: "TEXTUAL_EVIDENCE",
                  prompt: "According to the passage, one appeal of cryptocurrencies is their ability to",
                  options: [
                    "A) replace central banks entirely.",
                    "B) provide financial services to those without bank accounts.",
                    "C) eliminate the need for cryptography.",
                    "D) guarantee stable returns on investment.",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 3,
                  type: "INFERENCE",
                  prompt: "The author mentions the 10,000 bitcoin pizza purchase primarily to",
                  options: [
                    "A) criticize wasteful spending on food.",
                    "B) illustrate how dramatically Bitcoin's value has changed over time.",
                    "C) demonstrate Bitcoin's use as a payment method.",
                    "D) show that early Bitcoin users were not serious.",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 4,
                  type: "WORDS_IN_CONTEXT",
                  prompt: 'In the passage, the word "domain" most nearly means',
                  options: [
                    "A) territory.",
                    "B) website.",
                    "C) field of activity.",
                    "D) kingdom.",
                  ],
                  correctAnswers: ["C"],
                },
                {
                  order: 5,
                  type: "MCQ_SINGLE",
                  groupTitle: null,
                  prompt: "A company's revenue increased by 25% from 2022 to 2023, then decreased by 20% from 2023 to 2024. If the 2022 revenue was $400,000, what was the 2024 revenue?",
                  options: [
                    "A) $400,000",
                    "B) $420,000",
                    "C) $440,000",
                    "D) $380,000",
                  ],
                  correctAnswers: ["A"],
                  meta: { topic: "percent_change" },
                },
                {
                  order: 6,
                  type: "TRANSITIONS",
                  prompt: "Select the best transition word to connect the ideas.",
                  options: [
                    "A) However",
                    "B) Therefore",
                    "C) For instance",
                    "D) Meanwhile",
                  ],
                  correctAnswers: ["A"],
                },
              ],
            },
          },
          {
            order: 2,
            title: "Module 2",
            instructions: "Answer all questions in this module. You have 32 minutes.",
            questions: {
              create: [
                {
                  order: 7,
                  type: "MCQ_SINGLE",
                  prompt: "If 3x + 7 = 22, what is the value of x?",
                  options: [
                    "A) 3",
                    "B) 5",
                    "C) 7",
                    "D) 8",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 8,
                  type: "RHETORICAL_SYNTHESIS",
                  prompt: "Which choice best synthesizes the research findings?",
                  options: [
                    "A) All studies agree that exercise improves cognitive function.",
                    "B) While most studies show a positive correlation between exercise and cognitive function, the degree of improvement varies significantly based on exercise type and intensity.",
                    "C) Exercise has no measurable effect on cognitive function according to recent research.",
                    "D) Only aerobic exercise, not strength training, improves cognitive function.",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 9,
                  type: "BOUNDARIES",
                  prompt: "Select the grammatically correct sentence.",
                  options: [
                    "A) The teams strategy, which had been developed over months, proved effective.",
                    "B) The team's strategy which had been developed over months proved effective.",
                    "C) The team's strategy, which had been developed over months, proved effective.",
                    "D) The teams' strategy, which had been developed over months, proved effective.",
                  ],
                  correctAnswers: ["C"],
                },
                {
                  order: 10,
                  type: "WORDS_IN_CONTEXT",
                  prompt: "Choose the word that best fits the context.",
                  options: [
                    "A) mitigate",
                    "B) exacerbate",
                    "C) accelerate",
                    "D) facilitate",
                  ],
                  correctAnswers: ["A"],
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Math test ──
  await prisma.test.create({
    data: {
      title: "Digital SAT — Math Practice 1",
      slug: "sat-math-practice-1",
      skill: "MATH",
      type: "DIGITAL",
      description: "Math section with 2 modules. Calculator allowed on all questions. Includes algebra, advanced math, problem solving, and geometry.",
      durationSec: 4200, // 70 minutes
      published: true,
      sections: {
        create: [
          {
            order: 1,
            title: "Module 1",
            instructions: "You may use a calculator. Answer all questions. You have 35 minutes.",
            formulaSheet: false,
            questions: {
              create: [
                {
                  order: 1,
                  type: "ALGEBRA",
                  prompt: "If 2x + 3y = 12 and x - y = 1, what is the value of x + y?",
                  options: [
                    "A) 3",
                    "B) 4",
                    "C) 5",
                    "D) 6",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 2,
                  type: "ALGEBRA",
                  prompt: "Solve for x: 2(x - 3) + 4 = 3x - 5",
                  options: [
                    "A) 1",
                    "B) 2",
                    "C) 3",
                    "D) 4",
                  ],
                  correctAnswers: ["C"],
                },
                {
                  order: 3,
                  type: "ADVANCED_MATH",
                  prompt: "A quadratic function f(x) = x² + bx + c has roots at x = 2 and x = -3. What is the value of b?",
                  options: [
                    "A) -1",
                    "B) 1",
                    "C) -5",
                    "D) 5",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 4,
                  type: "STUDENT_PRODUCED_RESPONSE",
                  prompt: "The area of a circle is 64π. What is the circumference of the circle?",
                  correctAnswers: ["16π", "16pi", "50.24", "50.265", "50.27", "50.3"],
                  meta: { acceptDecimal: true },
                },
                {
                  order: 5,
                  type: "MCQ_SINGLE",
                  prompt: "A line passes through points (2, 5) and (6, 13). What is the slope of this line?",
                  options: [
                    "A) 2",
                    "B) 3",
                    "C) 4",
                    "D) 1/2",
                  ],
                  correctAnswers: ["A"],
                },
                {
                  order: 6,
                  type: "PROBLEM_SOLVING",
                  prompt: "A store offers a 20% discount, then an additional 10% off the discounted price. If the original price was $200, what is the final price?",
                  options: [
                    "A) $140",
                    "B) $144",
                    "C) $150",
                    "D) $160",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 7,
                  type: "STUDENT_PRODUCED_RESPONSE",
                  prompt: "If f(x) = x³ - 2x² + x - 1, what is f(2)?",
                  correctAnswers: ["5"],
                },
                {
                  order: 8,
                  type: "GEOMETRY",
                  prompt: "In a right triangle, one leg is 8 and the hypotenuse is 17. What is the length of the other leg?",
                  options: [
                    "A) 9",
                    "B) 12",
                    "C) 15",
                    "D) 19",
                  ],
                  correctAnswers: ["C"],
                },
                {
                  order: 9,
                  type: "DATA_ANALYSIS",
                  prompt: "A data set has mean 50 and standard deviation 5. What is the z-score of a value of 62?",
                  options: [
                    "A) 1.2",
                    "B) 2.4",
                    "C) 3.0",
                    "D) 12",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 10,
                  type: "STUDENT_PRODUCED_RESPONSE",
                  prompt: "The sum of three consecutive integers is 72. What is the largest of the three integers?",
                  correctAnswers: ["25"],
                },
              ],
            },
          },
          {
            order: 2,
            title: "Module 2",
            instructions: "You may use a calculator. Answer all questions. You have 35 minutes.",
            formulaSheet: true,
            questions: {
              create: [
                {
                  order: 11,
                  type: "ADVANCED_MATH",
                  prompt: "If g(x) = 2^x, what is g(3) - g(1)?",
                  options: [
                    "A) 4",
                    "B) 6",
                    "C) 8",
                    "D) 10",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 12,
                  type: "STUDENT_PRODUCED_RESPONSE",
                  prompt: "Factor: x² - 5x + 6 = 0. What is the sum of the solutions?",
                  correctAnswers: ["5"],
                },
                {
                  order: 13,
                  type: "MCQ_SINGLE",
                  prompt: "Which of the following is equivalent to (x²y³)² ÷ (xy²)³?",
                  options: [
                    "A) x",
                    "B) xy",
                    "C) x/y",
                    "D) y/x",
                  ],
                  correctAnswers: ["A"],
                },
                {
                  order: 14,
                  type: "PROBLEM_SOLVING",
                  prompt: "A car travels 240 miles in 4 hours. At the same speed, how long will it take to travel 360 miles?",
                  options: [
                    "A) 5 hours",
                    "B) 6 hours",
                    "C) 7 hours",
                    "D) 8 hours",
                  ],
                  correctAnswers: ["B"],
                },
                {
                  order: 15,
                  type: "GEOMETRY",
                  prompt: "A cylinder has a radius of 3 and a height of 10. What is its volume? (Use π ≈ 3.14)",
                  options: [
                    "A) 94.2",
                    "B) 188.4",
                    "C) 282.6",
                    "D) 376.8",
                  ],
                  correctAnswers: ["C"],
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Admin:   admin@satway.uz / ${ADMIN_PASSWORD}`);
  console.log(`   Student: student@satway.uz / ${STUDENT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
