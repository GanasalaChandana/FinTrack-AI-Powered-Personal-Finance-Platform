"use client";

import { useMemo } from "react";
import { BarChart3, CheckCircle, AlertCircle } from "lucide-react";
import { Transaction, Budget } from "@/lib/api";
import { forecastCurrentMonth } from "@/lib/utils/budgetForecast";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
}

export function BudgetForecastCard({ transactions, budgets }: Props) {
  const forecast = useMemo(
    () => forecastCurrentMonth(transactions, budgets),
    [transactions, budgets]
  );

  const hasBudgets = budgets.length > 0;
  const overallPct = forecast.budgetTotal > 0
    ? Math.min((forecast.projectedTotal / forecast.budgetTotal) * 100, 200)
    : 0;

  const progressColor =
    overallPct > 100
      ? "bg-red-500"
      : overallPct > 80
      ? "bg-orange-400"
      : "bg-emerald-500";

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          Month-End Forecast
        </h3>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {forecast.daysRemaining}d left
        </span>
      </div>

      {!hasBudgets ? (
        <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
          <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Set budgets to see forecasts
          </p>
        </div>
      ) : (
        <>
          {/* Overall projection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Projected spend</span>
              <span className={overallPct > 100 ? "text-red-500 font-semibold" : "text-gray-700 dark:text-gray-300"}>
                ${forecast.projectedTotal.toFixed(0)} / ${forecast.budgetTotal.toFixed(0)}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${Math.min(overallPct, 100)}%` }}
              />
            </div>
          </div>

          {/* Status badge */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              forecast.onTrack
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            {forecast.onTrack ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {forecast.onTrack
              ? `On track — projected $${Math.abs(forecast.surplus).toFixed(0)} surplus`
              : `At risk — projected $${Math.abs(forecast.surplus).toFixed(0)} over budget`}
          </div>

          {/* Categories at risk */}
          {forecast.categoriesAtRisk.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Categories at risk
              </p>
              {forecast.categoriesAtRisk.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className="text-xs text-gray-700 dark:text-gray-300 w-28 truncate">
                    {cat.category}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${Math.min(cat.percentageUsed, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-red-500 font-semibold w-10 text-right">
                    {cat.percentageUsed.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
