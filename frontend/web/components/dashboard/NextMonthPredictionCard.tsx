"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Transaction } from "@/lib/api";

interface Props {
  transactions: Transaction[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

function trendIcon(pct: number) {
  if (pct > 5) return <TrendingUp className="w-3.5 h-3.5" />;
  if (pct < -5) return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

function trendLabel(pct: number) {
  if (pct > 5) return `+${pct.toFixed(0)}%`;
  if (pct < -5) return `${pct.toFixed(0)}%`;
  return "Stable";
}

function trendColor(pct: number, inverse = false) {
  const up = inverse ? pct < -5 : pct > 5;
  const down = inverse ? pct > 5 : pct < -5;
  if (up) return "text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40";
  if (down) return "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40";
  return "text-sky-500 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/40";
}

interface MonthlyTotals {
  income: number;
  expenses: number;
  savings: number;
}

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function NextMonthPredictionCard({ transactions }: Props) {
  const prediction = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Build monthly totals for the last 3 full months
    const months: MonthlyTotals[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = getMonthKey(d.getFullYear(), d.getMonth());

      const monthTxns = transactions.filter((t) => t.date?.startsWith(key));
      const income = monthTxns
        .filter((t) => t.type === "income" || t.type === "INCOME")
        .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
      const expenses = monthTxns
        .filter((t) => t.type === "expense" || t.type === "EXPENSE")
        .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

      months.push({ income, expenses, savings: income - expenses });
    }

    // Only months with any data
    const activMonths = months.filter((m) => m.income > 0 || m.expenses > 0);
    if (activMonths.length === 0) return null;

    // 3-month weighted average (most recent weighs more: 3,2,1)
    const weights = [3, 2, 1].slice(0, activMonths.length);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const avgIncome =
      activMonths.reduce((s, m, i) => s + m.income * weights[i], 0) / totalWeight;
    const avgExpenses =
      activMonths.reduce((s, m, i) => s + m.expenses * weights[i], 0) / totalWeight;
    const avgSavings = avgIncome - avgExpenses;

    // Linear trend: compare most recent month vs 3-month average
    const recentIncome = activMonths[0].income;
    const recentExpenses = activMonths[0].expenses;
    const incomeTrendPct =
      avgIncome > 0 ? ((recentIncome - avgIncome) / avgIncome) * 100 : 0;
    const expenseTrendPct =
      avgExpenses > 0 ? ((recentExpenses - avgExpenses) / avgExpenses) * 100 : 0;

    // Projected next month: weighted avg + half of current trend momentum
    const predictedIncome = avgIncome * (1 + incomeTrendPct / 200);
    const predictedExpenses = avgExpenses * (1 + expenseTrendPct / 200);
    const predictedSavings = predictedIncome - predictedExpenses;
    const savingsTrendPct =
      avgSavings !== 0
        ? ((predictedSavings - avgSavings) / Math.abs(avgSavings)) * 100
        : 0;

    // Savings rate
    const savingsRate =
      predictedIncome > 0 ? (predictedSavings / predictedIncome) * 100 : 0;

    // Next month label
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthLabel = nextDate.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Confidence: 3 months = high, 2 = medium, 1 = low
    const confidence =
      activMonths.length >= 3 ? "High" : activMonths.length === 2 ? "Medium" : "Low";
    const confidenceColor =
      activMonths.length >= 3
        ? "text-emerald-600 dark:text-emerald-400"
        : activMonths.length === 2
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-500";

    return {
      predictedIncome,
      predictedExpenses,
      predictedSavings,
      savingsRate,
      incomeTrendPct,
      expenseTrendPct,
      savingsTrendPct,
      nextMonthLabel,
      confidence,
      confidenceColor,
      monthsUsed: activMonths.length,
    };
  }, [transactions]);

  if (!prediction) return null;

  const {
    predictedIncome,
    predictedExpenses,
    predictedSavings,
    savingsRate,
    incomeTrendPct,
    expenseTrendPct,
    savingsTrendPct,
    nextMonthLabel,
    confidence,
    confidenceColor,
    monthsUsed,
  } = prediction;

  const savingsPositive = predictedSavings >= 0;

  return (
    <div className="ai-card-hover rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Header band */}
      <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-white text-sm tracking-wide">
            Next Month Prediction
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold ${confidenceColor} bg-white/90 px-2 py-0.5 rounded-full`}>
            {confidence} confidence
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Next month label */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Forecast for{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {nextMonthLabel}
            </span>
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Based on {monthsUsed} month{monthsUsed !== 1 ? "s" : ""} of data
          </span>
        </div>

        {/* Three metric rows */}
        <div className="flex flex-col gap-2.5">
          {/* Income */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                Predicted Income
              </p>
              <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                {fmt(predictedIncome)}
              </p>
            </div>
            <div
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${trendColor(
                incomeTrendPct,
                false
              )}`}
            >
              {trendIcon(incomeTrendPct)}
              {trendLabel(incomeTrendPct)}
            </div>
          </div>

          {/* Expenses */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-0.5">
                Predicted Expenses
              </p>
              <p className="text-lg font-extrabold text-rose-700 dark:text-rose-300">
                {fmt(predictedExpenses)}
              </p>
            </div>
            <div
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${trendColor(
                expenseTrendPct,
                true
              )}`}
            >
              {trendIcon(expenseTrendPct)}
              {trendLabel(expenseTrendPct)}
            </div>
          </div>

          {/* Net Savings */}
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${
              savingsPositive
                ? "bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
            }`}
          >
            <div>
              <p
                className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                  savingsPositive
                    ? "text-sky-700 dark:text-sky-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                Predicted Savings
              </p>
              <p
                className={`text-lg font-extrabold ${
                  savingsPositive
                    ? "text-sky-700 dark:text-sky-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {fmt(predictedSavings)}
              </p>
            </div>
            <div className="text-right">
              <div
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${trendColor(
                  savingsTrendPct,
                  false
                )}`}
              >
                {trendIcon(savingsTrendPct)}
                {trendLabel(savingsTrendPct)}
              </div>
            </div>
          </div>
        </div>

        {/* Savings rate callout */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Predicted savings rate:{" "}
            <span
              className={`font-bold ${
                savingsRate >= 20
                  ? "text-emerald-600 dark:text-emerald-400"
                  : savingsRate >= 10
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-500"
              }`}
            >
              {savingsRate.toFixed(0)}%
            </span>
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            AI-powered <Sparkles className="w-3 h-3 text-violet-400" />
          </p>
        </div>
      </div>
    </div>
  );
}
