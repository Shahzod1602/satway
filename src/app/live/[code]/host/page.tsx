import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import HostClient from "./HostClient";

export const dynamic = "force-dynamic";

export default async function LiveHostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const user = await currentUser();
  if (!user) redirect(`/login?next=/live/${code}/host`);

  const session = await prisma.liveSession.findUnique({
    where: { code },
    select: { hostId: true, status: true, test: { select: { title: true } } },
  });
  if (!session) notFound();
  // Non-hosts are participants → send them to the lobby.
  if (session.hostId !== user.id) redirect(`/live/${code}`);

  return <HostClient code={code} testTitle={session.test.title} initialStatus={session.status} />;
}
