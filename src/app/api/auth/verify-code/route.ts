import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyCodeHash, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { parseJson, emailSchema, otpCodeSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({ email: emailSchema, code: otpCodeSchema });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`verify-code:${clientIp(req)}`, 20, 10 * 60 * 1000); // 20/10min/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { email, code } = await parseJson(req, bodySchema);

  const otp = await prisma.emailOtp.findUnique({ where: { email } });
  if (!otp) return jsonError("No verification code found", 404);
  if (otp.expiresAt < new Date()) return jsonError("Code has expired", 410);
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return jsonError("Too many attempts. Request a new code.", 429);
  }

  await prisma.emailOtp.update({ where: { email }, data: { attempts: otp.attempts + 1 } });

  const valid = await verifyCodeHash(code, otp.codeHash);
  if (!valid) return jsonError("Invalid code", 400);

  // Mark the email as proven. The account itself is created in the final
  // register step (email-first signup), so we keep the OTP record around.
  await prisma.emailOtp.update({ where: { email }, data: { verified: true } });

  return Response.json({ ok: true });
});
