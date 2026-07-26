import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { parseJson } from "@/lib/validation";

// Max length mirrors broadcast (src/app/api/admin/broadcast/route.ts) — an unbounded body
// let an admin write an arbitrarily large string into SupportMessage.body, which is silly
// for a chat message and a DoS vector for the row size.
const bodySchema = z.object({
  body: z.string().trim().min(1, "body is required").max(4000, "body is too long"),
});

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { userId } = await ctx.params;
    const messages = await prisma.supportMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(messages);
  },
);

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ userId: string }> }) => {
    if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

    const { userId } = await ctx.params;
    const { body } = await parseJson(req, bodySchema);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return jsonError("User not found", 404);

    const message = await prisma.supportMessage.create({
      data: {
        userId,
        body,
        fromAdmin: true,
        readByAdmin: true,
      },
    });

    return Response.json(message, { status: 201 });
  },
);
