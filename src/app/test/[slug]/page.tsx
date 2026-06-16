import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ExamRunner from "@/components/exam/ExamRunner";
import type { ClientExamMeta } from "@/lib/types";
import { canAccessTest, effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const moduleRaw = Array.isArray(sp.module) ? sp.module[0] : sp.module;
  const parsedModule = moduleRaw ? parseInt(moduleRaw, 10) : NaN;
  const practiceModule =
    Number.isFinite(parsedModule) && parsedModule >= 1 && parsedModule <= 2
      ? parsedModule
      : undefined;

  const user = await currentUser();
  if (!user) redirect("/login");

  // Only metadata is loaded here; questions are fetched (and Module 2 is served
  // adaptively) via the attempts API so answers never reach the browser.
  const test = await prisma.test.findFirst({
    where: { slug, published: true },
    select: { id: true, title: true, slug: true, skill: true, type: true },
  });
  if (!test) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (!canAccessTest(effectivePlan(dbUser?.plan, dbUser?.premiumUntil), test.slug)) {
    redirect("/upgrade");
  }

  const meta: ClientExamMeta = {
    id: test.id,
    title: test.title,
    slug: test.slug,
    skill: test.skill as ClientExamMeta["skill"],
    type: test.type as ClientExamMeta["type"],
  };

  return (
    <ExamRunner
      test={meta}
      userName={user.name ?? ""}
      mode={practiceModule ? "module" : "full"}
      practiceModule={practiceModule}
    />
  );
}
