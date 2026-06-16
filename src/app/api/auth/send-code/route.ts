import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail, verificationEmail } from "@/lib/mail";
import { generateCode, hashCode, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";
import { parseJson, emailSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({ email: emailSchema });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`send-code:${clientIp(req)}`, 10, 60 * 60 * 1000); // 10/hour/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { email } = await parseJson(req, bodySchema);

  // Email-first signup: the account doesn't exist yet, so block only emails
  // that are already registered.
  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (account) {
    return jsonError("An account with this email already exists. Please sign in.", 409);
  }

  const existing = await prisma.emailOtp.findUnique({ where: { email } });
  if (existing && existing.lastSentAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    return jsonError("Please wait before requesting another code", 429);
  }

  const code = generateCode();
  const codeHash = await hashCode(code);

  await prisma.emailOtp.upsert({
    where: { email },
    update: { codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, verified: false, lastSentAt: new Date() },
    create: { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const mail = verificationEmail(code);
  await sendMail({ to: email, ...mail });

  return Response.json({ ok: true });
});
