"use client";

// Subscription Tracker — detects recurring fixed-amount transactions and
// presents them as a subscription management dashboard.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Search, Loader2, DollarSign, Calendar, Zap, ChevronRight,
  XCircle, BarChart3, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { isAuthenticated, transactionsAPI, type Transaction } from "@/lib/api";
import { detectRecurring, type RecurringTransaction } from "@/lib/utils/recurringDetection";
import { PageHeader, PageContent } from "@/components/layouts/PageHeader";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const fmtShort = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function monthlyEquivalent(item: RecurringTransaction): number {
  if (item.frequency === "monthly")   return item.amount;
  if (item.frequency === "biweekly")  return item.amount * 2.17;
  if (item.frequency === "weekly")    return item.amount * 4.33;
  return item.amount;
}

function frequencyLabel(f: RecurringTransaction["frequency"]): string {
  return f === "monthly" ? "Monthly" : f === "biweekly" ? "Biweekly" : "Weekly";
}

function serviceInitial(name: string): string {
  return (name || "?").trim()[0].toUpperCase();
}

// gradient palette for avatars
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-purple-500 to-fuchsia-600",
  "from-cyan-500 to-sky-600",
  "from-green-500 to-emerald-600",
];
function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

// ── Renewal badge ─────────────────────────────────────────────────────────────

function RenewalBadge({ days }: { days: number }) {
  if (days < 0)
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        Overdue
      </span>
    );
  if (days === 0)
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">
        Due today
      </span>
    );
  if (days <= 7)
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
        {days}d left
      </span>
    );
  if (days <= 14)
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
        {days}d left
      </span>
    );
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
      {days}d left
    </span>
  );
}

// ── Subscription Card ─────────────────────────────────────────────────────────

function SubCard({
  item,
  isCandidate,
}: {
  item: RecurringTransaction;
  isCandidate: boolean;
}) {
  const days = daysUntil(item.nextExpected);
  const monthlyAmt = monthlyEquivalent(item);

  return (
    <div className={`relative bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3 ${
      isCandidate ? "border-orange-200 dark:border-orange-800/40" : "border-gray-100 dark:border-gray-700"
    }`}>
      {isCandidate && (
        <div className="absolute top-3 right-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
            Cancel?
          </span>
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGradient(item.merchant)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-extrabold text-base">{serviceInitial(item.merchant)}</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
            {item.merchant}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.category}</p>
        </div>
      </div>

      {/* Amount + frequency */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{fmt(item.amount)}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">
            / {item.frequency === "biweekly" ? "2 wks" : item.frequency === "weekly" ? "wk" : "mo"}
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          item.isSubscription
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        }`}>
          {item.isSubscription ? "Subscription" : frequencyLabel(item.frequency)}
        </span>
      </div>

      {/* Renewal bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Next: {new Date(`${item.nextExpected}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <RenewalBadge days={days} />
        </div>
        <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${days <= 7 ? "bg-red-400" : days <= 14 ? "bg-orange-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.max(0, Math.min(100, 100 - (days / 30) * 100))}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-gray-700/50 pt-2">
        <span>{item.occurrences}× detected</span>
        {item.frequency !== "monthly" && (
          <span className="font-semibold text-gray-600 dark:text-gray-400">
            ≈ {fmtShort(monthlyAmt)}/mo
          </span>
        )}
        {isCandidate && (
          <span className="text-orange-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> No recent activity
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = "all" | "subscriptions" | "payments";

export default function SubscriptionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/register?mode=signin"); return; }
    (async () => {
      try {
        const txns = await transactionsAPI.getAll();
        setTransactions(Array.isArray(txns) ? txns : []);
      } catch { /* empty */ } finally { setLoading(false); }
    })();
  }, [router]);

  const summary = useMemo(() => detectRecurring(transactions), [transactions]);

  // Cancel candidates: last seen > 60 days ago
  const cancelCandidateIds = useMemo(() => {
    const today = new Date();
    return new Set(
      summary.items
        .filter((i) => {
          const last = new Date(`${i.lastDate}T00:00:00`);
          return (today.getTime() - last.getTime()) / 86_400_000 > 60;
        })
        .map((i) => i.merchant)
    );
  }, [summary.items]);

  // Filtered items
  const visible = useMemo(() => {
    let items = summary.items;
    if (filterTab === "subscriptions") items = items.filter((i) => i.isSubscription);
    if (filterTab === "payments")      items = items.filter((i) => !i.isSubscription);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.merchant.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [summary.items, filterTab, search]);

  // Chart: top subscriptions sorted by monthly equivalent
  const chartData = useMemo(() =>
    [...summary.items]
      .filter((i) => i.isSubscription)
      .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
      .slice(0, 8)
      .map((i) => ({ name: i.merchant.slice(0, 12), monthly: parseFloat(monthlyEquivalent(i).toFixed(2)) }))
  , [summary.items]);

  const yearlyProjected = summary.totalMonthlyCommitment * 12;

  const nextRenewal = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = summary.items
      .map((i) => ({ ...i, days: daysUntil(i.nextExpected) }))
      .filter((i) => i.days >= 0)
      .sort((a, b) => a.days - b.days);
    return upcoming[0] ?? null;
  }, [summary.items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <PageContent>
        <PageHeader
          title="Subscription Tracker"
          description="Recurring charges detected from your transaction history."
        />

        {/* ── Hero stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Monthly Cost",
              value: fmtShort(summary.totalMonthlyCommitment),
              sub: `${summary.detectedCount} recurring charges`,
              icon: DollarSign,
              color: "bg-indigo-50 dark:bg-indigo-900/30",
              text: "text-indigo-600 dark:text-indigo-400",
            },
            {
              label: "Subscriptions",
              value: String(summary.totalSubscriptions),
              sub: `${summary.detectedCount - summary.totalSubscriptions} other recurring`,
              icon: RefreshCw,
              color: "bg-violet-50 dark:bg-violet-900/30",
              text: "text-violet-600 dark:text-violet-400",
            },
            {
              label: "Yearly Projected",
              value: fmtShort(yearlyProjected),
              sub: "at current pace",
              icon: TrendingUp,
              color: "bg-amber-50 dark:bg-amber-900/30",
              text: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Next Renewal",
              value: nextRenewal ? (nextRenewal.days === 0 ? "Today" : `In ${nextRenewal.days}d`) : "—",
              sub: nextRenewal?.merchant ?? "No upcoming",
              icon: Clock,
              color: "bg-emerald-50 dark:bg-emerald-900/30",
              text: "text-emerald-600 dark:text-emerald-400",
            },
          ].map(({ label, value, sub, icon: Icon, color, text }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className={`w-5 h-5 ${text}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-extrabold ${text}`}>{value}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {summary.detectedCount === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-16 flex flex-col items-center gap-4 text-center">
            <RefreshCw className="w-12 h-12 text-gray-200 dark:text-gray-700" />
            <p className="text-base font-bold text-gray-500 dark:text-gray-400">No recurring charges detected yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
              Add at least 2 transactions from the same merchant at a regular interval and they'll appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* ── Monthly cost chart ── */}
            {chartData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Monthly Subscription Spend</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Top services by monthly equivalent cost</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), "Monthly"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                    <Bar dataKey="monthly" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#6366f1" : i === 1 ? "#8b5cf6" : "#c7d2fe"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Filter + search bar ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                {(["all", "subscriptions", "payments"] as FilterTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      filterTab === t
                        ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    {t === "all" ? `All (${summary.detectedCount})` :
                     t === "subscriptions" ? `Subscriptions (${summary.totalSubscriptions})` :
                     `Payments (${summary.detectedCount - summary.totalSubscriptions})`}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subscriptions…"
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
                />
              </div>
            </div>

            {/* ── Cards grid ── */}
            {visible.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No results match your filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visible.map((item) => (
                  <SubCard
                    key={item.merchant}
                    item={item}
                    isCandidate={cancelCandidateIds.has(item.merchant)}
                  />
                ))}
              </div>
            )}

            {/* ── Cancel candidates callout ── */}
            {cancelCandidateIds.size > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                      {cancelCandidateIds.size} potential cancel {cancelCandidateIds.size === 1 ? "candidate" : "candidates"}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                      These recurring charges haven't had a transaction in over 60 days. They may be cancelled already or forgotten autopays.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[...cancelCandidateIds].map((name) => (
                        <span
                          key={name}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Summary row ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
              <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 text-center">
                {[
                  { label: "Monthly total",  value: fmtShort(summary.totalMonthlyCommitment) },
                  { label: "Quarterly",      value: fmtShort(summary.totalMonthlyCommitment * 3) },
                  { label: "Yearly",         value: fmtShort(yearlyProjected) },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-1">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </PageContent>
    </div>
  );
}
