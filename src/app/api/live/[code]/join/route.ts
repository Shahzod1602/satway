import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, withErrorHandling } from "@/lib/apiError";

// Join a live session's lobby (idempotent). Anyone signed-in may join; access to the
// test itself is granted only once the host starts it (status = LIVE).
export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
    const user = await currentUser();
    if (!user) return jsonError("Authorization required", 401);

    const { code } = await ctx.params;
    const session = await prisma.liveSession.findUnique({
      where: { code },
      select: { id: true, status: true, test: { select: { slug: true } } },
    });
    if (!session) return jsonError("Session not found", 404);
    if (session.status === "ENDED") return jsonError("This session has ended", 410);

    await prisma.liveParticipant.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
      create: { sessionId: session.id, userId: user.id },
      update: {},
    });

    return Response.json({ ok: true, testSlug: session.test.slug });
  },
);
