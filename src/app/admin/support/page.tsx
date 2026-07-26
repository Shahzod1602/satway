import { prisma } from "@/lib/prisma";
import AdminSupportClient from "./AdminSupportClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const supportUsers = await prisma.user.findMany({
    where: {
      supportMessages: { some: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { supportMessages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AdminSupportClient users={JSON.parse(JSON.stringify(supportUsers))} />
  );
}
