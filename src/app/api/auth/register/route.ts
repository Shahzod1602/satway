import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMail, verificationEmail } from "@/lib/mail";
import { generateCode, hashCode, verifyCodeHash, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; referralCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password, name, referralCode } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // Find referrer if referral code provided
  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredById = referrer.id;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = generateCode();
  const codeHash = await hashCode(verificationCode);

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "STUDENT",
        referredById,
      },
    });

    await tx.emailOtp.upsert({
      where: { email: normalizedEmail },
      update: { codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      create: { email: normalizedEmail, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
  });

  // Send verification email
  try {
    const mail = verificationEmail(verificationCode);
    await sendMail({ to: normalizedEmail, ...mail });
  } catch (e) {
    console.error("[register] mail error:", e);
  }

  return NextResponse.json({ ok: true });
}
