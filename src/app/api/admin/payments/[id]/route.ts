import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { currentUser } from "@/lib/session";
import { grantPremiumMonths } from "@/lib/grantPremium";
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
      const r = await prisma.payment.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: admin.id },
      });
      if (r.count === 0) return jsonError("Payment has already been reviewed", 409);
      return Response.json({ ok: true, status: "REJECTED" });
    }

    // Approve: claim the payment atomically (status PENDING → APPROVED) so two
    // concurrent approvals can't both grant, then extend Premium via the SAME
    // grant code the Click webhook uses — one grant path, one set of bugs.
    const granted = await prisma.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: admin.id },
      });
      if (claim.count === 0) return null; // already reviewed / lost the race
      return { user: await grantPremiumMonths(tx, payment.userId, payment.months) };
    });

    if (granted === null) {
      return jsonError("Payment has already been reviewed", 409);
    }
    if (!granted.user) {
      return jsonError("The payer's account no longer exists", 409);
    }
    const premiumUntil = granted.user.premiumUntil;

    // Reward the referrer exactly once — only the approval that won the claim gets here.
    await rewardReferrerIfNeeded(payment.userId);

    return Response.json({ ok: true, status: "APPROVED", premiumUntil });
  },
);
