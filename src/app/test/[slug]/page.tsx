import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ExamRunner from "@/components/exam/ExamRunner";
import type { ClientTest } from "@/lib/types";
import type { SatQuestionType } from "@/lib/grading";
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
  const initialModule = moduleRaw ? parseInt(moduleRaw, 10) : undefined;
  const user = await currentUser();
  if (!user) redirect("/login");

  const test = await prisma.test.findFirst({
    where: { slug, published: true },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!test) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (!canAccessTest(effectivePlan(dbUser?.plan, dbUser?.premiumUntil), test.slug)) {
    redirect("/upgrade");
  }

  const clientTest: ClientTest = {
    id: test.id,
    title: test.title,
    slug: test.slug,
    skill: test.skill as ClientTest["skill"],
    type: test.type as ClientTest["type"],
    durationSec: test.durationSec,
    sections: test.sections.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      instructions: s.instructions,
      passageText: s.passageText,
      imageUrl: s.imageUrl,
      formulaSheet: s.formulaSheet,
      questions: s.questions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type as SatQuestionType,
        groupTitle: q.groupTitle,
        prompt: q.prompt,
        options: (q.options as string[] | null) ?? null,
        meta: (q.meta as Record<string, unknown> | null) ?? null,
      })),
    })),
  };

  return (
    <ExamRunner
      test={clientTest}
      userName={user.name ?? ""}
      initialModule={Number.isFinite(initialModule) ? initialModule : undefined}
    />
  );
}
