import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, verificationEmail } from "@/lib/mail";
import { generateCode, hashCode, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existing = await prisma.emailOtp.findUnique({ where: { email } });
  if (existing && existing.lastSentAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait before requesting another code" }, { status: 429 });
  }

  const code = generateCode();
  const codeHash = await hashCode(code);

  await prisma.emailOtp.upsert({
    where: { email },
    update: { codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, lastSentAt: new Date() },
    create: { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const mail = verificationEmail(code);
  await sendMail({ to: email, ...mail });

  return NextResponse.json({ ok: true });
}
