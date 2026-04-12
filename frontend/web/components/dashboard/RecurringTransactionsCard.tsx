"use client";

import React, { useMemo } from "react";
import { RefreshCw, Zap, Calendar, TrendingDown, AlertCircle } from "lucide-react";
import { Transaction } from "@/lib/api";
import { detectRecurring, RecurringTransaction } from "@/lib/utils/recurringDetection";

interface Props {
  transactions: Transaction[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function frequencyLabel(freq: RecurringTransaction["frequency"]): string {
  return freq === "monthly" ? "Monthly" : freq === "biweekly" ? "Bi-weekly" : "Weekly";
}

function frequencyColor(freq: RecurringTransaction["frequency"]): string {
  return freq === "monthly"
    ? "bg-blue-100 text-blue-700"
    : freq === "biweekly"
    ? "bg-purple-100 text-purple-700"
    : "bg-orange-100 text-orange-700";
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function RecurringTransactionsCard({ transactions }: Props) {
  const summary = useMemo(() => detectRecurring(transactions), [transactions]);

  if (summary.detectedCount === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <RefreshCw className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recurring Transactions</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-detected subscriptions & bills</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Not enough data yet. Add more transactions to detect patterns.
          </p>
        </div>
      </div>
    );
  }

  const topItems = summary.items.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <RefreshCw className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recurring Transactions</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-detected subscriptions & bills</p>
          </div>
        </div>
        <span className="text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-700">
          {summary.detectedCount} detected
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Monthly Commitment</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.totalMonthlyCommitment)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Subscriptions</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {summary.totalSubscriptions}
          </p>
        </div>
      </div>

      {/* Recurring Items List */}
      <div className="space-y-2">
        {topItems.map((item, idx) => {
          const daysLeft = daysUntil(item.nextExpected);
          const isDueSoon = daysLeft >= 0 && daysLeft <= 5;

          return (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Left: icon + name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {item.merchant.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {item.merchant}
                    </p>
                    {item.isSubscription && (
                      <span title="Subscription">
                        <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${frequencyColor(item.frequency)}`}>
                      {frequencyLabel(item.frequency)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {item.occurrences}x detected
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: amount + next date */}
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(item.amount)}
                </p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs ${isDueSoon ? "text-orange-500 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
                    {daysLeft < 0
                      ? "Overdue"
                      : daysLeft === 0
                      ? "Due today"
                      : `in ${daysLeft}d`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {summary.detectedCount > 5 && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
          +{summary.detectedCount - 5} more recurring transactions detected
        </p>
      )}
    </div>
  );
}
