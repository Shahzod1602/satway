// The day-2 nudge — the one message aimed at the biggest hole in the product.
//
// Win-back fires when Premium EXPIRES. That is far too late for the actual problem: the
// overwhelming majority of accounts sign up, look around once, and are never seen again.
// By the time win-back has anything to say, that person left weeks ago.
//
// This is the message that goes to someone who signed up and never really started, while
// they still remember signing up. It is sent ONCE, ever — this is not a newsletter, and a
// second "come back!" to someone who has decided is just an unsubscribe with extra steps.

import type { PrismaClient } from "@/generated/prisma/client";
import { sendMail } from "./mail";
import { sendTelegramMessage } from "./telegram";
import { appUrl, isSyntheticEmail } from "./winback";

/**
 * How long after signup to wait.
 *
 * Not 24h: someone who signed up yesterday evening and plans to study tonight has not
 * churned, and telling them they have is both wrong and annoying. 36h means everybody
 * nudged has had at least one full day they did not use.
 */
const NUDGE_AFTER_HOURS = 36;

/**
 * Stop nudging after this. Past two weeks the message stops being "you just signed up"
 * and starts being cold outreach to a stranger, which is a different thing and works
 * worse. Also bounds the very first run against the entire back catalogue of accounts.
 */
const NUDGE_BEFORE_DAYS = 14;

const DEFAULT_LIMIT = 300;
const CONCURRENCY = 4;

export type NudgeSummary = {
  dry: boolean;
  candidates: number;
  neverStarted: number;
  drifted: number;
  emailSent: number;
  emailOptedOut: number;
  emailFailed: number;
  telegramSent: number;
  telegramUnreachable: number;
  telegramFailed: number;
  marked: number;
  sample: string[];
};

type Candidate = {
  id: string;
  name: string;
  email: string;
  telegramId: string | null;
  emailNotifications: boolean;
  lastActiveDay: string | null;
};

const firstName = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] || "there";

export function nudgeEmail(opts: { name?: string | null; neverStarted: boolean }): {
  subject: string;
  html: string;
  text: string;
} {
  const name = firstName(opts.name);
  const url = appUrl(opts.neverStarted ? "/dashboard" : "/home");

  const subject = opts.neverStarted
    ? "Your first SAT practice test is waiting"
    : "Pick up where you left off on SATway";

  const lead = opts.neverStarted
    ? `You signed up for SATway but haven't taken a test yet. The first one is free and takes about 35 minutes — you'll get a real 200–800 section score at the end, not a guess.`
    : `You made a start on SATway and then life happened. Your progress is still there, and the fastest way back in is one module: about 35 minutes, one real score.`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr><td style="padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">Hi ${name},</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${lead}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
        SATway is adaptive like the real Digital SAT: how you do in Module 1 decides which
        Module 2 you get. That is the only way a practice score means anything.
      </p>
      <a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
        Take a practice test
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">
        Don't want emails like this? Turn them off in your profile — it takes one click.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = `Hi ${name},\n\n${lead}\n\nTake a practice test: ${url}\n\nDon't want emails like this? Turn them off in your profile.`;

  return { subject, html, text };
}

export function nudgeTelegram(opts: { name?: string | null; neverStarted: boolean }): {
  text: string;
  button: { text: string; url: string };
} {
  const name = firstName(opts.name);
  const text = opts.neverStarted
    ? `Hi ${name} — you signed up for SATway but haven't taken a test yet.\n\nThe first one is free, takes ~35 minutes, and gives you a real 200–800 section score.`
    : `Hi ${name} — your SATway progress is still waiting.\n\nOne module is ~35 minutes and gives you a real section score.`;
  return {
    text,
    button: { text: "Take a practice test", url: appUrl(opts.neverStarted ? "/dashboard" : "/home") },
  };
}

/**
 * Find people who signed up and never really started, and send them exactly one nudge.
 *
 * Pass { dry: true } to count and preview WITHOUT sending or stamping.
 */
export async function processNudge(
  prisma: PrismaClient,
  opts?: { dry?: boolean; limit?: number },
): Promise<NudgeSummary> {
  const dry = !!opts?.dry;
  const now = new Date();
  const limit = opts?.limit ?? DEFAULT_LIMIT;

  const notBefore = new Date(now.getTime() - NUDGE_BEFORE_DAYS * 86_400_000);
  const notAfter = new Date(now.getTime() - NUDGE_AFTER_HOURS * 3_600_000);

  // Tashkent day keys, matching User.lastActiveDay (see src/lib/streak.ts). A student
  // active today or yesterday has not churned and must never be nudged — that message
  // would land while they are literally mid-session.
  const dayKey = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));

  const list = (await prisma.user.findMany({
    where: {
      nudgeSentAt: null, // once, ever
      createdAt: { gte: notBefore, lte: notAfter },
      role: "STUDENT", // never nudge yourself
      // Never submitted anything, or last submitted before yesterday. `notIn` with a
      // nullable column excludes NULLs in SQL, so the null case is a separate branch.
      OR: [{ lastActiveDay: null }, { lastActiveDay: { notIn: [today, yesterday] } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      emailNotifications: true,
      lastActiveDay: true,
    },
    orderBy: { createdAt: "asc" }, // oldest signups first — they go stale soonest
    take: limit,
  })) as Candidate[];

  const s: NudgeSummary = {
    dry,
    candidates: list.length,
    neverStarted: list.filter((u) => u.lastActiveDay === null).length,
    drifted: list.filter((u) => u.lastActiveDay !== null).length,
    emailSent: 0,
    emailOptedOut: 0,
    emailFailed: 0,
    telegramSent: 0,
    telegramUnreachable: 0,
    telegramFailed: 0,
    marked: 0,
    sample: list.slice(0, 5).map((u) => u.email || u.id),
  };

  const processOne = async (u: Candidate) => {
    const neverStarted = u.lastActiveDay === null;
    const canEmail = !!u.email && !isSyntheticEmail(u.email);
    const optedOut = !u.emailNotifications; // one flag governs BOTH channels
    let emailOk = false;
    let tgOk = false;
    let retryable = false;

    if (canEmail) {
      if (optedOut) {
        s.emailOptedOut++;
      } else if (dry) {
        s.emailSent++;
        emailOk = true;
      } else {
        try {
          const { subject, html, text } = nudgeEmail({ name: u.name, neverStarted });
          if (await sendMail({ to: u.email, subject, html, text })) {
            s.emailSent++;
            emailOk = true;
          } else {
            s.emailFailed++;
            retryable = true;
          }
        } catch {
          s.emailFailed++;
          retryable = true;
        }
      }
    }

    if (u.telegramId && !optedOut) {
      if (dry) {
        s.telegramSent++;
        tgOk = true;
      } else {
        const { text, button } = nudgeTelegram({ name: u.name, neverStarted });
        const r = await sendTelegramMessage(u.telegramId, text, { button });
        if (r.ok) {
          s.telegramSent++;
          tgOk = true;
        } else if (r.blocked) {
          s.telegramUnreachable++; // terminal — never /started the bot
        } else {
          s.telegramFailed++;
          retryable = true;
        }
      }
    }

    // Stamp unless a TRANSIENT failure means we should retry next run. Terminal cases
    // (opted out, telegram-blocked, no reachable channel) get stamped so they do not
    // clog the queue forever — same contract as win-back.
    if (!dry && (emailOk || tgOk || !retryable)) {
      await prisma.user.update({ where: { id: u.id }, data: { nudgeSentAt: now } });
      s.marked++;
    }
  };

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    await Promise.all(list.slice(i, i + CONCURRENCY).map(processOne));
  }

  return s;
}
