import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { parseJson } from "@/lib/validation";
import { SAT_SKILLS, TEST_TYPES } from "@/lib/testEnums";
import { TEST_LEVELS } from "@/lib/level";

// Every updatable field is optional. Unlike the old hand-rolled version, invalid enum
// values now REJECT (400) instead of being silently dropped — `PUT { skill: "SCIENCE" }`
// used to return 200 OK with the test unchanged, which is worse than an error because the
// admin UI got a success response for a no-op. POST already rejected these; PUT now matches.
const updateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    skill: z.enum(SAT_SKILLS).optional(),
    type: z.enum(TEST_TYPES).optional(),
    description: z.string().optional(),
    durationSec: z.number().int().positive().optional(),
    published: z.boolean().optional(),
    isPremium: z.boolean().optional(),
    level: z.enum(TEST_LEVELS).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "No updatable fields supplied",
  });

export const PUT = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { id } = await ctx.params;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) return jsonError("Test not found", 404);

    const b = await parseJson(req, updateSchema);

    // Slug uniqueness when it changes — TOCTOU window exists but the DB unique constraint
    // is the real guard; this check turns the common case into a clean 409 instead of a
    // raw Prisma error leaking through.
    if (b.slug && b.slug !== test.slug) {
      const clash = await prisma.test.findUnique({ where: { slug: b.slug } });
      if (clash) return jsonError("Slug already in use", 409);
    }

    const updated = await prisma.test.update({ where: { id }, data: b });

    return Response.json({ id: updated.id, title: updated.title, slug: updated.slug });
  },
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { id } = await ctx.params;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) return jsonError("Test not found", 404);

    await prisma.test.delete({ where: { id } });

    return Response.json({ deleted: true });
  },
);
