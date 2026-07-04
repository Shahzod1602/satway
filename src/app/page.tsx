import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Landing from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  // Honest, live social proof — real DB counts that grow over time (no fabricated numbers).
  let stats = { students: 0, tests: 0, questions: 0 };
  try {
    const [students, tests, questions] = await Promise.all([
      prisma.user.count(),
      prisma.testAttempt.count({ where: { status: "SUBMITTED" } }),
      prisma.attemptAnswer.count(),
    ]);
    stats = { students, tests, questions };
  } catch {
    // DB unavailable → the landing simply hides the stats band rather than erroring.
  }

  return <Landing stats={stats} />;
}
