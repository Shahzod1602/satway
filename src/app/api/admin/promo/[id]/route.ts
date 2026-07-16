import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const patchSchema = z.object({
  active: z.boolean().optional(),
  percentOff: z.number().int().min(1).max(100).optional(),
  commissionPct: z.number().int().min(0).max(100).optional(),
  maxUses: z.number().int().min(1).max(100_000).nullable().optional(),
  note: z.string().trim().max(200).optional(),
});

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);
    const { id } = await ctx.params;
    const body = await parseJson(req, patchSchema);

    // Editing percentOff or commissionPct changes only FUTURE sales — every past Payment
    // carries its own snapshot of both. That is the whole point of those columns.
    const updated = await prisma.promoCode.update({ where: { id }, data: body });
    return Response.json({ ok: true, code: updated });
  },
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);
    const { id } = await ctx.params;

    const code = await prisma.promoCode.findUnique({ where: { id }, select: { code: true } });
    if (!code) return jsonError("Not found", 404);

    // Never hard-delete a code that has sold anything: the Payment rows snapshot the code
    // string, and the promo admin page joins on it to show what an owner is owed.
    // Deleting the row would not touch the money, but it would hide the debt.
    const sold = await prisma.payment.count({
      where: { promoCode: code.code, status: "APPROVED" },
    });
    if (sold > 0) {
      await prisma.promoCode.update({ where: { id }, data: { active: false } });
      return Response.json({
        ok: true,
        deactivated: true,
        message: `${code.code} has ${sold} paid sale(s), so it was deactivated rather than deleted — its commission history stays visible.`,
      });
    }

    await prisma.promoCode.delete({ where: { id } });
    return Response.json({ ok: true, deleted: true });
  },
);
