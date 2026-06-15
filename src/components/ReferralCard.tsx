"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Gift, Users } from "lucide-react";

export default function ReferralCard({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ count: 0, rewarded: 0 });

  useEffect(() => {
    fetch("/api/referral/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referralCode}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-50 text-accent-600">
          <Gift className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">Invite friends</h2>
          <p className="text-xs text-slate-500">
            Share your code — both get <strong>+1 week Premium</strong> when they pay.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-700">
          {referralCode}
        </div>
        <button
          onClick={copyCode}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-slate-500 hover:bg-slate-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <button
        onClick={copy}
        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        {copied ? "Copied!" : "Copy invite link"}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{stats.count}</p>
          <p className="text-[11px] text-slate-500">Referred</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{stats.rewarded}</p>
          <p className="text-[11px] text-slate-500">Rewarded</p>
        </div>
      </div>
    </div>
  );
}
