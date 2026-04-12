"use client";

import { useState, useEffect, useMemo } from "react";
import {
  RefreshCw, Calendar, DollarSign, TrendingUp, Check,
  Eye, Plus, Trash2, ChevronDown, ChevronUp, Clock, AlertCircle, Zap,
} from "lucide-react";
import {
  detectRecurringTransactions,
  createRecurringRule,
  type Transaction,
  type RecurringTransaction,
} from "@/lib/utils/recurringDetector";

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecurringTransactionsDashboardProps {
  transactions: Transaction[];
  onCreateRule?: (rule: any) => void;
  onDeleteRecurring?: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQ_STYLES: Record<string, { accentBar: string; iconBg: string; iconText: string; pillBg: string; pillText: string }> = {
  weekly:    { accentBar: "bg-indigo-500",  iconBg: "bg-indigo-50",  iconText: "text-indigo-600",  pillBg: "bg-indigo-50",  pillText: "text-indigo-700" },
  biweekly:  { accentBar: "bg-violet-500",  iconBg: "bg-violet-50",  iconText: "text-violet-600",  pillBg: "bg-violet-50",  pillText: "text-violet-700" },
  monthly:   { accentBar: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600", pillBg: "bg-emerald-50", pillText: "text-emerald-700" },
  quarterly: { accentBar: "bg-amber-400",   iconBg: "bg-amber-50",   iconText: "text-amber-600",   pillBg: "bg-amber-50",   pillText: "text-amber-700" },
  yearly:    { accentBar: "bg-rose-400",    iconBg: "bg-rose-50",    iconText: "text-rose-600",    pillBg: "bg-rose-50",    pillText: "text-rose-700" },
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly",
  quarterly: "Quarterly", yearly: "Yearly",
};

/** Convert any frequency amount to monthly equivalent */
function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":    return amount * 4.33;
    case "biweekly":  return amount * 2.17;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
    default:          return amount; // monthly
  }
}

/** Days until next expected date (negative = overdue) */
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function NextDateBadge({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  const label =
    days < 0  ? `${Math.abs(days)}d overdue` :
    days === 0 ? "Due today" :
    days === 1 ? "Due tomorrow" :
                 `In ${days}d`;

  const cls =
    days < 0  ? "bg-red-50 text-red-700 border-red-200" :
    days <= 3  ? "bg-amber-50 text-amber-700 border-amber-200" :
                 "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <Calendar className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

const FILTER_OPTIONS = [
  { value: "all",       label: "All" },
  { value: "weekly",    label: "Weekly" },
  { value: "biweekly",  label: "Biweekly" },
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly",    label: "Yearly" },
] as const;

type FilterValue = typeof FILTER_OPTIONS[number]["value"];

// ── Component ─────────────────────────────────────────────────────────────────

export function RecurringTransactionsDashboard({
  transactions,
  onCreateRule,
  onDeleteRecurring,
}: RecurringTransactionsDashboardProps) {
  const [recurring, setRecurring]   = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter]         = useState<FilterValue>("all");
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());

  useEffect(() => {
    if (transactions.length === 0) { setIsLoading(false); return; }
    setIsLoading(true);
    // Small timeout so the spinner is visible and doesn't flash
    const t = setTimeout(() => {
      setRecurring(detectRecurringTransactions(transactions, 2, 0.5));
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [transactions]);

  const visible = useMemo(
    () => recurring.filter((r) => !dismissed.has(r.id)),
    [recurring, dismissed]
  );

  const filtered = useMemo(
    () => filter === "all" ? visible : visible.filter((r) => r.pattern.frequency === filter),
    [visible, filter]
  );

  // ── Derived stats ──────────────────────────────────────────────────────────

  const monthlyExpenses = useMemo(
    () => visible
      .filter((r) => r.pattern.type === "EXPENSE")
      .reduce((s, r) => s + toMonthly(r.pattern.amount, r.pattern.frequency), 0),
    [visible]
  );

  const annualExpenses = monthlyExpenses * 12;

  const potentialSavings = useMemo(
    () => visible.reduce((s, r) => s + (r.savings ?? 0), 0),
    [visible]
  );

  const subscriptions = useMemo(
    () => visible.filter((r) => r.isSubscription),
    [visible]
  );

  const subscriptionMonthlyCost = useMemo(
    () => subscriptions
      .filter((r) => r.pattern.type === "EXPENSE")
      .reduce((s, r) => s + toMonthly(r.pattern.amount, r.pattern.frequency), 0),
    [subscriptions]
  );

  // ── Upcoming (next 7 days) ─────────────────────────────────────────────────
  const upcomingSoon = useMemo(
    () => visible.filter((r) => { const d = daysUntil(r.nextExpectedDate); return d >= 0 && d <= 7; }),
    [visible]
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-gray-800 mb-1">Analysing Transactions…</h3>
        <p className="text-sm text-gray-400">Detecting recurring patterns in {transactions.length} transactions</p>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (recurring.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6)" }} />
        <div className="p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-2">No Recurring Transactions Found</h3>
          <p className="text-sm text-gray-400 mb-5">
            Analysed {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} — no recurring patterns yet.
          </p>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-left max-w-sm mx-auto">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Tips for Detection</p>
            <ul className="space-y-1 text-xs text-indigo-700">
              <li className="flex items-start gap-2"><span>•</span>Add at least 3 similar transactions</li>
              <li className="flex items-start gap-2"><span>•</span>Transactions should occur regularly (weekly, monthly…)</li>
              <li className="flex items-start gap-2"><span>•</span>Amounts should be relatively consistent</li>
              <li className="flex items-start gap-2"><span>•</span>Descriptions should be similar</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Recurring Detected", sub: `${visible.length} pattern${visible.length !== 1 ? "s" : ""}`,
            value: String(visible.length),
            icon: RefreshCw, iconBg: "bg-indigo-50", iconText: "text-indigo-600", valueCls: "text-gray-900",
          },
          {
            label: "Monthly Cost", sub: `$${annualExpenses.toFixed(0)}/year`,
            value: fmt(monthlyExpenses),
            icon: DollarSign, iconBg: "bg-violet-50", iconText: "text-violet-600", valueCls: "text-gray-900",
          },
          {
            label: "Subscriptions", sub: `${fmt(subscriptionMonthlyCost)}/mo`,
            value: String(subscriptions.length),
            icon: Zap, iconBg: "bg-yellow-50", iconText: "text-yellow-600", valueCls: "text-gray-900",
          },
          {
            label: "Potential Savings", sub: "If all cancelled/year",
            value: fmt(potentialSavings),
            icon: TrendingUp, iconBg: "bg-emerald-50", iconText: "text-emerald-600",
            valueCls: potentialSavings > 0 ? "text-emerald-600" : "text-gray-400",
          },
        ].map((card) => (
          <div key={card.label}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
              <card.icon className={`w-5 h-5 ${card.iconText}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider leading-tight truncate">{card.label}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
              <p className={`text-2xl font-extrabold tracking-tight mt-0.5 ${card.valueCls}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Subscription Spotlight ── */}
      {subscriptions.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-bold text-yellow-800">
              Subscriptions Detected — {fmt(subscriptionMonthlyCost)}/mo · {fmt(subscriptionMonthlyCost * 12)}/yr
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {subscriptions.map((s) => (
              <div key={s.id}
                className="flex items-center gap-1.5 bg-white border border-yellow-200 rounded-full px-3 py-1 shadow-sm">
                <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                  {s.pattern.description.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-gray-800 truncate max-w-[100px]">
                  {s.pattern.description}
                </span>
                <span className="text-xs font-bold text-red-500">{fmt(s.pattern.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming alert banner ── */}
      {upcomingSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {upcomingSoon.length} payment{upcomingSoon.length > 1 ? "s" : ""} due in the next 7 days
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {upcomingSoon.map((r) => `${r.pattern.description} (${fmt(r.pattern.amount)})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex gap-1 overflow-x-auto">
        {FILTER_OPTIONS.map((f) => {
          const count = f.value === "all"
            ? visible.length
            : visible.filter((r) => r.pattern.frequency === f.value).length;
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                filter === f.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
              }`}>
              {f.label}
              {count > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  filter === f.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Recurring list ── */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const freq = item.pattern.frequency;
          const st = FREQ_STYLES[freq] ?? FREQ_STYLES.monthly;
          const isExpanded = expandedId === item.id;
          const confidencePct = Math.round(item.confidence * 100);
          const days = daysUntil(item.nextExpectedDate);
          const isOverdue = days < 0;

          return (
            <div key={item.id}
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${
                isOverdue ? "border-red-200" : "border-gray-100"
              }`}>
              <div className={`h-1 w-full ${st.accentBar}`} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${st.iconBg}`}>
                      <RefreshCw className={`w-5 h-5 ${st.iconText}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{item.pattern.description}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${st.pillBg} ${st.pillText}`}>
                          {FREQ_LABELS[freq] ?? freq}
                        </span>
                        {item.isSubscription && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 flex-shrink-0">
                            <Zap className="w-2.5 h-2.5" />
                            Subscription
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.pattern.category} · {item.transactions.length} occurrence{item.transactions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-extrabold text-gray-900">{fmt(item.pattern.amount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">≈ {fmt(toMonthly(item.pattern.amount, freq))}/mo</p>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <NextDateBadge dateStr={item.nextExpectedDate} />

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    confidencePct >= 80 ? "bg-emerald-50 text-emerald-700" :
                    confidencePct >= 60 ? "bg-amber-50 text-amber-700" :
                                         "bg-gray-100 text-gray-500"
                  }`}>
                    {confidencePct}% confidence
                  </span>

                  {item.pattern.dayOfWeek !== undefined && (
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-500" />
                      {DAYS[item.pattern.dayOfWeek]}s
                    </span>
                  )}

                  {item.pattern.dayOfMonth !== undefined && (
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-500" />
                      Day {item.pattern.dayOfMonth}
                    </span>
                  )}

                  {(item.savings ?? 0) > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Save {fmt(item.savings!)}/yr if cancelled
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-100 text-xs font-bold text-gray-600 hover:bg-slate-50 hover:border-gray-200 transition-all">
                    <Eye className="w-3.5 h-3.5" />
                    History
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {onCreateRule && (
                    <button
                      onClick={() => onCreateRule(createRecurringRule(item))}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 hover:-translate-y-0.5 transition-all">
                      <Plus className="w-3.5 h-3.5" />
                      Create Rule
                    </button>
                  )}

                  <button
                    onClick={() => setDismissed((p) => new Set([...p, item.id]))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-100 text-xs font-bold text-gray-400 hover:text-gray-600 hover:border-gray-200 transition-all">
                    Dismiss
                  </button>

                  {onDeleteRecurring && (
                    <button
                      onClick={() => onDeleteRecurring(item.id)}
                      className="p-2 rounded-xl border-2 border-gray-100 text-gray-300 hover:text-red-400 hover:border-red-100 hover:bg-red-50 transition-all ml-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Transaction history */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Transaction History</p>

                    {/* Mini bar chart of amounts */}
                    {item.transactions.length > 1 && (() => {
                      const amounts = item.transactions.map((t) => t.amount);
                      const maxAmt  = Math.max(...amounts);
                      return (
                        <div className="flex items-end gap-1 h-10 mb-3">
                          {amounts.map((amt, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className={`w-full rounded-sm transition-all ${st.accentBar} opacity-70`}
                                style={{ height: `${Math.max(4, (amt / maxAmt) * 36)}px` }}
                                title={fmt(amt)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {[...item.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((txn) => (
                        <div key={txn.id}
                          className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-2xl text-sm">
                          <div className="flex items-center gap-2.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600">
                              {new Date(txn.date).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </span>
                          </div>
                          <span className="font-bold text-gray-900">{fmt(txn.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty filtered state */}
        {filtered.length === 0 && visible.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
            <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">
              No {filter === "all" ? "" : filter + " "}recurring transactions.
            </p>
            <button onClick={() => setFilter("all")}
              className="mt-2 text-xs font-bold text-indigo-500 hover:underline">View all</button>
          </div>
        )}
      </div>
    </div>
  );
}