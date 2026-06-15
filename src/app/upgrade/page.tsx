import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import { getPlan } from "@/lib/plans";
import PricingSelector from "@/components/PricingSelector";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [dbUser, referralCode] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true },
    }),
    (async () => {
      const { ensureReferralCode } = await import("@/lib/referral");
      return ensureReferralCode(user.id);
    })(),
  ]);

  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />
      <div className="min-w-0 flex-1">
        <main className="px-6 pt-6 pb-10 max-w-3xl">
          <h1 className="text-2xl font-bold text-slate-900">
            {plan === "PREMIUM" ? "Your Premium" : "Upgrade to Premium"}
          </h1>
          {plan === "PREMIUM" && dbUser?.premiumUntil && (
            <p className="mt-1 text-sm text-slate-500">
              Active until{" "}
              {new Date(dbUser.premiumUntil).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          <PricingSelector currentPlan={plan} referralCode={referralCode} />
        </main>
      </div>
    </div>
  );
}
