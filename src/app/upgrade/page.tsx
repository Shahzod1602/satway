import { redirect } from "next/navigation";
import Link from "next/link";
import { Crown } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import PricingSelector from "@/components/PricingSelector";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });

  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);
  const isPremium = plan === "PREMIUM";

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar name={user.name} role={user.role} plan={plan} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-lg px-6 pt-6 pb-10">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-50 text-accent-600">
              <Crown className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              {isPremium ? "Your Premium" : "Upgrade to Premium"}
            </h1>
            {isPremium && dbUser?.premiumUntil ? (
              <p className="mt-2 text-sm text-emerald-600 font-medium">
                Active until{" "}
                {new Date(dbUser.premiumUntil).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                — everything is unlocked. 🎉
              </p>
            ) : (
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Unlock every adaptive SAT mock test, the full review &amp; mistake bank, and the AI tutor.
              </p>
            )}
          </div>

          {isPremium ? (
            <Link
              href="/dashboard"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Back to dashboard
            </Link>
          ) : (
            <div className="mt-7">
              <PricingSelector />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
