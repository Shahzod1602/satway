import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function verifyCodeHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
