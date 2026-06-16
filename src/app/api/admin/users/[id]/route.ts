import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { nextPremiumUntil } from "@/lib/premium";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({
  action: z.enum(["grant", "revoke"]),
  // months to grant/extend; omit for a lifetime (non-expiring) grant.
  months: z.number().int().min(1).max(120).optional(),
});

// Manually grant or revoke a user's Premium. Granting with `months` extends
// from any existing active expiry; omitting `months` grants lifetime Premium.
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { id } = await ctx.params;
    const { action, months } = await parseJson(req, bodySchema);

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, premiumUntil: true },
    });
    if (!user) return jsonError("User not found", 404);

    if (action === "revoke") {
      const updated = await prisma.user.update({
        where: { id },
        data: { plan: "FREE", premiumUntil: null },
        select: { id: true, plan: true, premiumUntil: true },
      });
      return Response.json({ ok: true, user: updated });
    }

    // grant
    const premiumUntil = months ? nextPremiumUntil(user.premiumUntil, months) : null;
    const updated = await prisma.user.update({
      where: { id },
      data: { plan: "PREMIUM", premiumUntil },
      select: { id: true, plan: true, premiumUntil: true },
    });
    return Response.json({ ok: true, user: updated });
  },
);
