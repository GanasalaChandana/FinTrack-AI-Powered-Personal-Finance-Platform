"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag,
  Calendar, DollarSign, Loader2, ArrowUpRight,
} from "lucide-react";
import { transactionsAPI, type Transaction } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining":    "#f59e0b",
  "Transportation":   "#8b5cf6",
  "Shopping":         "#ec4899",
  "Entertainment":    "#f97316",
  "Bills & Utilities":"#3b82f6",
  "Healthcare":       "#ef4444",
  "Housing":          "#10b981",
  "Health & Fitness": "#06b6d4",
  "Education":        "#6366f1",
  "Travel":           "#84cc16",
  "Insurance":        "#64748b",
  "Personal Care":    "#d946ef",
  "Other":            "#9ca3af",
  "Income":           "#22c55e",
  "Savings":          "#0ea5e9",
};

const COLOR_PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#f97316", "#3b82f6", "#84cc16", "#06b6d4",
];

function isExpense(t: Transaction) {
  return t.type === "expense" || t.type === "EXPENSE";
}

// ─── Data processors ─────────────────────────────────────────────────────────

function getTopMerchants(transactions: Transaction[], n = 10) {
  const map = new Map<string, { total: number; count: number }>();
  transactions.filter(isExpense).forEach((t) => {
    const m = (t.merchant || t.description || "Unknown").trim();
    const cur = map.get(m) ?? { total: 0, count: 0 };
    map.set(m, { total: cur.total + Math.abs(t.amount), count: cur.count + 1 });
  });
  return [...map.entries()]
    .map(([name, { total, count }]) => ({ name, total, count, avg: total / count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

function getDayOfWeekData(transactions: Transaction[]) {
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  transactions.filter(isExpense).forEach((t) => {
    const d = new Date(t.date + "T00:00:00").getDay();
    totals[d] += Math.abs(t.amount);
    counts[d]++;
  });
  return DAYS.map((day, i) => ({
    day,
    total: parseFloat(totals[i].toFixed(2)),
    avg: counts[i] > 0 ? parseFloat((totals[i] / counts[i]).toFixed(2)) : 0,
    count: counts[i],
  }));
}

function getCategoryTrends(transactions: Transaction[]) {
  // Last 6 months
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTHS[d.getMonth()],
    });
  }

  // Get top 5 categories by total spend
  const catTotals = new Map<string, number>();
  transactions.filter(isExpense).forEach((t) => {
    const c = t.category || "Other";
    catTotals.set(c, (catTotals.get(c) ?? 0) + Math.abs(t.amount));
  });
  const topCats = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  return {
    data: months.map(({ key, label }) => {
      const row: Record<string, any> = { month: label };
      topCats.forEach((cat) => {
        row[cat] = parseFloat(
          transactions
            .filter((t) => isExpense(t) && t.date?.startsWith(key) && t.category === cat)
            .reduce((s, t) => s + Math.abs(t.amount), 0)
            .toFixed(2)
        );
      });
      return row;
    }),
    categories: topCats,
  };
}

function getSizeDistribution(transactions: Transaction[]) {
  const expenses = transactions.filter(isExpense);
  const buckets = [
    { label: "Small", desc: "< $20",       min: 0,   max: 20,   color: "#10b981", count: 0, total: 0 },
    { label: "Medium", desc: "$20–$100",   min: 20,  max: 100,  color: "#3b82f6", count: 0, total: 0 },
    { label: "Large",  desc: "$100–$500",  min: 100, max: 500,  color: "#f59e0b", count: 0, total: 0 },
    { label: "Major",  desc: "> $500",     min: 500, max: Infinity, color: "#ef4444", count: 0, total: 0 },
  ];
  expenses.forEach((t) => {
    const abs = Math.abs(t.amount);
    const b = buckets.find((bk) => abs >= bk.min && abs < bk.max);
    if (b) { b.count++; b.total += abs; }
  });
  return buckets;
}

function getSummaryStats(transactions: Transaction[]) {
  const expenses = transactions.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const avg = expenses.length ? total / expenses.length : 0;
  const largest = expenses.length ? Math.max(...expenses.map((t) => Math.abs(t.amount))) : 0;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const thisTotal = expenses.filter((t) => t.date?.startsWith(thisMonth)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const lastTotal = expenses.filter((t) => t.date?.startsWith(lastMonth)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const momChange = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : null;

  return { total, avg, largest, thisTotal, lastTotal, momChange, txCount: expenses.length };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CurrencyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"30" | "90" | "180" | "365">("90");

  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("ft_token");
    if (!token) { router.replace("/register?mode=signin"); return; }
    transactionsAPI.getAll().then((data) => {
      setTransactions(Array.isArray(data) ? data : []);
    }).catch(() => setTransactions([])).finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(range));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return transactions.filter((t) => t.date >= cutoffStr);
  }, [transactions, range]);

  const topMerchants = useMemo(() => getTopMerchants(filtered), [filtered]);
  const dayOfWeek    = useMemo(() => getDayOfWeekData(filtered), [filtered]);
  const { data: trendData, categories: trendCats } = useMemo(() => getCategoryTrends(filtered), [filtered]);
  const sizeDist     = useMemo(() => getSizeDistribution(filtered), [filtered]);
  const stats        = useMemo(() => getSummaryStats(filtered), [filtered]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300">Crunching your data...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">No data yet</h2>
          <p className="text-gray-500 dark:text-gray-400">Add some transactions to see your spending analytics.</p>
        </div>
      </div>
    );
  }

  const RANGES = [
    { label: "30d", value: "30" },
    { label: "90d", value: "90" },
    { label: "6mo", value: "180" },
    { label: "1yr", value: "365" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              Spending Analytics
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Deep-dive into your spending patterns</p>
          </div>
          {/* Range picker */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
            {RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  range === value
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary stat row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Spent",       value: fmt(stats.total),    icon: DollarSign,  color: "from-red-500 to-red-600" },
            { label: "This Month",        value: fmt(stats.thisTotal), icon: Calendar,    color: "from-orange-500 to-orange-600",
              sub: stats.momChange !== null
                ? `${stats.momChange > 0 ? "+" : ""}${stats.momChange.toFixed(1)}% vs last month`
                : undefined,
              subColor: stats.momChange !== null ? (stats.momChange > 0 ? "text-red-500" : "text-emerald-500") : undefined,
            },
            { label: "Avg Transaction",  value: fmt(stats.avg),      icon: TrendingUp,  color: "from-blue-500 to-blue-600" },
            { label: "Largest Purchase", value: fmt(stats.largest),  icon: ShoppingBag, color: "from-purple-500 to-purple-600" },
          ].map(({ label, value, icon: Icon, color, sub, subColor }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              {sub && <p className={`text-xs mt-0.5 font-medium ${subColor}`}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Row 1: Top Merchants + Day of Week ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Top Merchants */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Top Merchants</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Where your money goes most</p>
              </div>
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topMerchants} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="total" name="Total Spent" radius={[0, 6, 6, 0]}>
                  {topMerchants.map((_, i) => (
                    <Cell key={i} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Day of Week */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Spending by Day</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Which days you spend the most</p>
              </div>
              <Calendar className="w-5 h-5 text-amber-500" />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dayOfWeek} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="total" name="Total Spent" radius={[6, 6, 0, 0]}>
                  {dayOfWeek.map((d, i) => {
                    const max = Math.max(...dayOfWeek.map((x) => x.total));
                    return <Cell key={i} fill={d.total === max ? "#6366f1" : "#c7d2fe"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Busiest day callout */}
            {(() => {
              const busiest = [...dayOfWeek].sort((a, b) => b.total - a.total)[0];
              return busiest?.total > 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                  📅 You spend most on <span className="font-bold text-indigo-600 dark:text-indigo-400">{busiest.day}</span> — {fmt(busiest.total)} total
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* ── Row 2: Category Trends ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Category Trends</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monthly spend across your top 5 categories</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          {trendCats.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Not enough data to show trends</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  {trendCats.map((cat, i) => (
                    <linearGradient key={cat} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CATEGORY_COLORS[cat] ?? COLOR_PALETTE[i % COLOR_PALETTE.length]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CATEGORY_COLORS[cat] ?? COLOR_PALETTE[i % COLOR_PALETTE.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" />
                {trendCats.map((cat, i) => (
                  <Area key={cat} type="monotone" dataKey={cat}
                    stroke={CATEGORY_COLORS[cat] ?? COLOR_PALETTE[i % COLOR_PALETTE.length]}
                    fill={`url(#grad-${i})`} strokeWidth={2}
                    dot={{ r: 3, fill: CATEGORY_COLORS[cat] ?? COLOR_PALETTE[i % COLOR_PALETTE.length] }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Row 3: Transaction Size Distribution ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Transaction Size Breakdown</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">How your {stats.txCount} transactions are distributed by size</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sizeDist.map((bucket) => {
              const pct = stats.txCount > 0 ? Math.round((bucket.count / stats.txCount) * 100) : 0;
              return (
                <div key={bucket.label} className="rounded-xl p-4 border border-gray-100 dark:border-gray-700" style={{ borderLeftWidth: 4, borderLeftColor: bucket.color }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{bucket.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: bucket.color }}>
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{bucket.desc}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{bucket.count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">transactions · {fmt(bucket.total)}</p>
                  {/* Mini bar */}
                  <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bucket.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
