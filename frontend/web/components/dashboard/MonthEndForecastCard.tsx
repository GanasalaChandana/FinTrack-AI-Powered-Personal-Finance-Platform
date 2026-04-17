"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, CalendarDays } from "lucide-react";
import { Transaction } from "@/lib/api";

interface Props {
  transactions: Transaction[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

export function MonthEndForecastCard({ transactions }: Props) {
  const data = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = now.getDate();
    const daysLeft = daysInMonth - daysPassed;
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Current month expenses only
    const thisMonthExpenses = transactions.filter(
      (t) =>
        (t.type === "expense" || t.type === "EXPENSE") &&
        t.date?.startsWith(monthKey)
    );
    const spentSoFar = thisMonthExpenses.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

    // Daily burn rate based on days passed
    const dailyRate = daysPassed > 0 ? spentSoFar / daysPassed : 0;

    // Projected month-end total
    const projected = dailyRate * daysInMonth;

    // Previous month for comparison
    const prevDate = new Date(year, month - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevMonthTotal = transactions
      .filter(
        (t) =>
          (t.type === "expense" || t.type === "EXPENSE") &&
          t.date?.startsWith(prevKey)
      )
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

    // Max daily spend to match last month's total
    const dailyBudgetToMatch = prevMonthTotal > 0 && daysLeft > 0
      ? (prevMonthTotal - spentSoFar) / daysLeft
      : null;

    // % change vs last month
    const vsLastMonth =
      prevMonthTotal > 0
        ? ((projected - prevMonthTotal) / prevMonthTotal) * 100
        : null;

    // Progress through month (%)
    const monthProgress = (daysPassed / daysInMonth) * 100;
    // Progress through budget (spending pace %)
    const spendingPace = prevMonthTotal > 0 ? (spentSoFar / prevMonthTotal) * 100 : null;

    return {
      daysPassed,
      daysLeft,
      daysInMonth,
      monthProgress,
      spentSoFar,
      dailyRate,
      projected,
      prevMonthTotal,
      dailyBudgetToMatch,
      vsLastMonth,
      spendingPace,
      monthName: now.toLocaleString("default", { month: "long" }),
      year,
    };
  }, [transactions]);

  const {
    daysPassed, daysLeft, daysInMonth, monthProgress,
    spentSoFar, dailyRate, projected, prevMonthTotal,
    dailyBudgetToMatch, vsLastMonth, monthName, spendingPace,
  } = data;

  // Status: are we on track vs last month?
  const isOver = vsLastMonth !== null && vsLastMonth > 10;
  const isUnder = vsLastMonth !== null && vsLastMonth < -10;
  const isNeutral = !isOver && !isUnder;

  const statusColor = isOver
    ? "text-red-600 dark:text-red-400"
    : isUnder
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  const badgeBg = isOver
    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50"
    : isUnder
    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40";

  const TrendIcon = isOver ? TrendingUp : isUnder ? TrendingDown : Minus;

  // Month progress bar — show both time progress and spend pace
  const spendBarPct = prevMonthTotal > 0
    ? Math.min((spentSoFar / prevMonthTotal) * 100, 100)
    : Math.min(monthProgress, 100);

  const spendBarColor = isOver
    ? "bg-red-500"
    : spendingPace !== null && spendingPace > monthProgress + 10
    ? "bg-orange-400"
    : "bg-emerald-500";

  if (transactions.length === 0) return null;

  return (
    <div className="ai-card-hover bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
      {/* Accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-500 to-indigo-500" />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarDays className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold text-sky-500 uppercase tracking-widest">Month-End Forecast</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{monthName} {data.year}</p>
          </div>
          {vsLastMonth !== null && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${badgeBg}`}>
              <TrendIcon className="w-3 h-3" />
              {Math.abs(vsLastMonth).toFixed(0)}% vs last month
            </div>
          )}
        </div>

        {/* Month timeline bar */}
        <div>
          <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
            <span>Day {daysPassed}</span>
            <span>{daysLeft} days left</span>
            <span>Day {daysInMonth}</span>
          </div>
          {/* Time progress (gray) */}
          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gray-300 dark:bg-gray-500 transition-all duration-700"
              style={{ width: `${monthProgress}%` }}
            />
          </div>
          {/* Spend pace vs last month */}
          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${spendBarColor}`}
              style={{ width: `${spendBarPct}%` }}
            />
            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-400"
              style={{ left: `${monthProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-gray-400 dark:text-gray-500">
            <span>Time →</span>
            <span>Spend pace →</span>
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Spent so far</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{fmt(spentSoFar)}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{fmt(dailyRate)}/day avg</p>
          </div>
          <div className={`rounded-xl p-3 ${isOver ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-gray-700/50"}`}>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Projected total</p>
            <p className={`text-xl font-extrabold ${statusColor}`}>{fmt(projected)}</p>
            {prevMonthTotal > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Last month: {fmt(prevMonthTotal)}</p>
            )}
          </div>
        </div>

        {/* Recommendation row */}
        <div className={`rounded-xl px-3.5 py-2.5 border text-sm ${badgeBg}`}>
          {isOver && dailyBudgetToMatch !== null && dailyBudgetToMatch > 0 ? (
            <p>
              <span className="font-bold">Pace down:</span> spend ≤{" "}
              <span className="font-bold">{fmt(dailyBudgetToMatch)}/day</span> to match last month
            </p>
          ) : isOver && (dailyBudgetToMatch === null || dailyBudgetToMatch <= 0) ? (
            <p>
              <span className="font-bold">High pace</span> — already at last month's total with {daysLeft} days left
            </p>
          ) : isUnder ? (
            <p>
              <span className="font-bold">Great pace!</span> On track to spend{" "}
              <span className="font-bold">{fmt(Math.abs((vsLastMonth ?? 0) / 100 * prevMonthTotal))}</span> less than last month
            </p>
          ) : (
            <p>
              <span className="font-bold">Steady pace</span> — projected spend is close to last month's total
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
