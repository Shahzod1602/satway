// Win-back: re-engage users whose Premium (incl. the welcome trial) has expired.
// Channels: in-app banner (computed live in the UI), a marketing email, and a
// best-effort Telegram DM. Shared by the cron route and the manual script.
import type { PrismaClient } from "@/generated/prisma/client";
import { sendMail } from "@/lib/mail";
import { sendTelegramMessage } from "@/lib/telegram";
import { PREMIUM_PLANS, BASE_MONTHLY, fmtUZS } from "@/lib/plans";

/** Absolute URL on the public site (used in emails / Telegram buttons). */
export function appUrl(path = ""): string {
  const base = (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://satway.online"
  ).replace(/\/$/, "");
  return base + path;
}

/** Telegram-only accounts get a synthetic email — never send marketing there. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.includes("@telegram.");
}

/** The plan we headline in marketing copy (most popular, else best discount). */
function featuredPlan() {
  return (
    PREMIUM_PLANS.find((p) => p.popular) ??
    [...PREMIUM_PLANS].sort((a, b) => b.discount - a.discount)[0]
  );
}

const PERKS = [
  "Every full-length adaptive Digital SAT test",
  "1000+ practice tests (free plan = Test 1 only)",
  "Detailed Math + Reading & Writing score reports",
  "Mock exams under real test-day conditions",
];

// ── Marketing email ──────────────────────────────────────────────────────────
export function winbackEmail(opts: { name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const name = (opts.name || "").trim().split(/\s+/)[0] || "there";
  const plan = featuredPlan();
  const was = BASE_MONTHLY * plan.months;
  const url = appUrl("/upgrade");
  const maxDiscount = Math.max(...PREMIUM_PLANS.map((p) => p.discount));

  const subject = `Your SATway Premium has ended — come back with up to ${maxDiscount}% off`;

  const text = [
    `Hi ${name},`,
    ``,
    `Your SATway Premium has ended, so you're back on the free plan.`,
    `Renew now to keep pushing your score up:`,
    ...PERKS.map((p) => `  • ${p}`),
    ``,
    `${plan.label} — ${fmtUZS(plan.total)} UZS (was ${fmtUZS(was)} UZS, ${plan.discount}% off).`,
    `Renew here: ${url}`,
    ``,
    `Keep studying,`,
    `The SATway team`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-size:22px;font-weight:800;margin-bottom:20px">
      SAT<span style="background:#2563eb;color:#fff;border-radius:6px;padding:2px 6px">way</span>
    </div>

    <h1 style="font-size:22px;line-height:1.3;margin:0 0 8px">Your Premium has ended, ${name} 👋</h1>
    <p style="font-size:15px;color:#475569;margin:0 0 20px">
      You've been moved back to the free plan. Pick up right where you left off —
      renew Premium and unlock everything again:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px">
      ${PERKS.map(
        (p) => `
      <tr>
        <td style="vertical-align:top;padding:6px 10px 6px 0;font-size:18px">✅</td>
        <td style="padding:6px 0;font-size:14px;color:#334155">${p}</td>
      </tr>`,
      ).join("")}
    </table>

    <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;padding:18px 20px;margin:0 0 22px">
      <div style="font-size:13px;color:#2563eb;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Most popular</div>
      <div style="font-size:20px;font-weight:800;margin:4px 0 2px">${plan.label} — ${fmtUZS(plan.total)} UZS</div>
      <div style="font-size:13px;color:#64748b">
        <span style="text-decoration:line-through">${fmtUZS(was)} UZS</span>
        &nbsp;·&nbsp;<span style="color:#16a34a;font-weight:700">${plan.discount}% off</span>
      </div>
    </div>

    <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:12px">
      Renew Premium →
    </a>

    <p style="font-size:12px;color:#94a3b8;margin:28px 0 0">
      You're receiving this because you have email notifications on for your SATway account.
      You can turn them off anytime in your Profile.
    </p>
  </div>`;

  return { subject, html, text };
}

// ── Telegram DM ──────────────────────────────────────────────────────────────
export function winbackTelegram(opts: { name?: string | null }): {
  text: string;
  button: { text: string; url: string };
} {
  const name = (opts.name || "").trim().split(/\s+/)[0] || "there";
  const plan = featuredPlan();
  const maxDiscount = Math.max(...PREMIUM_PLANS.map((p) => p.discount));
  const text = [
    `👋 <b>${name}, your SATway Premium has ended</b>`,
    ``,
    `Renew now to keep full access to:`,
    `• Every full-length adaptive Digital SAT test`,
    `• 1000+ practice tests &amp; detailed score reports`,
    `• Mock exams under real test-day conditions`,
    ``,
    `🎯 Up to <b>${maxDiscount}% off</b> — ${plan.label} for just ${fmtUZS(plan.total)} UZS.`,
  ].join("\n");
  return { text, button: { text: "🔓 Renew Premium", url: appUrl("/upgrade") } };
}

// ── Detection + send ─────────────────────────────────────────────────────────
export type WinbackSummary = {
  dry: boolean;
  expired: number;
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
  premiumUntil: Date | null;
  winbackSentAt: Date | null;
};

/**
 * Find users whose Premium has expired and who haven't been notified for the
 * CURRENT expiry yet, then send the marketing email + Telegram DM.
 * `winbackSentAt` is stamped per user so a daily cron never double-sends; it
 * re-arms by itself on renewal (premiumUntil moves past winbackSentAt).
 * Pass { dry: true } to count + preview WITHOUT sending or stamping.
 */
export async function processWinback(
  prisma: PrismaClient,
  opts?: { dry?: boolean; limit?: number },
): Promise<WinbackSummary> {
  const dry = !!opts?.dry;
  const now = new Date();

  const candidates = (await prisma.user.findMany({
    where: { plan: "PREMIUM", premiumUntil: { not: null, lte: now } },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      emailNotifications: true,
      premiumUntil: true,
      winbackSentAt: true,
    },
    orderBy: { premiumUntil: "asc" },
  })) as Candidate[];

  const targets = candidates.filter(
    (u) =>
      !u.winbackSentAt ||
      (u.premiumUntil && u.winbackSentAt.getTime() < u.premiumUntil.getTime()),
  );
  const list = opts?.limit ? targets.slice(0, opts.limit) : targets;

  const s: WinbackSummary = {
    dry,
    expired: list.length,
    emailSent: 0,
    emailOptedOut: 0,
    emailFailed: 0,
    telegramSent: 0,
    telegramUnreachable: 0,
    telegramFailed: 0,
    marked: 0,
    sample: list.slice(0, 5).map((u) => u.email || u.id),
  };

  for (const u of list) {
    const canEmail = !!u.email && !isSyntheticEmail(u.email);
    const hasTelegram = !!u.telegramId;
    let attempted = false;
    let anySuccess = false;

    if (canEmail) {
      if (!u.emailNotifications) {
        s.emailOptedOut++;
      } else {
        attempted = true;
        if (dry) {
          s.emailSent++;
          anySuccess = true;
        } else {
          try {
            const { subject, html, text } = winbackEmail({ name: u.name });
            const ok = await sendMail({ to: u.email, subject, html, text });
            if (ok) {
              s.emailSent++;
              anySuccess = true;
            } else {
              s.emailFailed++;
            }
          } catch {
            s.emailFailed++;
          }
        }
      }
    }

    if (hasTelegram) {
      attempted = true;
      if (dry) {
        s.telegramSent++;
        anySuccess = true;
      } else {
        const { text, button } = winbackTelegram({ name: u.name });
        const r = await sendTelegramMessage(u.telegramId!, text, { button });
        if (r.ok) {
          s.telegramSent++;
          anySuccess = true;
        } else if (r.blocked) {
          s.telegramUnreachable++;
        } else {
          s.telegramFailed++;
        }
      }
    }

    const shouldMark = !attempted || anySuccess;
    if (!dry && shouldMark) {
      await prisma.user.update({ where: { id: u.id }, data: { winbackSentAt: now } });
      s.marked++;
    }
  }

  return s;
}
