import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { effectivePlan } from "@/lib/access";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { newLiveCode } from "@/lib/share";

const bodySchema = z.object({ testId: z.string().min(1).max(40) });

// Create a host-controlled live session (Premium only). Returns a join code.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (effectivePlan(dbUser?.plan, dbUser?.premiumUntil) !== "PREMIUM") {
    return jsonError("Hosting a live session is a Premium feature.", 403);
  }

  const rl = rateLimit(`live:${user.id}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { testId } = await parseJson(req, bodySchema);
  const test = await prisma.test.findFirst({ where: { id: testId, published: true }, select: { id: true } });
  if (!test) return jsonError("Test not found", 404);

  // Retry on the (rare) code collision.
  for (let i = 0; i < 5; i++) {
    try {
      const s = await prisma.liveSession.create({
        data: { code: newLiveCode(), testId: test.id, hostId: user.id, status: "LOBBY" },
        select: { code: true },
      });
      return Response.json({ code: s.code });
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  return jsonError("Could not create session", 500);
});
