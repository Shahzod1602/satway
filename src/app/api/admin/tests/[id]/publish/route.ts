import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({
  published: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  level: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

/**
 * Flip a test's publish / premium flags.
 *
 * Separate from PUT /api/admin/tests/[id], which replaces the whole test body. Toggling
 * a switch on a list should not require round-tripping every section and question — and
 * a bug in that path would silently rewrite content.
 */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);
    const { id } = await ctx.params;
    const body = await parseJson(req, bodySchema);

    if (body.published === undefined && body.isPremium === undefined && body.level === undefined) {
      return jsonError("Nothing to change", 400);
    }

    const test = await prisma.test.update({
      where: { id },
      data: body,
      select: { id: true, published: true, isPremium: true, level: true, title: true },
    });

    return Response.json({ ok: true, test });
  },
);
