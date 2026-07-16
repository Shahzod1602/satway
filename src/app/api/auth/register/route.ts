import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseJson, emailSchema, passwordSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { welcomePremiumUntil, WELCOME_PREMIUM_DAYS } from "@/lib/access";
import { sendMail, welcomeEmail } from "@/lib/mail";
import { appUrl } from "@/lib/winback";

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

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
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
      select: { id: true, name: true },
    });
    await tx.emailOtp.delete({ where: { email } });
    return u;
  });

  // Outside the transaction, deliberately: an SMTP call can take seconds, and holding a
  // database connection open for it under a signup spike is how the pool runs dry.
  //
  // Awaited rather than fire-and-forget because this route runs in a serverless-style
  // handler — a floating promise can be killed the moment the response is returned. The
  // send is wrapped so a mail outage can never fail a registration that already
  // committed: the account exists, and the day-2 nudge will reach them anyway.
  try {
    const { subject, html, text } = welcomeEmail({
      name: created.name,
      trialDays: WELCOME_PREMIUM_DAYS,
      appUrl: appUrl(),
    });
    if (await sendMail({ to: email, subject, html, text })) {
      await prisma.user.update({
        where: { id: created.id },
        data: { welcomeSentAt: new Date() },
      });
    }
  } catch (e) {
    console.error("[register] welcome email failed:", (e as Error).message);
  }

  return Response.json({ ok: true });
});
