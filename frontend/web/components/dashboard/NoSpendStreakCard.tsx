"use client";

import React, { useMemo } from "react";
import { Flame, Target, Trophy, Calendar } from "lucide-react";
import type { Transaction } from "@/lib/api";

interface NoSpendStreakCardProps {
  transactions: Transaction[];
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NoSpendStreakCard({ transactions }: NoSpendStreakCardProps) {
  const { currentStreak, longestStreak, noSpendDays, thisMonth } = useMemo(() => {
    // Build a set of days that had ANY expense
    const spendDays = new Set<string>();
    transactions.forEach(t => {
      if (t.type === "expense" || t.type === "EXPENSE") {
        spendDays.add(t.date?.split("T")[0] ?? "");
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate current streak (consecutive no-spend days ending today/yesterday)
    let streak = 0;
    const cursor = new Date(today);
    while (true) {
      const key = toDateKey(cursor);
      if (spendDays.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      if (streak > 365) break;
    }

    // Calculate longest streak over past 90 days
    let longest = 0, run = 0;
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      if (!spendDays.has(key)) { run++; longest = Math.max(longest, run); }
      else run = 0;
    }

    // No-spend days this calendar month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let monthNoSpend = 0;
    const cursor2 = new Date(monthStart);
    while (cursor2 <= today) {
      if (!spendDays.has(toDateKey(cursor2))) monthNoSpend++;
      cursor2.setDate(cursor2.getDate() + 1);
    }

    // Last 30 days heatmap data
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      const key = toDateKey(d);
      return { date: d.getDate(), isNoSpend: !spendDays.has(key), isFuture: d > today };
    });

    return { currentStreak: streak, longestStreak: longest, noSpendDays: last30, thisMonth: monthNoSpend };
  }, [transactions]);

  const streakColor = currentStreak >= 7 ? "text-emerald-600 dark:text-emerald-400" : currentStreak >= 3 ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-400";
  const flameColor = currentStreak >= 7 ? "text-emerald-500" : currentStreak >= 3 ? "text-amber-500" : "text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">No-Spend Streak</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Days with zero expenses</p>
          </div>
        </div>
        {currentStreak >= 7 && (
          <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
            <Trophy className="w-3.5 h-3.5" /> On fire!
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Current streak", value: currentStreak, suffix: "d", color: streakColor, icon: <Flame className={`w-3.5 h-3.5 ${flameColor}`} /> },
          { label: "Longest (90d)", value: longestStreak, suffix: "d", color: "text-indigo-600 dark:text-indigo-400", icon: <Trophy className="w-3.5 h-3.5 text-indigo-400" /> },
          { label: "This month", value: thisMonth, suffix: "d", color: "text-teal-600 dark:text-teal-400", icon: <Calendar className="w-3.5 h-3.5 text-teal-400" /> },
        ].map(({ label, value, suffix, color, icon }) => (
          <div key={label} className="text-center">
            <div className="flex justify-center mb-1">{icon}</div>
            <p className={`text-2xl font-black ${color}`}>{value}<span className="text-sm font-semibold">{suffix}</span></p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* 30-day heatmap */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest">Last 30 days</p>
      <div className="flex gap-1 flex-wrap">
        {noSpendDays.map((d, i) => (
          <div
            key={i}
            title={`Day ${d.date} — ${d.isFuture ? "future" : d.isNoSpend ? "No spend ✓" : "Spent"}`}
            className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
              d.isFuture
                ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                : d.isNoSpend
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-400 dark:text-red-500"
            }`}
          >
            {d.date}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-200 dark:bg-emerald-900/40" />No spend</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 dark:bg-red-900/30" />Spent</span>
      </div>

      {/* Motivational hint */}
      <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        {currentStreak === 0
          ? "Start a no-spend streak today — every day without spending counts!"
          : currentStreak < 3
            ? `${3 - currentStreak} more day${3 - currentStreak > 1 ? "s" : ""} to reach a 3-day streak!`
            : currentStreak < 7
              ? `${7 - currentStreak} more day${7 - currentStreak > 1 ? "s" : ""} to reach a full week!`
              : `Amazing! You've gone ${currentStreak} days without spending. Keep it up!`}
      </p>
    </div>
  );
}
