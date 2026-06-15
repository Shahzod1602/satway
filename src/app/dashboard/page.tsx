import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import { effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab = (tabRaw ?? "").toUpperCase();

  const [tests, dbUser] = await Promise.all([
    prisma.test.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { sections: true } } },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, premiumUntil: true } }),
  ]);

  return (
    <DashboardClient
      user={JSON.parse(JSON.stringify(user))}
      tests={JSON.parse(JSON.stringify(tests))}
      plan={effectivePlan(dbUser?.plan, dbUser?.premiumUntil)}
      initialTab={initialTab}
    />
  );
}
