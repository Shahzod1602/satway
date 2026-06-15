import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import TestEditClient from "./TestEditClient";

export const dynamic = "force-dynamic";

export default async function AdminTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/dashboard");

  const { id } = await params;
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!test) redirect("/admin");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <TestEditClient test={JSON.parse(JSON.stringify(test))} />
    </div>
  );
}
