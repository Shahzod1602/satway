import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { notifyAdminPayment } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const sessionUser = await currentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: { plan?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const planLabel = typeof body.plan === "string" ? body.plan : "UNKNOWN";
  const amount = Number(body.amount) || 0;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const months = planLabel === "1m" ? 1 : planLabel === "3m" ? 3 : planLabel === "6m" ? 6 : 1;
  const premiumUntil = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { plan: "PREMIUM", premiumUntil },
  });

  notifyAdminPayment(user.name, planLabel, amount);

  return NextResponse.json({ ok: true });
}
