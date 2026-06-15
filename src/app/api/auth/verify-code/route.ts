import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCodeHash, OTP_MAX_ATTEMPTS } from "@/lib/otp";

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const code = body.code;
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const otp = await prisma.emailOtp.findUnique({ where: { email } });
  if (!otp) {
    return NextResponse.json({ error: "No verification code found" }, { status: 404 });
  }
  if (otp.expiresAt < new Date()) {
    return NextResponse.json({ error: "Code has expired" }, { status: 410 });
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }

  await prisma.emailOtp.update({ where: { email }, data: { attempts: otp.attempts + 1 } });

  const valid = await verifyCodeHash(code, otp.codeHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { emailVerified: true } }),
    prisma.emailOtp.delete({ where: { email } }),
  ]);

  return NextResponse.json({ ok: true });
}
