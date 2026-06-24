import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseJson, emailSchema, passwordSchema } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const bodySchema = z.object({ email: emailSchema, password: passwordSchema });

// Final step of the password-reset flow: the code has already been proven via
// the OTP flow (forgot-password → verify-code). Here we set the new password.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const rl = rateLimit(`reset-password:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { email, password } = await parseJson(req, bodySchema);

  // The reset code must have been verified in this session.
  const otp = await prisma.emailOtp.findUnique({ where: { email } });
  if (!otp || !otp.verified) {
    return jsonError("Please verify your reset code first.", 403);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    // The verified OTP is meaningless without an account — clean it up.
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
    return jsonError("No account found for this email.", 404);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    await tx.emailOtp.delete({ where: { email } });
  });

  return Response.json({ ok: true });
});
