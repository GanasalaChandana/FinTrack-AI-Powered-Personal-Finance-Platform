"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, TrendingUp, ArrowRight } from "lucide-react";
import { Transaction } from "@/lib/api";
import { generateAIInsights } from "@/lib/utils/aiInsights";

interface Props {
  transactions: Transaction[];
}

export function AnomalyInsightsCard({ transactions }: Props) {
  const anomalies = useMemo(() => {
    if (!transactions.length) return [];
    const insights = generateAIInsights(transactions as any);
    return insights
      .filter((i) => i.type === "warning" && (i.impact === "high" || i.impact === "medium"))
      .slice(0, 3);
  }, [transactions]);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30">
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            Spending Anomalies
          </h3>
        </div>
        <Link
          href="/insights"
          className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            No anomalies detected
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your spending patterns look normal this period.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {anomalies.map((insight) => (
            <li
              key={insight.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40"
            >
              <AlertTriangle
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  insight.impact === "high"
                    ? "text-red-500"
                    : "text-orange-400"
                }`}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {insight.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {insight.message}
                </p>
              </div>
              <span
                className={`ml-auto flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  insight.impact === "high"
                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    : "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                }`}
              >
                {insight.impact.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
