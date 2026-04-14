"use client";

import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, PiggyBank } from "lucide-react";
import type { Transaction } from "@/lib/api";

interface SavingsRateCardProps {
  transactions: Transaction[];
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthlyRates(transactions: Transaction[]): Array<{ month: string; rate: number; income: number; expenses: number }> {
  const map = new Map<string, { income: number; expenses: number }>();

  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = map.get(key) ?? { income: 0, expenses: 0 };
    if (t.type === "income" || t.type === "INCOME") cur.income += Math.abs(t.amount);
    else cur.expenses += Math.abs(t.amount);
    map.set(key, cur);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, { income, expenses }]) => {
      const [year, month] = key.split("-");
      const rate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
      return { month: MONTHS[parseInt(month) - 1], rate, income, expenses };
    });
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

export function SavingsRateCard({ transactions }: SavingsRateCardProps) {
  const monthlyData = useMemo(() => getMonthlyRates(transactions), [transactions]);

  if (monthlyData.length === 0) return null;

  const current = monthlyData[monthlyData.length - 1];
  const previous = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;
  const delta = previous ? current.rate - previous.rate : null;
  const avgRate = Math.round(monthlyData.reduce((s, m) => s + m.rate, 0) / monthlyData.length);

  const rateColor =
    current.rate >= 20 ? "text-emerald-600 dark:text-emerald-400" :
    current.rate >= 10 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  const ratingLabel =
    current.rate >= 20 ? "Excellent" :
    current.rate >= 10 ? "Good" :
    current.rate >= 0  ? "Needs Work" : "Overspending";

  const ratingBg =
    current.rate >= 20 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
    current.rate >= 10 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";

  const chartColor = current.rate >= 20 ? "#10b981" : current.rate >= 10 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <PiggyBank className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Savings Rate</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">This month</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${ratingBg}`}>{ratingLabel}</span>
      </div>

      {/* Big rate */}
      <div className="flex items-end gap-3 mb-1">
        <span className={`text-4xl font-black ${rateColor}`}>{current.rate}%</span>
        {delta !== null && (
          <span className={`flex items-center gap-1 text-sm font-semibold mb-1 ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>
            {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {delta > 0 ? "+" : ""}{delta}pp vs last month
          </span>
        )}
      </div>

      {/* Income vs Expenses this month */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">↑ {fmt(current.income)}</span>
        <span className="text-red-500 dark:text-red-400 font-semibold">↓ {fmt(current.expenses)}</span>
        <span className="ml-auto">6mo avg: <strong className="text-gray-700 dark:text-gray-300">{avgRate}%</strong></span>
      </div>

      {/* Trend chart */}
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ backgroundColor: "transparent", border: "none", boxShadow: "none" }}
            formatter={(v: number) => [`${v}%`, "Savings Rate"]}
            labelStyle={{ fontSize: 11, color: "#6b7280" }}
            itemStyle={{ fontSize: 11, fontWeight: 700, color: chartColor }}
          />
          <Area type="monotone" dataKey="rate" stroke={chartColor} strokeWidth={2} fill="url(#srGrad)" dot={{ r: 3, fill: chartColor }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Month labels */}
      <div className="flex justify-between mt-1">
        {monthlyData.map(m => (
          <span key={m.month} className="text-[10px] text-gray-400 dark:text-gray-500">{m.month}</span>
        ))}
      </div>

      {/* Target hint */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        {current.rate >= 20
          ? "You're hitting the recommended 20% savings benchmark. Keep it up!"
          : current.rate >= 10
            ? `Save ${fmt((current.income * 0.20) - (current.income - current.expenses))} more this month to reach the 20% target.`
            : "Aim to save at least 10–20% of your income each month."}
      </div>
    </div>
  );
}
