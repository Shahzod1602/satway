import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import { VOCAB_DECKS } from "@/lib/vocabulary";
import Sidebar from "@/components/Sidebar";
import VocabularyClient from "./VocabularyClient";

export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-3xl px-6 pt-6 pb-10">
          <VocabularyClient decks={VOCAB_DECKS} />
        </main>
      </div>
    </div>
  );
}
