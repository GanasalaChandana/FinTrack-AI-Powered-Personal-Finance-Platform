"use client";

import React, { useEffect, useState } from "react";
import { Target, TrendingUp, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline?: string;
  category: string;
  icon?: string;
  color?: string;
  monthlyContribution?: number;
  progress?: number;
  achieved?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function daysUntil(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(deadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getGoalProgress(goal: Goal): number {
  return Math.min(100, goal.progress ?? (goal.target > 0 ? (goal.current / goal.target) * 100 : 0));
}

function isOnTrack(goal: Goal): boolean {
  if (!goal.deadline || !goal.monthlyContribution) return true;
  const remaining = Math.max(0, goal.target - goal.current);
  const days = daysUntil(goal.deadline);
  if (days <= 0) return false;
  const months = days / 30;
  return goal.monthlyContribution * months >= remaining;
}

export function SavingsGoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Goal[]>("/api/goals", { method: "GET" })
      .then((data) => setGoals(Array.isArray(data) ? data : []))
      .catch(() => setGoals([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const totalGoals    = goals.length;
  const achievedGoals = goals.filter((g) => g.achieved || getGoalProgress(g) >= 100).length;
  const totalSaved    = goals.reduce((s, g) => s + (g.current || 0), 0);
  const totalTarget   = goals.reduce((s, g) => s + (g.target  || 0), 0);
  const onTrackCount  = goals.filter((g) => !g.achieved && getGoalProgress(g) < 100 && isOnTrack(g)).length;
  const overallPct    = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const activeGoals   = goals.filter((g) => !g.achieved && getGoalProgress(g) < 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Savings Goals</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{totalGoals} goal{totalGoals !== 1 ? "s" : ""} · {achievedGoals} achieved</p>
          </div>
        </div>
        <Link
          href="/goals-budgets?tab=goals"
          className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {totalGoals === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <Target className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No goals yet.</p>
          <Link
            href="/goals-budgets?tab=goals"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Create your first goal →
          </Link>
        </div>
      ) : (
        <>
          {/* Overall progress */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span>Overall progress</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{overallPct}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              <span>{fmt(totalSaved)} saved</span>
              <span>of {fmt(totalTarget)}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalGoals}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Total</p>
            </div>
            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
              <p className="text-lg font-bold text-emerald-600">{achievedGoals}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Achieved</p>
            </div>
            <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
              <p className="text-lg font-bold text-blue-600">{onTrackCount}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">On Track</p>
            </div>
          </div>

          {/* Top active goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-2">
              {activeGoals.slice(0, 3).map((goal) => {
                const pct = getGoalProgress(goal);
                const onTrack = isOnTrack(goal);
                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">{goal.icon || "🎯"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{goal.name}</span>
                        <span className="text-[10px] font-bold ml-2 flex-shrink-0" style={{ color: goal.color || "#10b981" }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: goal.color || "#10b981" }}
                        />
                      </div>
                    </div>
                    {goal.deadline && (
                      <span className={`text-[10px] font-medium flex-shrink-0 ${onTrack ? "text-emerald-600" : "text-orange-500"}`}>
                        {onTrack ? "✅" : "⚠️"}
                      </span>
                    )}
                  </div>
                );
              })}
              {activeGoals.length > 3 && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  +{activeGoals.length - 3} more active goal{activeGoals.length - 3 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {achievedGoals > 0 && activeGoals.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600">All goals achieved! 🎉</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
