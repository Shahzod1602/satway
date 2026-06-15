import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { notifyAdminPayment } from "@/lib/telegram";
import { getPlan } from "@/lib/plans";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({
  planId: z.enum(["1m", "3m", "6m"]),
  note: z.string().trim().max(500).optional(),
});

// Records a Premium payment as PENDING. Does NOT grant Premium — an admin
// must verify the transfer and approve it (see /api/admin/payments/[id]).
export const POST = withErrorHandling(async (req: NextRequest) => {
  const sessionUser = await currentUser();
  if (!sessionUser) return jsonError("Authorization required", 401);

  const { planId, note } = await parseJson(req, bodySchema);
  const plan = getPlan(planId);
  if (!plan) return jsonError("Unknown plan", 400);

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true },
  });
  if (!user) return jsonError("User not found", 404);

  // Avoid stacking duplicate pending requests.
  const existingPending = await prisma.payment.findFirst({
    where: { userId: sessionUser.id, status: "PENDING" },
  });
  if (existingPending) {
    return Response.json({ ok: true, status: "PENDING", pending: true });
  }

  // Amount and duration are derived server-side from the plan, never trusted
  // from the client.
  await prisma.payment.create({
    data: {
      userId: sessionUser.id,
      planLabel: plan.id,
      months: plan.months,
      amount: plan.total,
      note,
      status: "PENDING",
    },
  });

  notifyAdminPayment(user.name, plan.label, plan.total);

  return Response.json({ ok: true, status: "PENDING" });
});
