"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, ArrowRight, Zap } from "lucide-react";
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
    <div className="ai-card-hover rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Coloured header band */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ background: anomalies.length > 0
          ? 'linear-gradient(to right, #f97316, #ef4444)'
          : 'linear-gradient(to right, #10b981, #14b8a6)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            {anomalies.length > 0
              ? <AlertTriangle className="w-4 h-4 text-white" />
              : <CheckCircle className="w-4 h-4 text-white" />
            }
          </div>
          <h3 className="font-bold text-white text-sm tracking-wide">
            Spending Anomalies
          </h3>
          {anomalies.length > 0 && (
            <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {anomalies.length} found
            </span>
          )}
        </div>
        <Link
          href="/insights"
          className="text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center flex-1">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              All clear this month!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Your spending patterns look normal.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {anomalies.map((insight) => (
              <li
                key={insight.id}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  insight.impact === "high"
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40"
                    : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40"
                }`}
              >
                <Zap
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    insight.impact === "high" ? "text-red-500" : "text-orange-500"
                  }`}
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                    {insight.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {insight.message}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    insight.impact === "high"
                      ? "bg-red-500 text-white"
                      : "bg-orange-400 text-white"
                  }`}
                >
                  {insight.impact === "high" ? "HIGH" : "MED"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
