import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, withErrorHandling } from "@/lib/apiError";

// Host starts the session → everyone in the lobby is released into the test together.
export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
    const user = await currentUser();
    if (!user) return jsonError("Authorization required", 401);

    const { code } = await ctx.params;
    const session = await prisma.liveSession.findUnique({
      where: { code },
      select: { id: true, hostId: true, status: true },
    });
    if (!session) return jsonError("Session not found", 404);
    if (session.hostId !== user.id) return jsonError("Only the host can start", 403);
    if (session.status !== "LOBBY") return jsonError("Session already started or ended", 409);

    // Guard on status so a double-click can't re-stamp startedAt.
    await prisma.liveSession.updateMany({
      where: { id: session.id, status: "LOBBY" },
      data: { status: "LIVE", startedAt: new Date() },
    });

    return Response.json({ ok: true });
  },
);
