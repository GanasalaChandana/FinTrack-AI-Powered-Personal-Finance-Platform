"use client";

import { useMemo } from "react";
import { ShieldAlert, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetItem {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
}

interface Props {
  budgets: BudgetItem[];
}

type AlertLevel = "over" | "critical" | "warning" | "ok";

// ─── Config ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<AlertLevel, {
  label: string;
  rowBg: string;
  bar: string;
  badge: string;
  valueText: string;
}> = {
  over: {
    label: "Over Budget",
    rowBg: "bg-red-50 dark:bg-red-900/20",
    bar: "bg-red-500",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    valueText: "text-red-600 dark:text-red-400",
  },
  critical: {
    label: "Critical",
    rowBg: "bg-orange-50 dark:bg-orange-900/20",
    bar: "bg-orange-500",
    badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
    valueText: "text-orange-600 dark:text-orange-400",
  },
  warning: {
    label: "Warning",
    rowBg: "bg-amber-50 dark:bg-amber-900/20",
    bar: "bg-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    valueText: "text-amber-600 dark:text-amber-400",
  },
  ok: {
    label: "On Track",
    rowBg: "bg-gray-50 dark:bg-gray-700/30",
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    valueText: "text-emerald-600 dark:text-emerald-400",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLevel(pct: number): AlertLevel {
  if (pct >= 100) return "over";
  if (pct >= 90) return "critical";
  if (pct >= 75) return "warning";
  return "ok";
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(v);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BudgetAlertsCard({ budgets }: Props) {
  const alerts = useMemo(() => {
    return budgets
      .filter((b) => b.budget > 0)
      .map((b) => ({
        ...b,
        pct: Math.round((b.spent / b.budget) * 100),
        level: getLevel((b.spent / b.budget) * 100),
      }))
      .sort((a, b) => b.pct - a.pct); // highest usage first
  }, [budgets]);

  const overCount = alerts.filter((a) => a.level === "over").length;
  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const warningCount = alerts.filter((a) => a.level === "warning").length;
  const atRiskCount = overCount + criticalCount + warningCount;

  if (alerts.length === 0) return null;

  // Determine header severity
  const headerSeverity =
    overCount > 0 ? "over" : criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok";

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            headerSeverity === "ok"
              ? "bg-emerald-100 dark:bg-emerald-900/30"
              : headerSeverity === "warning"
                ? "bg-amber-100 dark:bg-amber-900/30"
                : headerSeverity === "critical"
                  ? "bg-orange-100 dark:bg-orange-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
          }`}>
            {atRiskCount === 0
              ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              : <ShieldAlert className={`w-4 h-4 ${
                  headerSeverity === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : headerSeverity === "critical"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-red-600 dark:text-red-400"
                }`} />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Budget Alerts</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {atRiskCount === 0
                ? "All budgets on track 🎉"
                : `${atRiskCount} budget${atRiskCount > 1 ? "s" : ""} need${atRiskCount === 1 ? "s" : ""} attention`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Summary chips */}
          {overCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
              {overCount} over
            </span>
          )}
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
              {warningCount} warning
          </span>
          )}
          <Link
            href="/goals-budgets?tab=budgets"
            className="flex items-center gap-0.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
          >
            Manage <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Budget rows ── */}
      <div className="space-y-3">
        {alerts.map((alert, i) => {
          const cfg = LEVEL_CONFIG[alert.level];
          const barWidth = Math.min(alert.pct, 100);

          return (
            <div key={i} className={`rounded-lg px-3 py-2.5 ${cfg.rowBg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {alert.category}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${cfg.badge}`}>
                    {alert.level === "over" ? `+${alert.pct - 100}% over` : `${alert.pct}%`}
                  </span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className={`text-xs font-bold ${cfg.valueText}`}>
                    {formatCurrency(alert.spent)}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {" "}/ {formatCurrency(alert.budget)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cfg.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Remaining or over-budget hint */}
              <p className="text-[10px] mt-1 text-gray-500 dark:text-gray-400">
                {alert.level === "over"
                  ? `${formatCurrency(alert.spent - alert.budget)} over — reduce spending in this category`
                  : alert.level === "critical"
                    ? `Only ${formatCurrency(alert.remaining)} left — almost at limit`
                    : alert.level === "warning"
                      ? `${formatCurrency(alert.remaining)} remaining — watch your spending`
                      : `${formatCurrency(alert.remaining)} remaining — you're doing great`}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Footer CTA (only when at-risk) ── */}
      {atRiskCount > 0 && (
        <Link
          href="/goals-budgets?tab=budgets"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Review & adjust budgets
        </Link>
      )}
    </div>
  );
}
