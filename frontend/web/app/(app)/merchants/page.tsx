"use client";

// Merchant Analytics — groups all transactions by merchant/payee,
// ranks by total spend, and provides a drill-down per merchant.

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Store, Search, TrendingUp, TrendingDown, Minus, X,
  BarChart3, DollarSign, ShoppingBag, Loader2, ChevronDown,
  ArrowUpDown, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { isAuthenticated, transactionsAPI, type Transaction } from "@/lib/api";
import { PageHeader, PageContent } from "@/components/layouts/PageHeader";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const fmtShort = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

type DayRange = 30 | 90 | 180 | 365 | 0;

function cutoffDate(days: DayRange): Date {
  if (days === 0) return new Date(0);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function merchantKey(t: Transaction): string {
  return (t.merchant?.trim() || t.description?.trim() || "Unknown")
    .replace(/#\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Deterministic avatar colour based on merchant name
const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9", "#3b82f6",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MerchantStat {
  name: string;
  category: string;
  total: number;
  count: number;
  avg: number;
  lastDate: string;
  transactions: Transaction[];
  monthlyData: { month: string; amount: number }[];
  trend: "up" | "down" | "flat";
}

type SortKey = "total" | "count" | "avg" | "lastDate";

// ── Build merchant stats ──────────────────────────────────────────────────────

function buildMerchantStats(
  transactions: Transaction[],
  days: DayRange
): MerchantStat[] {
  const cutoff = cutoffDate(days);

  const expenses = transactions.filter((t) => {
    const isExp = t.type === "expense" || t.type === "EXPENSE";
    if (!isExp) return false;
    const d = new Date(`${(t.date ?? "").slice(0, 10)}T00:00:00`);
    return d >= cutoff;
  });

  // Group by merchant key
  const groups: Record<string, Transaction[]> = {};
  for (const t of expenses) {
    const k = merchantKey(t);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  }

  const stats: MerchantStat[] = Object.entries(groups).map(([name, txns]) => {
    const total = txns.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const count = txns.length;
    const avg = total / count;
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    const lastDate = sorted[sorted.length - 1].date;

    // Monthly breakdown
    const byMonth: Record<string, number> = {};
    for (const t of txns) {
      const m = (t.date ?? "").slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + Math.abs(t.amount ?? 0);
    }
    const monthlyData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        amount: parseFloat(amount.toFixed(2)),
      }));

    // Trend: compare last 2 months
    let trend: MerchantStat["trend"] = "flat";
    if (monthlyData.length >= 2) {
      const last  = monthlyData[monthlyData.length - 1].amount;
      const prev  = monthlyData[monthlyData.length - 2].amount;
      if (last > prev * 1.1)  trend = "up";
      if (last < prev * 0.9)  trend = "down";
    }

    return {
      name,
      category: txns[0].category || "Other",
      total: parseFloat(total.toFixed(2)),
      count,
      avg: parseFloat(avg.toFixed(2)),
      lastDate,
      transactions: sorted.reverse(),
      monthlyData,
      trend,
    };
  });

  return stats.sort((a, b) => b.total - a.total);
}

// ── Trend icon ────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: MerchantStat["trend"] }) {
  if (trend === "up")
    return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  if (trend === "down")
    return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

// ── Drill-down Modal ──────────────────────────────────────────────────────────

function MerchantModal({
  merchant,
  onClose,
}: {
  merchant: MerchantStat;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${avatarColor(merchant.name)}, ${avatarColor(merchant.name)}cc)` }}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-xl">
              {merchant.name[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{merchant.name}</h2>
            <p className="text-white/70 text-xs mt-0.5">{merchant.category}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-extrabold text-white">{fmtShort(merchant.total)}</p>
            <p className="text-white/70 text-xs">{merchant.count} transactions</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Spent",  value: fmt(merchant.total) },
              { label: "Avg / Visit",  value: fmt(merchant.avg) },
              { label: "Visits",       value: String(merchant.count) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          {merchant.monthlyData.length > 1 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Monthly Spend History
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={merchant.monthlyData} barCategoryGap="30%" margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Spent"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="amount" radius={[5, 5, 0, 0]} fill={avatarColor(merchant.name)} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transaction list */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
              All Transactions
            </p>
            <div className="flex flex-col gap-2">
              {merchant.transactions.slice(0, 20).map((t, i) => (
                <div
                  key={t.id ?? i}
                  className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                      {t.description || t.merchant || "Transaction"}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(`${t.date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {fmt(Math.abs(t.amount ?? 0))}
                  </span>
                </div>
              ))}
              {merchant.transactions.length > 20 && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-1">
                  +{merchant.transactions.length - 20} more transactions
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MerchantsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<DayRange>(90);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantStat | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/register?mode=signin"); return; }
    (async () => {
      try {
        const txns = await transactionsAPI.getAll();
        setTransactions(Array.isArray(txns) ? txns : []);
      } catch { /* empty */ } finally { setLoading(false); }
    })();
  }, [router]);

  const stats = useMemo(() => buildMerchantStats(transactions, days), [transactions, days]);

  const visible = useMemo(() => {
    let items = [...stats];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      if (sortKey === "total")    return b.total - a.total;
      if (sortKey === "count")    return b.count - a.count;
      if (sortKey === "avg")      return b.avg - a.avg;
      if (sortKey === "lastDate") return b.lastDate.localeCompare(a.lastDate);
      return 0;
    });
    return items;
  }, [stats, search, sortKey]);

  // Top-10 for bar chart
  const chartData = useMemo(() =>
    stats.slice(0, 10).map((m) => ({
      name: m.name.slice(0, 14),
      total: m.total,
      fullName: m.name,
    }))
  , [stats]);

  const totalSpend    = useMemo(() => stats.reduce((s, m) => s + m.total, 0), [stats]);
  const totalVisits   = useMemo(() => stats.reduce((s, m) => s + m.count, 0), [stats]);
  const topMerchant   = stats[0] ?? null;
  const avgPerVisit   = totalVisits > 0 ? totalSpend / totalVisits : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <PageContent>
          <PageHeader
            title="Merchant Analytics"
            description="See where your money actually goes, broken down by payee."
          />

          {/* ── Hero stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Total Merchants",
                value: String(stats.length),
                sub: `over ${days === 0 ? "all time" : `last ${days} days`}`,
                icon: Store,
                color: "bg-indigo-50 dark:bg-indigo-900/30",
                text: "text-indigo-600 dark:text-indigo-400",
              },
              {
                label: "Total Spend",
                value: fmtShort(totalSpend),
                sub: `${totalVisits} transactions`,
                icon: DollarSign,
                color: "bg-violet-50 dark:bg-violet-900/30",
                text: "text-violet-600 dark:text-violet-400",
              },
              {
                label: "Avg per Visit",
                value: fmtShort(avgPerVisit),
                sub: "across all merchants",
                icon: ShoppingBag,
                color: "bg-amber-50 dark:bg-amber-900/30",
                text: "text-amber-600 dark:text-amber-400",
              },
              {
                label: "Top Merchant",
                value: topMerchant?.name.slice(0, 14) ?? "—",
                sub: topMerchant ? fmtShort(topMerchant.total) + " total" : "No data",
                icon: TrendingUp,
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
                  <p className={`text-xl font-extrabold ${text} truncate`}>{value}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {stats.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-16 text-center">
              <Store className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-base font-bold text-gray-500 dark:text-gray-400">No expense transactions found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto mt-1">
                Add some expenses and they'll appear here grouped by merchant.
              </p>
            </div>
          ) : (
            <>
              {/* ── Top 10 bar chart ── */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Top Merchants by Spend</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Click a bar to drill down</p>
                    </div>
                  </div>
                  {/* Time period selector */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                    {([30, 90, 180, 365, 0] as DayRange[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          days === d
                            ? "bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        }`}
                      >
                        {d === 0 ? "All" : d === 365 ? "1yr" : `${d}d`}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    barCategoryGap="28%"
                    margin={{ top: 4, right: 0, bottom: 0, left: -15 }}
                    onClick={(data) => {
                      if (!data?.activePayload?.[0]) return;
                      const name = data.activePayload[0].payload.fullName;
                      const found = stats.find((m) => m.name === name);
                      if (found) setSelectedMerchant(found);
                    }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(v: number) => [fmt(v), "Total Spent"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                      cursor={{ fill: "rgba(99,102,241,0.06)" }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "#6366f1" : i <= 2 ? "#8b5cf6" : "#c7d2fe"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Search + sort controls ── */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search merchants…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sort by:</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="total">Total Spend</option>
                    <option value="count">Visit Count</option>
                    <option value="avg">Avg per Visit</option>
                    <option value="lastDate">Most Recent</option>
                  </select>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                  {visible.length} merchant{visible.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* ── Merchant table ── */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">Merchant</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1 text-center hidden sm:block">Visits</div>
                  <div className="col-span-2 text-right hidden md:block">Avg / Visit</div>
                  <div className="col-span-1 text-center">Trend</div>
                  <div className="col-span-1 text-right">Last</div>
                </div>

                {/* Rows */}
                {visible.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                    No merchants match your search.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {visible.map((merchant, idx) => (
                      <button
                        key={merchant.name}
                        onClick={() => setSelectedMerchant(merchant)}
                        className="w-full grid grid-cols-12 gap-3 px-5 py-4 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors text-left items-center group"
                      >
                        {/* Rank */}
                        <div className="col-span-1 text-xs font-bold text-gray-300 dark:text-gray-600">
                          {idx + 1}
                        </div>

                        {/* Merchant avatar + name */}
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: avatarColor(merchant.name) }}
                          >
                            <span className="text-white font-extrabold text-sm">
                              {merchant.name[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {merchant.name}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {merchant.category}
                            </p>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="col-span-2 text-right">
                          <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                            {fmtShort(merchant.total)}
                          </span>
                          <div className="w-full mt-1.5 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((merchant.total / (stats[0]?.total || 1)) * 100, 100)}%`,
                                backgroundColor: avatarColor(merchant.name),
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </div>

                        {/* Visits */}
                        <div className="col-span-1 text-center hidden sm:block">
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            {merchant.count}
                          </span>
                        </div>

                        {/* Avg */}
                        <div className="col-span-2 text-right hidden md:block">
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            {fmtShort(merchant.avg)}
                          </span>
                        </div>

                        {/* Trend */}
                        <div className="col-span-1 flex justify-center">
                          <TrendIcon trend={merchant.trend} />
                        </div>

                        {/* Last date */}
                        <div className="col-span-1 text-right">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(`${merchant.lastDate.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
                              month: "short", day: "numeric",
                            })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </PageContent>
      </div>

      {selectedMerchant && (
        <MerchantModal
          merchant={selectedMerchant}
          onClose={() => setSelectedMerchant(null)}
        />
      )}
    </>
  );
}
