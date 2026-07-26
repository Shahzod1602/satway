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

/** List reconciled invoices (newest first) with the rate-card estimate alongside.
 *
 * The board previously only ever showed the single latest row from `getGlance()`'s bill
 * subquery — there was no way to see the drift trend across months. This returns the last
 * N months so the board can render a small history table next to the BillForm. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const limit = Math.min(48, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 12));
  const rows = await prisma.$queryRawUnsafe<
    { month: string; cents: number; est: bigint }[]
  >(`
    SELECT b.month,
           b."actualUsdCents" AS cents,
           COALESCE((SELECT SUM(e."usdMicros") FROM "Event" e
                      WHERE e.name = 'ai_call'
                        AND to_char(e.ts, 'YYYY-MM') = b.month), 0) AS est
      FROM "AiBillMonth" b
     ORDER BY b.month DESC
     LIMIT ${limit}
  `);
  const items = rows.map((r) => ({
    month: r.month,
    actualUsd: Number(r.cents ?? 0) / 100,
    estimatedUsd: Number(r.est ?? 0) / 1e6,
  }));
  return Response.json({ ok: true, items });
});
