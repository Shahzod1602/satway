import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  // Stored as integer cents. Money does not round-trip through binary fractions, and
  // this number is the one the whole cost board is reconciled against.
  actualUsd: z.number().min(0).max(1_000_000),
  note: z.string().max(500).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const { month, actualUsd, note } = await parseJson(req, bodySchema);
  const actualUsdCents = Math.round(actualUsd * 100);

  const row = await prisma.aiBillMonth.upsert({
    where: { month },
    create: { month, actualUsdCents, note },
    update: { actualUsdCents, note },
  });

  return Response.json({ ok: true, month: row.month, actualUsdCents: row.actualUsdCents });
});
