"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SpendChart({ daily }: { daily: { day: string; usd: number }[] }) {
  if (daily.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        No AI spend in the last 30 days.
      </div>
    );
  }

  return (
    <div className="mt-3 h-56 rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(d: string) => d.slice(5)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: unknown) => [`$${Number(value ?? 0).toFixed(4)}`, "Spend"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
          <Area
            type="monotone"
            dataKey="usd"
            stroke="#0284c7"
            fill="#0284c7"
            fillOpacity={0.12}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
