import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

// POST — permanently delete the signed-in user's account (and, via cascade,
// their attempts, answers, payments, and support messages). Password-confirmed
// for email accounts; Telegram-only accounts (random password) skip the check.
export async function POST(req: NextRequest) {
  const sessionUser = await currentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.telegramId) {
    const ok = await bcrypt.compare(String(body.password ?? ""), user.password);
    if (!ok) return NextResponse.json({ error: "Password is incorrect" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
}
