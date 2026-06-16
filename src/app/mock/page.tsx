import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import MockRunner from "@/components/exam/MockRunner";
import type { ClientExamMeta } from "@/lib/types";
import { canAccessMock, effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

async function loadMeta(slug: string | undefined): Promise<ClientExamMeta | null> {
  if (!slug) return null;
  const test = await prisma.test.findFirst({
    where: { slug, published: true },
    select: { id: true, title: true, slug: true, skill: true, type: true },
  });
  if (!test) return null;
  return {
    id: test.id,
    title: test.title,
    slug: test.slug,
    skill: test.skill as ClientExamMeta["skill"],
    type: test.type as ClientExamMeta["type"],
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
    loadMeta(pick(sp.rw)),
    loadMeta(pick(sp.m)),
  ]);

  if (
    !readingWriting || readingWriting.skill !== "READING_WRITING" ||
    !math || math.skill !== "MATH"
  ) {
    redirect("/dashboard");
  }

  return <MockRunner tests={[readingWriting, math]} userName={user.name ?? ""} />;
}
