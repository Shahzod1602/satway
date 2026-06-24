import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseJson, emailSchema, passwordSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { welcomePremiumUntil } from "@/lib/access";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: emailSchema,
  password: passwordSchema,
  referralCode: z.string().trim().max(40).optional(),
});

// Final step of email-first signup: the email has already been proven via the
// OTP flow (send-code → verify-code). Here we collect name + password and
// create the verified account.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { name, email, password, referralCode } = await parseJson(req, bodySchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("An account with this email already exists", 409);
  }

  // The email must have been verified in this signup session.
  const otp = await prisma.emailOtp.findUnique({ where: { email } });
  if (!otp || !otp.verified) {
    return jsonError("Please verify your email first.", 403);
  }

  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredById = referrer.id;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Welcome gift: every new account starts with a short free Premium trial.
  const premiumUntil = welcomePremiumUntil();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "STUDENT",
        emailVerified: true,
        referredById,
        plan: "PREMIUM",
        premiumUntil,
      },
    });
    await tx.emailOtp.delete({ where: { email } });
  });

  return Response.json({ ok: true });
});
