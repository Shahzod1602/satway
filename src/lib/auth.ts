import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";
import {
  verifyTelegramAuth,
  isAuthFresh,
  findOrCreateTelegramUser,
  type TelegramAuthData,
} from "./telegramAuth";

const ROLES = ["STUDENT", "ADMIN"] as const;
function normalizeRole(role: unknown): string {
  return ROLES.includes(role as (typeof ROLES)[number]) ? (role as string) : "STUDENT";
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.toLowerCase().trim();

        // Throttle brute-force attempts per account.
        const rl = rateLimit(`login:${email}`, 10, 15 * 60 * 1000); // 10/15min
        if (!rl.ok) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Generic message for both "no such email" and "wrong password" so the
        // login form can't be used to enumerate which emails are registered.
        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // Enforce email verification — the OTP flow at signup must be completed.
        if (!user.emailVerified) {
          throw new Error("Please verify your email before signing in.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
        };
      },
    }),
    // Sign in / sign up with the Telegram Login Widget. The widget posts a
    // signed payload; we verify the HMAC server-side and find-or-create the
    // linked account.
    CredentialsProvider({
      id: "telegram",
      name: "Telegram",
      credentials: {
        data: { label: "Telegram data", type: "text" },
        referralCode: { label: "Referral code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.data) {
          throw new Error("Missing Telegram authorization data");
        }

        let tg: TelegramAuthData;
        try {
          tg = JSON.parse(credentials.data);
        } catch {
          throw new Error("Invalid Telegram authorization data");
        }

        const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
        if (!token) {
          throw new Error("Telegram sign-in is not configured");
        }
        if (!verifyTelegramAuth(tg, token)) {
          throw new Error("Telegram verification failed");
        }
        if (!isAuthFresh(tg.auth_date)) {
          throw new Error("Telegram login expired. Please try again.");
        }

        // Throttle account creation/login per Telegram id.
        const rl = rateLimit(`tg-login:${tg.id}`, 20, 15 * 60 * 1000);
        if (!rl.ok) {
          throw new Error("Too many attempts. Please try again later.");
        }

        const user = await findOrCreateTelegramUser(
          tg,
          credentials.referralCode?.trim() || undefined,
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = normalizeRole((user as unknown as { role: string }).role);
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string }).id = token.id as string;
        (session.user as { id: string; role: string }).role = normalizeRole(token.role);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
