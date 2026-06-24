import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail, passwordResetEmail } from "@/lib/mail";
import { generateCode, hashCode, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";
import { parseJson, emailSchema } from "@/lib/validation";
import { tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({ email: emailSchema });

// Step 1 of the password-reset flow: email a 6-digit code to a registered
// account. We always return `ok` so an attacker can't probe which emails are
// registered (no account enumeration) — the code is only sent if the account
// actually exists.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`forgot-password:${clientIp(req)}`, 10, 60 * 60 * 1000); // 10/hour/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { email } = await parseJson(req, bodySchema);

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!account) {
    // Pretend success — don't reveal that this email isn't registered.
    return Response.json({ ok: true });
  }

  // Throttle resends per email.
  const existing = await prisma.emailOtp.findUnique({ where: { email } });
  if (existing && existing.lastSentAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    return Response.json({ ok: true });
  }

  const code = generateCode();
  const codeHash = await hashCode(code);

  await prisma.emailOtp.upsert({
    where: { email },
    update: {
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      verified: false,
      lastSentAt: new Date(),
    },
    create: { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const mail = passwordResetEmail(code);
  await sendMail({ to: email, ...mail });

  return Response.json({ ok: true });
});
