import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import { getPlan, fmtUZS } from "@/lib/plans";
import { polarConfigured } from "@/lib/polar";
import { clickConfigured } from "@/lib/click";
import { paymeConfigured } from "@/lib/payme";
import Sidebar from "@/components/Sidebar";
import PaymentForm from "@/components/PaymentForm";

export const dynamic = "force-dynamic";

export default async function UpgradePayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const planId = Array.isArray(sp.plan) ? sp.plan[0] : sp.plan;
  const plan = getPlan(planId);
  if (!plan) redirect("/upgrade");

  // A promo entered on the pricing page rides here in the url so it does not have to be
  // typed twice. It is a suggestion, nothing more: PaymentForm re-validates it, and the
  // amount actually charged is recomputed from the code server-side.
  const promoParam = Array.isArray(sp.promo) ? sp.promo[0] : sp.promo;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  const uiPlan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);
  // A Premium user reaching this deep-linked page (bookmark, Back after paying, a
  // win-back link) must not be shown a buyable form — /upgrade already guards this.
  if (uiPlan === "PREMIUM") redirect("/upgrade");

  const card = process.env.PAYMENT_CARD_NUMBER || "0000000000000000";
  const holder = process.env.PAYMENT_CARD_HOLDER || "—";
  const telegramUrl = process.env.PAYMENT_TELEGRAM || "https://t.me/satway_admin";

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar name={user.name} role={user.role} plan={uiPlan} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-lg px-6 pt-6 pb-10">
          <Link
            href="/upgrade"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Plans
          </Link>

          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Payment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Selected plan: <b className="text-slate-700">{plan.label}</b> —{" "}
            <b className="text-slate-700">{fmtUZS(plan.total)} UZS</b>
          </p>

          <PaymentForm
            planId={plan.id}
            planLabel={plan.label}
            amount={plan.total}
            amountUsd={plan.totalUsd}
            card={card}
            holder={holder}
            telegramUrl={telegramUrl}
            visaEnabled={polarConfigured()}
            clickEnabled={clickConfigured()}
            paymeEnabled={paymeConfigured()}
            initialPromo={promoParam ?? null}
          />
        </main>
      </div>
    </div>
  );
}
