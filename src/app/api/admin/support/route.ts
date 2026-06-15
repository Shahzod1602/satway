import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

export async function GET() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { supportMessages: { some: {} } },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { supportMessages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(users);
}
