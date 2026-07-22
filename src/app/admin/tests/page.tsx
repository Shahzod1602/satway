import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import TestsClient from "./TestsClient";

export const dynamic = "force-dynamic";

export default async function AdminTestsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  const tests = await prisma.test.findMany({
    orderBy: [{ published: "asc" }, { createdAt: "desc" }], // unpublished first — those need a decision
    select: {
      id: true,
      title: true,
      slug: true,
      skill: true,
      type: true,
      published: true,
      isPremium: true,
      level: true,
      createdAt: true,
      _count: { select: { sections: true, attempts: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Tests</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tests.length} test{tests.length === 1 ? "" : "s"} · {tests.filter((t) => t.published).length}{" "}
          published. Until now you had to know a test&apos;s id to reach its editor.
        </p>
        <TestsClient initialTests={JSON.parse(JSON.stringify(tests))} />
      </div>
    </div>
  );
}
