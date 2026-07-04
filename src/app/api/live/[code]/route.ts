import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, withErrorHandling } from "@/lib/apiError";

function firstInitial(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return p[0] || "Student";
  return `${p[0]} ${p[p.length - 1][0].toUpperCase()}.`;
}

// Poll the live-session state (used by both the host console and the lobby).
export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
    const user = await currentUser();
    if (!user) return jsonError("Authorization required", 401);

    const { code } = await ctx.params;
    const session = await prisma.liveSession.findUnique({
      where: { code },
      include: {
        test: { select: { slug: true, title: true } },
        participants: { orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!session) return jsonError("Session not found", 404);

    return Response.json({
      code: session.code,
      status: session.status,
      testSlug: session.test.slug,
      testTitle: session.test.title,
      isHost: session.hostId === user.id,
      joined: session.participants.some((p) => p.userId === user.id),
      count: session.participants.length,
      participants: session.participants.map((p) => ({ name: firstInitial(p.user.name) })),
    });
  },
);
