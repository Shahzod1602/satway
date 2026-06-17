import { redirect } from "next/navigation";
import { Trophy, Medal } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

type Entry = { userId: string; name: string; rw: number; math: number; total: number };

export default async function LeaderboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [attempts, dbUser] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { status: "SUBMITTED", module: null, scaledScore: { not: null } },
      select: { userId: true, scaledScore: true, user: { select: { name: true } }, test: { select: { skill: true } } },
      orderBy: { submittedAt: "desc" },
      take: 8000,
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, premiumUntil: true } }),
  ]);

  // Best section score per user → estimated total (R&W best + Math best).
  const map = new Map<string, Entry>();
  for (const a of attempts) {
    const e = map.get(a.userId) ?? { userId: a.userId, name: a.user.name, rw: 0, math: 0, total: 0 };
    const s = a.scaledScore ?? 0;
    if (a.test.skill === "MATH") e.math = Math.max(e.math, s);
    else e.rw = Math.max(e.rw, s);
    map.set(a.userId, e);
  }
  const ranked = Array.from(map.values())
    .map((e) => ({ ...e, total: e.rw + e.math }))
    .sort((a, b) => b.total - a.total);

  const top = ranked.slice(0, 25);
  const myIndex = ranked.findIndex((e) => e.userId === user.id);
  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);

  const medal = (i: number) =>
    i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "";

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-3xl px-6 pt-6 pb-10">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Leaderboard</h1>
              <p className="text-sm text-slate-500">Ranked by best total (Reading &amp; Writing + Math).</p>
            </div>
          </div>

          {top.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center text-sm text-slate-400">
              No full-test scores yet. Be the first on the board!
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 w-14">#</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 text-right">R&amp;W</th>
                    <th className="px-4 py-3 text-right">Math</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {top.map((e, i) => {
                    const me = e.userId === user.id;
                    return (
                      <tr key={e.userId} className={me ? "bg-brand-50/60" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 font-bold ${medal(i)}`}>
                            {i < 3 ? <Medal className="h-4 w-4" /> : null}{i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {e.name}{me && <span className="ml-2 text-xs font-normal text-brand-600">you</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{e.rw || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{e.math || "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-brand-600">{e.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {myIndex >= 25 && (
            <p className="mt-4 text-center text-sm text-slate-500">
              Your rank: <strong className="text-slate-900">#{myIndex + 1}</strong> · Total{" "}
              <strong className="text-brand-600">{ranked[myIndex].total}</strong>
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
