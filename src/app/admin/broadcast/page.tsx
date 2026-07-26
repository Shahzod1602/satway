import { prisma } from "@/lib/prisma";
import BroadcastClient from "./BroadcastClient";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const history = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
      <p className="mt-1 text-sm text-slate-600">
        Message everyone at once. Until now the only way to reach a student was a 1:1
        support reply.
      </p>
      <BroadcastClient initialHistory={JSON.parse(JSON.stringify(history))} />
    </div>
  );
}
