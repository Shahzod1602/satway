import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { jsonError, withErrorHandling } from "@/lib/apiError";

// List payments, optionally filtered by ?status=PENDING|APPROVED|REJECTED
export const GET = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam === "APPROVED" || statusParam === "REJECTED" || statusParam === "PENDING"
      ? statusParam
      : undefined;

  const payments = await prisma.payment.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, plan: true, premiumUntil: true } },
    },
  });

  return Response.json({ payments });
});
