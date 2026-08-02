import { redirect } from "next/navigation";
import Link from "next/link";
import { Radio, GraduationCap, LockKeyhole } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import LobbyClient from "./LobbyClient";

export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const session = await prisma.liveSession.findUnique({
    where: { code },
    select: { hostId: true, status: true, test: { select: { slug: true, title: true } }, host: { select: { name: true } } },
  });
  if (!session) return <Shell><Missing /></Shell>;

  const user = await currentUser();
  const hostName = (session.host.name || "Your teacher").split(/\s+/)[0];

  if (!user) {
    const next = encodeURIComponent(`/live/${code}`);
    return (
      <Shell>
        <Radio className="mx-auto h-12 w-12 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{hostName} invited you to a live test</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{session.test.title}</span> — sign in to join the room.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/register?next=${next}`} className="rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">Create a free account &amp; join</Link>
          <Link href={`/login?next=${next}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">I already have an account</Link>
        </div>
      </Shell>
    );
  }

  if (user.id === session.hostId) redirect(`/live/${code}/host`);
  if (session.status === "ENDED") return <Shell><Ended /></Shell>;

  return <LobbyClient code={code} testTitle={session.test.title} initialStatus={session.status} />;
}

function Missing() {
  return (
    <>
      <LockKeyhole className="mx-auto h-12 w-12 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Session not found</h1>
      <p className="mt-2 text-sm text-slate-600">This live session code is invalid or has ended.</p>
      <Link href="/" className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">Go to SATway</Link>
    </>
  );
}
function Ended() {
  return (
    <>
      <LockKeyhole className="mx-auto h-12 w-12 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">This session has ended</h1>
      <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">Go to dashboard</Link>
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
