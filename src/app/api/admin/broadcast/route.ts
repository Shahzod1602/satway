import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { AUDIENCES, audienceWhere, type Audience } from "@/lib/broadcastAudience";
import {
  CHANNELS,
  deliverBroadcast,
  emailEligible,
  telegramEligible,
  type BroadcastChannel,
} from "@/lib/broadcastDeliver";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  body: z.string().trim().min(1, "Message is empty").max(4000),
  audience: z.enum(AUDIENCES),
  channels: z.array(z.enum(CHANNELS)).min(1, "Pick at least one channel"),
  userIds: z.array(z.string().max(40)).max(500).optional(),
  /** Count the audience and return WITHOUT sending. The UI calls this first. */
  dry: z.boolean().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);
  const admin = await currentUser();

  const { body, audience, channels, userIds, dry } = await parseJson(req, bodySchema);

  if (audience === "USERS" && !userIds?.length) {
    return jsonError("Pick at least one person for a targeted announcement.", 400);
  }

  const recipients = await prisma.user.findMany({
    where: audienceWhere(audience as Audience, userIds ?? []),
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      emailNotifications: true,
    },
  });

  if (dry) {
    // Show the admin what each channel will ACTUALLY reach before they commit. The three
    // numbers differ a lot — most accounts have no Telegram, and opted-out students get
    // no email — and "sent to 400 people" is a lie if only 60 can receive it.
    return Response.json({
      dry: true,
      recipients: recipients.length,
      reach: {
        inapp: recipients.length, // everyone; they see it next time they open the site
        telegram: recipients.filter(telegramEligible).length,
        email: recipients.filter(emailEligible).length,
      },
    });
  }

  if (recipients.length === 0) return jsonError("That audience is empty.", 400);

  const record = await prisma.broadcast.create({
    data: {
      body,
      audience,
      channels: channels.join(","),
      createdBy: admin?.id ?? null,
      recipients: recipients.length,
    },
  });

  // ── In-app: synchronous. One createMany, instant, and it cannot half-fail. ──
  let inappSent = 0;
  if (channels.includes("inapp")) {
    const res = await prisma.supportMessage.createMany({
      data: recipients.map((r) => ({ userId: r.id, body, fromAdmin: true, readByAdmin: true })),
    });
    inappSent = res.count;
    await prisma.broadcast.update({ where: { id: record.id }, data: { inappSent } });
  }

  // ── Telegram + email: background. ──
  // A 400-recipient email run is ~80 seconds of deliberate throttling, which no request
  // should wait for. This is a long-running Node server (output: standalone), so the
  // promise survives the response — this is NOT serverless, where it would be killed.
  const slowChannels = channels.filter((c) => c !== "inapp") as BroadcastChannel[];
  if (slowChannels.length > 0) {
    void deliverBroadcast(recipients, body, slowChannels)
      .then((r) =>
        prisma.broadcast.update({
          where: { id: record.id },
          data: {
            telegramSent: r.telegram.sent,
            telegramFailed: r.telegram.failed,
            emailSent: r.email.sent,
            emailFailed: r.email.failed,
            deliveredAt: new Date(),
          },
        }),
      )
      .catch((e) => console.error("[broadcast] background delivery failed:", e));
  } else {
    await prisma.broadcast.update({
      where: { id: record.id },
      data: { deliveredAt: new Date() },
    });
  }

  return Response.json({
    ok: true,
    id: record.id,
    recipients: recipients.length,
    inappSent,
    background: slowChannels.length > 0,
  });
});

/** The history feed. */
export const GET = withErrorHandling(async () => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);
  const rows = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({ broadcasts: rows });
});
