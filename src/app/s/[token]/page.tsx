import { redirect } from "next/navigation";
import Link from "next/link";
import { Gift, LockKeyhole, GraduationCap } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Redeem a shared test link. FRIEND links seat up to maxUses distinct people;
// CLASS links are unlimited. A redeemer gets access to this ONE test only.
export default async function RedeemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      test: { select: { slug: true, title: true, skill: true } },
      createdBy: { select: { name: true } },
      _count: { select: { uses: true } },
    },
  });

  if (!link || !link.active) return <Shell><Invalid /></Shell>;

  const user = await currentUser();
  const firstName = (link.createdBy.name || "A SATway student").split(/\s+/)[0];
  const skillLabel = link.test.skill === "MATH" ? "Math" : "Reading & Writing";

  // Not signed in → invite them to create a free account (carries them back here).
  if (!user) {
    const next = encodeURIComponent(`/s/${token}`);
    return (
      <Shell>
        <Gift className="mx-auto h-12 w-12 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{firstName} shared a test with you</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{link.test.title}</span> · {skillLabel} — free to take.
          Create a free account (or sign in) to start.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/register?next=${next}`} className="rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">
            Create a free account &amp; take it
          </Link>
          <Link href={`/login?next=${next}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            I already have an account
          </Link>
        </div>
      </Shell>
    );
  }

  // The creator opening their own link → straight to the test.
  if (user.id === link.createdById) redirect(`/test/${link.test.slug}`);

  // Claim a seat (idempotent per user via the unique constraint; capped for FRIEND).
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.shareLinkUse.findUnique({
      where: { shareLinkId_userId: { shareLinkId: link.id, userId: user.id } },
      select: { id: true },
    });
    if (existing) return "ok" as const;
    if (link.maxUses != null) {
      const count = await tx.shareLinkUse.count({ where: { shareLinkId: link.id } });
      if (count >= link.maxUses) return "full" as const;
    }
    await tx.shareLinkUse.create({ data: { shareLinkId: link.id, userId: user.id } });
    return "ok" as const;
  });

  if (outcome === "ok") redirect(`/test/${link.test.slug}`);

  // FRIEND link is full.
  return (
    <Shell>
      <LockKeyhole className="mx-auto h-12 w-12 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">This link is full</h1>
      <p className="mt-2 text-sm text-slate-600">
        A shared test can be opened by up to {link.maxUses} people, and all seats are taken.
        Go Premium to unlock every test yourself.
      </p>
      <Link href="/upgrade" className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">
        See Premium
      </Link>
    </Shell>
  );
}

function Invalid() {
  return (
    <>
      <LockKeyhole className="mx-auto h-12 w-12 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Link not available</h1>
      <p className="mt-2 text-sm text-slate-600">This share link is invalid, expired, or has been turned off.</p>
      <Link href="/" className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">
        Go to SATway
      </Link>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <span className="mb-4 inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-slate-900">
          <GraduationCap className="h-5 w-5 text-brand-600" /> SAT<span className="rounded bg-brand-600 px-1 text-white">way</span>
        </span>
        {children}
      </div>
    </div>
  );
}
