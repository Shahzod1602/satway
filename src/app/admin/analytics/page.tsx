import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import AppHeader from "@/components/AppHeader";
import {
  getGlance,
  getRetention,
  getFunnel,
  getSectionBoard,
  getSpend,
  getWhales,
  getSuspectQuestions,
  eventSinkReady,
} from "@/lib/analytics";
import SpendChart from "./SpendChart";
import BillForm from "./BillForm";

export const dynamic = "force-dynamic";

const usd = (v: number) => (v === 0 ? "$0" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
const pct = (v: number) => `${v.toFixed(0)}%`;

function Tile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "bad" | "good";
}) {
  const toneCls =
    tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  const [glance, retention, funnel, board, spend, whales, suspects, sinkReady] = await Promise.all([
    getGlance(),
    getRetention(),
    getFunnel(),
    getSectionBoard(),
    getSpend(30),
    getWhales(20),
    getSuspectQuestions(15),
    eventSinkReady(),
  ]);

  const budgetPct =
    glance.budgetUsd > 0 ? (glance.spendMonthUsd / glance.budgetUsd) * 100 : 0;
  const drift =
    glance.invoiceUsd && glance.invoiceEstimatedUsd > 0
      ? ((glance.invoiceUsd - glance.invoiceEstimatedUsd) / glance.invoiceEstimatedUsd) * 100
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Usage reads retroactively from existing rows via the <code>analytics_activity</code>{" "}
          view. Cost starts from the day the ledger shipped.
        </p>

        {!sinkReady && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>No events recorded yet.</strong> Usage figures below still work (they come
            from the view), but every cost figure will read $0 until the first AI call lands.
            If this persists after real traffic, the Event table is not being written — check
            the container logs for <code>[events] sink UNAVAILABLE</code>.
          </div>
        )}

        {/* ── The headline. Deliberately first: nothing downstream of "they never come
             back" matters, and this is the number most likely to be ignored. ── */}
        <h2 className="mt-8 text-lg font-semibold text-slate-900">Retention (90-day cohort)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label="One and done"
            value={retention.cohortUsers ? pct(retention.oneAndDonePct) : "—"}
            sub={`${retention.oneAndDone} of ${retention.cohortUsers} signups active on exactly one day`}
            tone={retention.oneAndDonePct > 60 ? "bad" : "default"}
          />
          <Tile label="Signups" value={String(retention.cohortUsers)} />
          <Tile
            label="Returned after day 1"
            value={String(retention.returnedDay1)}
            sub={retention.cohortUsers ? pct((retention.returnedDay1 / retention.cohortUsers) * 100) : undefined}
          />
          <Tile
            label="Still back after day 7"
            value={String(retention.returnedDay7)}
            sub={retention.cohortUsers ? pct((retention.returnedDay7 / retention.cohortUsers) * 100) : undefined}
          />
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">Glance</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="DAU" value={String(glance.dau)} />
          <Tile label="WAU" value={String(glance.wau)} />
          <Tile label="MAU" value={String(glance.mau)} />
          <Tile label="New (7d)" value={String(glance.newUsers7d)} />
          <Tile label="AI spend today" value={usd(glance.spendTodayUsd)} />
          <Tile
            label="AI spend this month"
            value={usd(glance.spendMonthUsd)}
            sub={
              glance.budgetUsd > 0
                ? `${pct(budgetPct)} of $${glance.budgetUsd} budget`
                : "AI_MONTHLY_BUDGET_USD not set"
            }
            tone={budgetPct > 80 ? "bad" : "default"}
          />
          <Tile label="Last month" value={usd(glance.spendPrevMonthUsd)} />
          <Tile
            label="Failed AI calls (7d)"
            value={String(glance.aiErrors7d)}
            tone={glance.aiErrors7d > 0 ? "bad" : "good"}
          />
        </div>

        {/* The rate card is a model, not accounting. Print the drift or the board is a guess. */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          {glance.invoiceUsd !== null ? (
            <p className="text-slate-700">
              <strong>{glance.invoiceMonth}</strong> — we estimated{" "}
              {usd(glance.invoiceEstimatedUsd)}, the real Google invoice was{" "}
              {usd(glance.invoiceUsd)}
              {drift !== null && (
                <>
                  {" "}
                  ·{" "}
                  <span className={Math.abs(drift) > 15 ? "font-semibold text-rose-600" : "text-slate-700"}>
                    drift {drift > 0 ? "+" : ""}
                    {drift.toFixed(0)}%
                  </span>
                </>
              )}
              . {Math.abs(drift ?? 0) > 15 && "Correct the rate card via AI_RATES_JSON and re-price."}
            </p>
          ) : (
            <p className="text-slate-500">
              No real invoice entered yet — every cost figure on this page is the rate card&apos;s
              estimate, not accounting.
            </p>
          )}
          <BillForm />
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">Funnel (30d)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="Signed up" value={String(funnel.signups)} />
          <Tile label="Took a test" value={String(funnel.tookATest)} />
          <Tile label="Hit a paywall" value={String(funnel.hitAPaywall)} />
          <Tile label="Started checkout" value={String(funnel.startedCheckout)} />
          <Tile
            label="Paid"
            value={String(funnel.paid)}
            sub={
              funnel.startedCheckout > 0
                ? `${pct((funnel.paid / funnel.startedCheckout) * 100)} of checkouts approved`
                : undefined
            }
            tone={
              funnel.startedCheckout > 0 && funnel.paid / funnel.startedCheckout < 0.6
                ? "bad"
                : "default"
            }
          />
        </div>
        {funnel.startedCheckout > funnel.paid && (
          <p className="mt-2 text-xs text-slate-600">
            {funnel.startedCheckout - funnel.paid} student(s) said they paid but were never
            approved. Every one is a manual-approval loss — the cost of not having an
            automated provider.
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold text-slate-900">Sections (30d)</h2>
        <p className="mt-1 text-xs text-slate-600">
          <strong>Blocked</strong> is the only unbiased demand signal — usage is biased by the
          paywall, so what people want most can read as what they use least. A dash in
          &ldquo;Measured&rdquo; means the section writes no durable row: its numbers are floors,
          not evidence it is unwanted.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Section</th>
                <th className="px-4 py-2 font-medium">Users</th>
                <th className="px-4 py-2 font-medium">% of MAU</th>
                <th className="px-4 py-2 font-medium">Events</th>
                <th className="px-4 py-2 font-medium">Blocked</th>
                <th className="px-4 py-2 font-medium">AI cost</th>
                <th className="px-4 py-2 font-medium">$/user</th>
                <th className="px-4 py-2 font-medium">Measured</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={r.surface} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.label}</td>
                  <td className="px-4 py-2 text-slate-700">{r.users30d || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.users30d ? pct(r.mauPct) : "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{r.events30d || "—"}</td>
                  <td className={`px-4 py-2 ${r.blocked30d ? "font-semibold text-amber-700" : "text-slate-400"}`}>
                    {r.blocked30d || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.usd30d ? usd(r.usd30d) : "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{r.usdPerUser ? usd(r.usdPerUser) : "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.instrumented ? "yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">AI spend (30d)</h2>
        <SpendChart daily={spend.daily} />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            { title: "By section", rows: spend.bySurface },
            { title: "By model", rows: spend.byModel },
            {
              title: "By origin",
              rows: spend.byOrigin,
              note: "USER is what a student costs. ADMIN/SCRIPT is one-off content CAPEX — never mix them into a per-user figure.",
            },
          ].map((g) => (
            <div key={g.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">{g.title}</div>
              {g.note ? <p className="mt-1 text-xs text-slate-500">{g.note}</p> : null}
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {g.rows.length === 0 && (
                    <tr>
                      <td className="py-1 text-slate-400">No spend yet</td>
                    </tr>
                  )}
                  {g.rows.map((r) => (
                    <tr key={r.key}>
                      <td className="py-1 pr-2 text-slate-700">{r.key}</td>
                      <td className="py-1 text-right tabular-nums text-slate-900">{usd(r.usd)}</td>
                      <td className="py-1 pl-2 text-right text-xs tabular-nums text-slate-400">
                        {r.calls}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">Cost per user (30d, USER origin only)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">AI cost</th>
                <th className="px-4 py-2 font-medium">Calls</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {whales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-slate-400">
                    No AI usage recorded yet.
                  </td>
                </tr>
              )}
              {whales.map((w) => (
                <tr key={w.userId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.email}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{w.plan}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-800">{usd(w.usd30d)}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{w.calls30d}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">
                    {w.paidUzs ? `${w.paidUzs.toLocaleString("en-US")} UZS` : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums ${w.marginUsd < 0 ? "font-semibold text-rose-600" : "text-emerald-700"}`}
                  >
                    {w.marginUsd < 0 ? "-" : ""}
                    {usd(Math.abs(w.marginUsd))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">Suspect questions</h2>
        <p className="mt-1 text-xs text-slate-600">
          Under 20% correct is worse than guessing on a 4-option MCQ — that is usually a wrong
          answer key, not a hard question. Most of this bank is synthetic, so this is the
          cheapest content QA available. Sorted by how often students asked the tutor about it.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Question</th>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Answered</th>
                <th className="px-4 py-2 font-medium">Correct</th>
                <th className="px-4 py-2 font-medium">Tutor asks</th>
              </tr>
            </thead>
            <tbody>
              {suspects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-400">
                    Nothing suspect — no question with enough answers is below 20% correct.
                  </td>
                </tr>
              )}
              {suspects.map((q) => (
                <tr key={q.questionId} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-md px-4 py-2 text-slate-700">{q.prompt}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{q.testTitle}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{q.answered}</td>
                  <td className="px-4 py-2 font-semibold tabular-nums text-rose-600">
                    {pct(q.correctPct)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{q.tutorCalls || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
