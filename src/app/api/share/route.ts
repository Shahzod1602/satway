import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { effectivePlan } from "@/lib/access";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { FRIEND_CAP, newShareToken } from "@/lib/share";
import { blocked } from "@/lib/events";
import { BLOCK_REASONS } from "@/lib/surfaces";

const bodySchema = z.object({
  testId: z.string().min(1).max(40),
  kind: z.enum(["FRIEND", "CLASS"]).default("FRIEND"),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  // Only Premium users can share a premium test with others.
  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);
  if (plan !== "PREMIUM") {
    blocked("group", { userId: user.id, plan, reason: BLOCK_REASONS.PREMIUM_REQUIRED });
    return jsonError("Sharing tests is a Premium feature.", 403);
  }

  const rl = rateLimit(`share:${user.id}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { testId, kind } = await parseJson(req, bodySchema);

  const test = await prisma.test.findFirst({
    where: { id: testId, published: true },
    select: { id: true, title: true, slug: true },
  });
  if (!test) return jsonError("Test not found", 404);

  const link = await prisma.shareLink.create({
    data: {
      token: newShareToken(),
      testId: test.id,
      createdById: user.id,
      kind,
      maxUses: kind === "FRIEND" ? FRIEND_CAP : null,
    },
    select: { id: true, token: true, kind: true, maxUses: true, active: true, createdAt: true },
  });

  return Response.json({ link: { ...link, test } });
});
