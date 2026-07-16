import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    // No spaces or punctuation: the code gets typed by hand off a poster or a Telegram
    // message, and "SAT WAY-20" vs "SATWAY-20" is a support ticket.
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  percentOff: z.number().int().min(1).max(100),
  ownerEmail: z.string().trim().email().optional().or(z.literal("")),
  commissionPct: z.number().int().min(0).max(100).optional(),
  maxUses: z.number().int().min(1).max(100_000).optional(),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
  note: z.string().trim().max(200).optional(),
});

export const GET = withErrorHandling(async () => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  // What each code has actually SOLD, and what its owner is owed. Read from the Payment
  // snapshots rather than joining live, so an edited code cannot rewrite the numbers.
  const sales = await prisma.payment.groupBy({
    by: ["promoCode"],
    where: { status: "APPROVED", promoCode: { not: null } },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const salesByCode = new Map(sales.map((s) => [s.promoCode, s]));

  const owed = await prisma.payment.findMany({
    where: { status: "APPROVED", promoOwnerId: { not: null } },
    select: { promoCode: true, amount: true, commissionPct: true },
  });
  const owedByCode = new Map<string, number>();
  for (const p of owed) {
    if (!p.promoCode) continue;
    owedByCode.set(
      p.promoCode,
      (owedByCode.get(p.promoCode) ?? 0) + Math.round(p.amount * (p.commissionPct / 100)),
    );
  }

  return Response.json({
    codes: codes.map((c) => ({
      ...c,
      soldCount: salesByCode.get(c.code)?._count._all ?? 0,
      soldAmount: salesByCode.get(c.code)?._sum.amount ?? 0,
      commissionOwed: owedByCode.get(c.code) ?? 0,
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const b = await parseJson(req, createSchema);
  const code = b.code.toUpperCase();

  let ownerId: string | null = null;
  if (b.ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: b.ownerEmail.toLowerCase() },
      select: { id: true },
    });
    // Fail rather than silently creating an unowned code: an owner typo would otherwise
    // produce a code that sells for months and pays nobody, and nothing would look wrong.
    if (!owner) return jsonError(`No account with the email ${b.ownerEmail}`, 400);
    ownerId = owner.id;
  }

  if (!ownerId && b.commissionPct) {
    return jsonError("A commission needs an owner to pay it to.", 400);
  }

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) return jsonError(`The code ${code} already exists.`, 409);

  const created = await prisma.promoCode.create({
    data: {
      code,
      percentOff: b.percentOff,
      ownerId,
      commissionPct: b.commissionPct ?? 0,
      maxUses: b.maxUses ?? null,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      note: b.note,
    },
  });

  return Response.json({ ok: true, code: created });
});
