"use client";

// HealthScoreWidget — compact dashboard card showing Financial Health Score
// Pulls score from healthScore utility and links to /health for full breakdown.

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { calculateFinancialHealthScore } from "@/lib/utils/healthScore";
import { Transaction, Budget } from "@/lib/api";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
}

function gradeColor(grade: string) {
  switch (grade) {
    case "A": return { text: "text-emerald-600", bg: "bg-emerald-500", ring: "#10b981" };
    case "B": return { text: "text-blue-600",    bg: "bg-blue-500",    ring: "#3b82f6" };
    case "C": return { text: "text-amber-600",   bg: "bg-amber-400",   ring: "#f59e0b" };
    case "D": return { text: "text-orange-600",  bg: "bg-orange-500",  ring: "#f97316" };
    default:  return { text: "text-red-600",     bg: "bg-red-500",     ring: "#ef4444" };
  }
}

function scoreLabel(score: number) {
  if (score >= 800) return "Excellent";
  if (score >= 650) return "Good";
  if (score >= 500) return "Fair";
  if (score >= 350) return "Needs Work";
  return "At Risk";
}

export function HealthScoreWidget({ transactions, budgets }: Props) {
  const result = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const income   = transactions.filter(t => ["income","INCOME"].includes(t.type ?? ""));
    const expenses = transactions.filter(t => !["income","INCOME"].includes(t.type ?? ""));

    const monthlyIncome   = income.filter(t => t.date >= monthStart).reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlyExpenses = expenses.filter(t => t.date >= monthStart).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalSavings    = income.reduce((s, t) => s + Math.abs(t.amount), 0)
                          - expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlyBudget   = budgets.reduce((s, b) => s + (b.budget || 0), 0);

    return calculateFinancialHealthScore({
      monthlyIncome,
      monthlyExpenses,
      totalSavings: Math.max(totalSavings, 0),
      totalDebt: 0,
      emergencyFund: Math.max(totalSavings, 0),
      monthlyBudget,
      actualSpending: monthlyExpenses,
      onTimePayments: 1,
      totalPayments: 1,
    });
  }, [transactions, budgets]);

  const { text, ring } = gradeColor(result.grade);
  // Arc progress (circumference of r=32 circle = 201)
  const circ = 201;
  const pct  = Math.min(result.totalScore / 1000, 1);
  const dash = circ * pct;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
            <Activity className="w-4 h-4 text-violet-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            Financial Health
          </h3>
        </div>
        <Link
          href="/health"
          className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
        >
          Details <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Score circle + grade */}
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80">
            {/* Track */}
            <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="7" />
            {/* Progress arc */}
            <circle
              cx="40" cy="40" r="32"
              fill="none"
              stroke={ring}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={circ * 0.25}
              transform="rotate(-90 40 40)"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-extrabold leading-none ${text}`}>{result.grade}</span>
            <span className="text-[9px] text-gray-400 mt-0.5">{result.totalScore}/1000</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold ${text}`}>{scoreLabel(result.totalScore)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
            {result.recommendations[0] ?? "Keep up the great financial habits!"}
          </p>
        </div>
      </div>

      {/* Mini component bars */}
      <div className="flex flex-col gap-1.5">
        {(Object.entries(result.components) as [string, { percentage: number; status: string }][]).map(([key, comp]) => {
          const label = key === "savingsRate"    ? "Savings Rate"
                      : key === "debtToIncome"   ? "Debt Ratio"
                      : key === "emergencyFund"  ? "Emergency Fund"
                      : key === "budgetAdherence"? "Budget"
                      : "Payments";
          const barColor = comp.status === "excellent" ? "bg-emerald-400"
                         : comp.status === "good"      ? "bg-blue-400"
                         : comp.status === "fair"      ? "bg-amber-400"
                         : "bg-red-400";
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${comp.percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 w-6 text-right">{comp.percentage.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
