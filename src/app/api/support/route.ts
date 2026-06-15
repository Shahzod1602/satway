import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notifyAdminSupport } from "@/lib/telegram";

export const GET = withErrorHandling(async () => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const messages = await prisma.supportMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  await prisma.supportMessage.updateMany({
    where: { userId: user.id, fromAdmin: true, readByUser: false },
    data: { readByUser: true },
  });

  return Response.json({ messages });
});

const bodySchema = z.object({ body: z.string().trim().min(1, "Message is empty").max(2000) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const rl = rateLimit(`support:${user.id}:${clientIp(req)}`, 20, 10 * 60 * 1000); // 20/10min
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { body: text } = await parseJson(req, bodySchema);

  const message = await prisma.supportMessage.create({
    data: { userId: user.id, body: text, fromAdmin: false, readByUser: true },
  });

  notifyAdminSupport(user.name ?? user.email ?? "A user", text);

  return Response.json({ ok: true, message });
});
