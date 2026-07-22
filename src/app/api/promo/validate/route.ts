import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { getPlan } from "@/lib/plans";
import { resolvePromo, PROMO_ERROR_MESSAGE } from "@/lib/checkout";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  planId: z.enum(["1m", "2m", "3m"]),
});

/**
 * Check a promo code and show what it would cost.
 *
 * Rate-limited hard: without a limit this endpoint is a free oracle for brute-forcing
 * codes, and a working 100%-off code found by a script is Premium given away forever.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const rl = rateLimit(`promo:${user.id}`, 10, 10 * 60 * 1000); // 10 tries / 10 min
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { code, planId } = await parseJson(req, bodySchema);
  const plan = getPlan(planId);
  if (!plan) return jsonError("Unknown plan", 400);

  const r = await resolvePromo(code, user.id);
  if (!r.ok) {
    // 200, not 4xx: "your code is expired" is a normal checkout answer, not a failure of
    // the request. The UI shows the reason inline rather than an error toast.
    return Response.json({ valid: false, reason: PROMO_ERROR_MESSAGE[r.error] });
  }

  const amount = Math.round(plan.total * (1 - r.promo.percentOff / 100));
  return Response.json({
    valid: true,
    code: r.promo.code,
    percentOff: r.promo.percentOff,
    baseAmount: plan.total,
    amount,
    saved: plan.total - amount,
  });
});
