"use client";

// DailySpendCard — shows today's spending and how it compares to the user's
// average daily spend. Unique among dashboard cards: no other card surfaces
// today-specific data.

import { useMemo } from "react";
import { Sun, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Transaction } from "@/lib/api";

interface Props {
  transactions: Transaction[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
  }).format(v);

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DailySpendCard({ transactions }: Props) {
  const data = useMemo(() => {
    const today       = localDateStr();
    const now         = new Date();
    const monthKey    = today.slice(0, 7);

    const expenses = transactions.filter(
      (t) => t.type === "expense" || t.type === "EXPENSE"
    );

    // Today's spend
    const todayTxns = expenses.filter((t) => (t.date ?? "").slice(0, 10) === today);
    const todayTotal = todayTxns.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const todayCount = todayTxns.length;

    // This month's daily average (excluding today)
    const monthTxns = expenses.filter(
      (t) => (t.date ?? "").startsWith(monthKey) && (t.date ?? "").slice(0, 10) !== today
    );
    const daysPassed = now.getDate() - 1;          // days before today in this month
    const dailyAvg   = daysPassed > 0
      ? monthTxns.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) / daysPassed
      : null;

    // Trend vs daily average
    const vsAvg = dailyAvg != null && dailyAvg > 0
      ? ((todayTotal - dailyAvg) / dailyAvg) * 100
      : null;

    // Last 7 transactions today
    const recentToday = [...todayTxns]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);

    return { todayTotal, todayCount, dailyAvg, vsAvg, recentToday };
  }, [transactions]);

  const { todayTotal, todayCount, dailyAvg, vsAvg, recentToday } = data;

  const isOver   = vsAvg !== null && vsAvg > 15;
  const isUnder  = vsAvg !== null && vsAvg < -15;
  const TrendIcon = isOver ? TrendingUp : isUnder ? TrendingDown : Minus;
  const trendColor = isOver
    ? "text-red-500"
    : isUnder
    ? "text-emerald-500"
    : "text-sky-500";
  const badgeBg = isOver
    ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40"
    : isUnder
    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
    : "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/40";

  const dayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#f59e0b,#f97316)" }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Today's Spending
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">{dayLabel}</p>
            </div>
          </div>
          {vsAvg !== null && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${badgeBg}`}>
              <TrendIcon className="w-3 h-3" />
              {Math.abs(vsAvg).toFixed(0)}% vs avg
            </div>
          )}
        </div>

        {/* Big number */}
        <div className="flex items-end gap-3">
          <span className={`text-3xl font-extrabold tracking-tight ${isOver ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
            {fmt(todayTotal)}
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">
            {todayCount} transaction{todayCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Daily average comparison */}
        {dailyAvg !== null && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isOver ? "bg-red-400" : isUnder ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min((todayTotal / (dailyAvg * 2 || 1)) * 100, 100)}%` }}
              />
            </div>
            <span className="flex-shrink-0">Avg {fmt(dailyAvg)}/day</span>
          </div>
        )}

        {/* Today's transactions list */}
        {recentToday.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Today's purchases
            </p>
            {recentToday.map((t, i) => (
              <div key={t.id ?? i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                  {t.merchant || t.description || "Purchase"}
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0">
                  {fmt(Math.abs(t.amount ?? 0))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1 text-center">
            <Sun className="w-6 h-6 text-amber-300" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No spending yet today
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {dailyAvg != null ? `Your daily average is ${fmt(dailyAvg)}` : "Keep it up! 🌟"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
