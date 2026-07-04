import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, withErrorHandling } from "@/lib/apiError";

// Revoke a share link (soft: active=false). Existing grants stop working because
// hasShareGrant() only counts active links. Only the creator can revoke.
export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await currentUser();
    if (!user) return jsonError("Authorization required", 401);

    const { id } = await ctx.params;
    const result = await prisma.shareLink.updateMany({
      where: { id, createdById: user.id },
      data: { active: false },
    });
    if (result.count === 0) return jsonError("Link not found", 404);

    return Response.json({ ok: true });
  },
);
