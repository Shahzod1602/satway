// Manually run the Premium win-back job (email + Telegram) against Postgres.
//
//   # preview only — counts targets, sends nothing, stamps nothing:
//   DATABASE_URL="postgresql://…" npx tsx scripts/send-winback.ts --dry
//
//   # actually send (and stamp winbackSentAt):
//   DATABASE_URL="postgresql://…" npx tsx scripts/send-winback.ts
//
//   # cap how many users to process in this run:
//   DATABASE_URL="postgresql://…" npx tsx scripts/send-winback.ts --limit=50
//
// In production the cron route (/api/cron/winback) is the normal trigger.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { processWinback } from "../src/lib/winback";

const dry = process.argv.includes("--dry");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10) || 0) : undefined;

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl || dbUrl.startsWith("file:")) {
  console.error(
    "✖ DATABASE_URL must point at Postgres (got " + (dbUrl || "<empty>") + ").",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

async function main() {
  console.log(`Win-back ${dry ? "(DRY RUN — nothing sent)" : "(LIVE)"}${limit ? ` limit=${limit}` : ""}…`);
  const summary = await processWinback(prisma, { dry, limit });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
