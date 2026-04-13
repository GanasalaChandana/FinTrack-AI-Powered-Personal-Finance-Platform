"use client";

import { useMemo } from "react";
import { Bell, ExternalLink, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { type Transaction } from "@/lib/api";
import { detectRecurring } from "@/lib/utils/recurringDetection";

interface Props {
  transactions: Transaction[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(v);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Urgency tier config ─────────────────────────────────────────────────────

interface UrgencyConfig {
  label: string;
  rowBg: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  Icon: React.ElementType;
}

function getUrgency(days: number): UrgencyConfig {
  if (days < 0)
    return {
      label: "Overdue",
      rowBg: "bg-red-50 dark:bg-red-900/20",
      badgeBg: "bg-red-100 dark:bg-red-900/40",
      badgeText: "text-red-700 dark:text-red-400",
      dotColor: "bg-red-500",
      Icon: AlertCircle,
    };
  if (days === 0)
    return {
      label: "Today",
      rowBg: "bg-red-50 dark:bg-red-900/20",
      badgeBg: "bg-red-100 dark:bg-red-900/40",
      badgeText: "text-red-700 dark:text-red-400",
      dotColor: "bg-red-500",
      Icon: AlertCircle,
    };
  if (days <= 3)
    return {
      label: `${days}d`,
      rowBg: "bg-orange-50 dark:bg-orange-900/20",
      badgeBg: "bg-orange-100 dark:bg-orange-900/40",
      badgeText: "text-orange-700 dark:text-orange-400",
      dotColor: "bg-orange-500",
      Icon: AlertCircle,
    };
  if (days <= 7)
    return {
      label: `${days}d`,
      rowBg: "bg-amber-50 dark:bg-amber-900/20",
      badgeBg: "bg-amber-100 dark:bg-amber-900/40",
      badgeText: "text-amber-700 dark:text-amber-400",
      dotColor: "bg-amber-400",
      Icon: Clock,
    };
  if (days <= 14)
    return {
      label: `${days}d`,
      rowBg: "bg-blue-50 dark:bg-blue-900/20",
      badgeBg: "bg-blue-100 dark:bg-blue-900/40",
      badgeText: "text-blue-700 dark:text-blue-400",
      dotColor: "bg-blue-400",
      Icon: Clock,
    };
  return {
    label: `${days}d`,
    rowBg: "bg-gray-50 dark:bg-gray-700/30",
    badgeBg: "bg-gray-100 dark:bg-gray-700",
    badgeText: "text-gray-600 dark:text-gray-400",
    dotColor: "bg-gray-400",
    Icon: CheckCircle2,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BillRemindersCard({ transactions }: Props) {
  const { bills, totalMonthly, overdueCount, dueThisWeek } = useMemo(() => {
    const summary = detectRecurring(transactions);

    const enriched = summary.items
      .map((item) => ({ ...item, days: daysUntil(item.nextExpected) }))
      .filter((item) => item.days <= 30) // within 30 days (including overdue)
      .sort((a, b) => a.days - b.days)
      .slice(0, 8); // max 8 items

    return {
      bills: enriched,
      totalMonthly: summary.totalMonthlyCommitment,
      overdueCount: enriched.filter((b) => b.days < 0).length,
      dueThisWeek: enriched.filter((b) => b.days >= 0 && b.days <= 7).length,
    };
  }, [transactions]);

  if (bills.length === 0) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {overdueCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Upcoming Bills</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {overdueCount > 0
                ? `${overdueCount} overdue · ${dueThisWeek} due this week`
                : dueThisWeek > 0
                  ? `${dueThisWeek} due this week`
                  : "Next 30 days"}
            </p>
          </div>
        </div>

        <Link
          href="/recurring"
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Bill grid (2 columns) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bills.map((bill, i) => {
          const urgency = getUrgency(bill.days);
          const UrgencyIcon = urgency.Icon;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${urgency.rowBg} transition-colors`}
            >
              {/* Merchant avatar */}
              <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0 shadow-sm">
                {bill.merchant.charAt(0).toUpperCase()}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {bill.merchant}
                  </span>
                  {bill.isSubscription && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                      Sub
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {formatDate(bill.nextExpected)} · <span className="capitalize">{bill.frequency}</span>
                </p>
              </div>

              {/* Amount */}
              <span className="text-xs font-bold text-gray-800 dark:text-gray-100 flex-shrink-0">
                {formatCurrency(bill.amount)}
              </span>

              {/* Urgency badge */}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 flex items-center gap-0.5 ${urgency.badgeBg} ${urgency.badgeText}`}
              >
                <UrgencyIcon className="w-2.5 h-2.5" />
                {urgency.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {bills.length}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">upcoming</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {overdueCount}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">overdue</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalMonthly)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">monthly</p>
        </div>
      </div>
    </div>
  );
}
