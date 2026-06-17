import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import { ensureReferralCode } from "@/lib/referral";
import Sidebar from "@/components/Sidebar";
import ReferralCard from "@/components/ReferralCard";

export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [code, dbUser] = await Promise.all([
    ensureReferralCode(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true },
    }),
  ]);

  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-xl px-6 pt-6 pb-10">
          <h1 className="text-2xl font-bold text-slate-900">Invite friends</h1>
          <p className="mt-1 text-sm text-slate-500">
            Share your link — you get <strong>+1 week Premium</strong> when a friend you invite upgrades.
          </p>
          <div className="mt-6">
            <ReferralCard referralCode={code} />
          </div>
        </main>
      </div>
    </div>
  );
}
