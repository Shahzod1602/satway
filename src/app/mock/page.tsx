import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import MockRunner from "@/components/exam/MockRunner";
import type { ClientTest } from "@/lib/types";
import type { SatQuestionType } from "@/lib/grading";
import { canAccessMock, effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

type FetchedTest = NonNullable<Awaited<ReturnType<typeof loadTest>>>;

async function loadTest(slug: string | undefined) {
  if (!slug) return null;
  return prisma.test.findFirst({
    where: { slug, published: true },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });
}

function toClientTest(test: FetchedTest): ClientTest {
  return {
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
}

export default async function MockPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (!canAccessMock(effectivePlan(dbUser?.plan, dbUser?.premiumUntil))) {
    redirect("/upgrade");
  }

  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [readingWriting, math] = await Promise.all([
    loadTest(pick(sp.rw)),
    loadTest(pick(sp.m)),
  ]);

  if (
    !readingWriting || readingWriting.skill !== "READING_WRITING" ||
    !math || math.skill !== "MATH"
  ) {
    redirect("/dashboard");
  }

  const tests = [toClientTest(readingWriting), toClientTest(math)];

  return <MockRunner tests={tests} userName={user.name ?? ""} />;
}
