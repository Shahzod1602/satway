"use client";

import { useMemo, useState } from "react";
import { Shield, Mail, Calendar, Crown, X, Loader2 } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  premiumUntil: string | null;
  createdAt: string;
  _count: { attempts: number };
};

function isPremiumActive(plan: string, premiumUntil: string | null): boolean {
  if (plan !== "PREMIUM") return false;
  if (!premiumUntil) return true; // lifetime
  return new Date(premiumUntil).getTime() > Date.now();
}

const GRANTS = [
  { label: "+1m", months: 1 },
  { label: "+3m", months: 3 },
  { label: "+6m", months: 6 },
  { label: "∞", months: undefined as number | undefined },
];

export default function AdminUsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  async function mutate(id: string, action: "grant" | "revoke", months?: number) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(months ? { months } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, plan: data.user.plan, premiumUntil: data.user.premiumUntil } : u,
        ),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-xs rounded-lg border border-[#EAEAEA] px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {err && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <X className="h-4 w-4" /> {err}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#EAEAEA] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#EAEAEA] bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Plan</th>
              <th className="px-6 py-3">Premium actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAEA]">
            {filtered.map((u) => {
              const active = isPremiumActive(u.plan, u.premiumUntil);
              const rowBusy = busy === u.id;
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="h-3.5 w-3.5" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="text-slate-600">Student</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <Crown className="h-3 w-3" />
                        {u.premiumUntil
                          ? `until ${new Date(u.premiumUntil).toLocaleDateString()}`
                          : "Lifetime"}
                      </span>
                    ) : (
                      <span className="text-slate-400">Free</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {rowBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          {GRANTS.map((g) => (
                            <button
                              key={g.label}
                              onClick={() => mutate(u.id, "grant", g.months)}
                              title={g.months ? `Grant ${g.months} month(s)` : "Grant lifetime Premium"}
                              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              {g.label}
                            </button>
                          ))}
                          {active && (
                            <button
                              onClick={() => mutate(u.id, "revoke")}
                              className="ml-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Revoke
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Calendar className="h-3.5 w-3.5" />
        Granting extends from any existing active expiry. “∞” grants non-expiring Premium.
      </p>
    </div>
  );
}
