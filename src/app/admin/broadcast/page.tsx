import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import BroadcastClient from "./BroadcastClient";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  const history = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="mt-1 text-sm text-slate-600">
          Message everyone at once. Until now the only way to reach a student was a 1:1
          support reply.
        </p>
        <BroadcastClient initialHistory={JSON.parse(JSON.stringify(history))} />
      </div>
    </div>
  );
}
