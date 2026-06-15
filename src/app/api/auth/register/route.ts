import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMail, verificationEmail } from "@/lib/mail";
import { generateCode, hashCode, OTP_TTL_MS } from "@/lib/otp";
import { parseJson, emailSchema, passwordSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: emailSchema,
  password: passwordSchema,
  referralCode: z.string().trim().max(40).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { name, email, password, referralCode } = await parseJson(req, bodySchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("An account with this email already exists", 409);
  }

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
      data: { name, email, password: hashedPassword, role: "STUDENT", referredById },
    });
    await tx.emailOtp.upsert({
      where: { email },
      update: { codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      create: { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
  });

  try {
    const mail = verificationEmail(verificationCode);
    await sendMail({ to: email, ...mail });
  } catch (e) {
    console.error("[register] mail error:", e);
  }

  return Response.json({ ok: true });
});
