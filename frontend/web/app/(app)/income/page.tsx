"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { TrendingUp, DollarSign, Loader2, ArrowUpRight, Layers } from "lucide-react";
import { transactionsAPI, type Transaction } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SOURCE_COLORS: Record<string, string> = {
  "Salary":     "#6366f1",
  "Freelance":  "#10b981",
  "Investment": "#f59e0b",
  "Business":   "#ec4899",
  "Gift":       "#8b5cf6",
  "Other":      "#94a3b8",
};

const COLOR_FALLBACK = ["#6366f1","#10b981","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#84cc16","#ef4444"];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isIncome(t: Transaction) {
  return t.type === "income" || t.type === "INCOME";
}

function getSourceColor(name: string, idx: number): string {
  return SOURCE_COLORS[name] ?? COLOR_FALLBACK[idx % COLOR_FALLBACK.length];
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-lg text-xs">
      <p className="font-bold text-gray-900 dark:text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"3" | "6" | "12">("6");

  useEffect(() => {
    transactionsAPI.getAll()
      .then((data: Transaction[]) => setTransactions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const incomeOnly = useMemo(
    () => transactions.filter(isIncome),
    [transactions]
  );

  // Filter to selected range
  const rangeMonths = parseInt(range);
  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - rangeMonths);
    return incomeOnly.filter(t => new Date(t.date) >= cutoff);
  }, [incomeOnly, rangeMonths]);

  // ── Source breakdown (pie) ────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(t => {
      const src = t.category || "Other";
      map.set(src, (map.get(src) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value: Math.round(value), color: getSourceColor(name, i) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalIncome = sourceData.reduce((s, d) => s + d.value, 0);

  // ── Monthly income trend ──────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    filtered.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = MONTHS[d.getMonth()];
      if (!map.has(key)) map.set(key, { label, total: 0 });
      const row = map.get(key)!;
      const src = t.category || "Other";
      row[src] = (row[src] ?? 0) + Math.abs(t.amount);
      row.total = (row.total ?? 0) + Math.abs(t.amount);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, total: Math.round(v.total as number) }));
  }, [filtered]);

  // ── Top income months ─────────────────────────────────────────────────────
  const topMonths = useMemo(
    () => [...monthlyData].sort((a, b) => (b.total as number) - (a.total as number)).slice(0, 3),
    [monthlyData]
  );

  const avgMonthly = monthlyData.length
    ? Math.round(monthlyData.reduce((s, m) => s + (m.total as number), 0) / monthlyData.length)
    : 0;

  const sources = sourceData.map(s => s.name);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (incomeOnly.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No income transactions yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add income transactions to see your breakdown.</p>
          <button onClick={() => router.push("/transactions")} className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
            Go to Transactions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Income Breakdown
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Analyse your income sources and trends</p>
          </div>
          {/* Range picker */}
          <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 gap-1 self-start sm:self-auto">
            {(["3","6","12"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === r
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {r}mo
              </button>
            ))}
          </div>
        </div>

        {/* Summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Income", value: fmt(totalIncome), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Monthly Average", value: fmt(avgMonthly), color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
            { label: "Income Sources", value: String(sourceData.length), color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
            { label: "Transactions", value: String(filtered.length), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4 border border-gray-100 dark:border-gray-700`}>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Pie + Source list */}
        <div className="grid sm:grid-cols-2 gap-5">
          {/* Pie chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">By Source</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sourceData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Source breakdown list */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Source Details</h3>
            <div className="space-y-3">
              {sourceData.map(src => {
                const pct = totalIncome > 0 ? (src.value / totalIncome) * 100 : 0;
                return (
                  <div key={src.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: src.color }} />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{src.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(src.value)}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: src.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly stacked bar chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Monthly Income by Source</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Stacked by income category over the last {range} months</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              {sources.map((src, i) => (
                <Bar key={src} dataKey={src} name={src} stackId="income" fill={getSourceColor(src, i)} radius={i === sources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend area chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Total Income Trend</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Combined monthly income</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CurrencyTooltip />} />
              <Area type="monotone" dataKey="total" name="Total Income" stroke="#10b981" strokeWidth={2.5} fill="url(#incGrad)" dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top earning months */}
        {topMonths.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Top Earning Months</h3>
            <div className="grid grid-cols-3 gap-3">
              {topMonths.map((m, i) => (
                <div key={i} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-2">{m.label}</p>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmt(m.total as number)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent income transactions */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Income</h3>
            <button
              onClick={() => router.push("/transactions?type=income")}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.slice(0, 8).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t, i) => {
              const src = t.category || "Other";
              const color = getSourceColor(src, Object.keys(SOURCE_COLORS).indexOf(src));
              return (
                <div key={t.id ?? i} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${color}20`, color }}
                  >
                    {(t.merchant || t.description || "?")[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {t.merchant || t.description || "Income"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {src} · {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{fmt(Math.abs(t.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
