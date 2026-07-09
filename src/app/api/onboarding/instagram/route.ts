import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { gateConfig, computeGateStatus } from "@/lib/onboarding";

// Instagram follows can't be verified through any official API, so this step is
// honor-system: the user opens the profile, follows, and confirms here. We just
// stamp the click. The gate's real lock is the (verified) Telegram step.
export const POST = withErrorHandling(async () => {
  const sessionUser = await currentUser();
  if (!sessionUser) return jsonError("Authorization required", 401);

  const cfg = gateConfig();
  if (!cfg.requireInstagram) return jsonError("Instagram step is not enabled", 400);

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { igFollowedAt: new Date() },
    select: { igFollowedAt: true, tgSubVerifiedAt: true },
  });

  return Response.json({ ok: true, status: computeGateStatus(cfg, updated) });
});
