import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { currentUser } from "@/lib/session";
import { nextPremiumUntil } from "@/lib/premium";
import { rewardReferrerIfNeeded } from "@/lib/referral";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({ action: z.enum(["approve", "reject"]) });

// Approve or reject a pending payment. Approving grants/extends Premium.
export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await currentUser();
    if (!admin || !(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { id } = await ctx.params;
    const { action } = await parseJson(req, bodySchema);

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return jsonError("Payment not found", 404);
    if (payment.status !== "PENDING") {
      return jsonError("Payment has already been reviewed", 409);
    }

    if (action === "reject") {
      await prisma.payment.update({
        where: { id },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: admin.id },
      });
      return Response.json({ ok: true, status: "REJECTED" });
    }

    // Approve: grant premium in a transaction so the two writes stay consistent.
    const user = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: { premiumUntil: true },
    });
    if (!user) return jsonError("User not found", 404);

    const premiumUntil = nextPremiumUntil(user.premiumUntil, payment.months);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: payment.userId },
        data: { plan: "PREMIUM", premiumUntil },
      }),
      prisma.payment.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: admin.id },
      }),
    ]);

    // If this buyer was referred, grant the referrer their +1 week reward.
    await rewardReferrerIfNeeded(payment.userId);

    return Response.json({ ok: true, status: "APPROVED", premiumUntil });
  },
);
