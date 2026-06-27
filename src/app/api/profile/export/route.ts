import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

// GET — download a JSON copy of the signed-in user's data (privacy / data export).
export async function GET() {
  const sessionUser = await currentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      country: true,
      nativeLanguage: true,
      phone: true,
      targetScore: true,
      targetMathScore: true,
      targetRWScore: true,
      examDate: true,
      emailNotifications: true,
      plan: true,
      premiumUntil: true,
      telegramUsername: true,
      referralCode: true,
      attempts: {
        select: {
          id: true,
          testId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          rawScore: true,
          totalQuestions: true,
          scaledScore: true,
          module: true,
        },
      },
      payments: {
        select: { planLabel: true, months: true, amount: true, status: true, createdAt: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(JSON.stringify(user, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="satway-data-${user.id}.json"`,
    },
  });
}
