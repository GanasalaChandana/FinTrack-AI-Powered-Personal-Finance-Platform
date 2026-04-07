"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Mail, Bell, BellOff, Check, X, RefreshCw, CheckCheck,
  Trash2, Info, AlertTriangle, CheckCircle2, Sparkles,
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  CreditCard, Target, Gift, Repeat, Clock, Filter,
  type LucideIcon,
} from "lucide-react";
import { isAuthenticated, transactionsAPI, type Transaction } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

interface SmartNotification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  read: boolean;
  createdAt: Date;
  icon: LucideIcon;
  category?: string;
  amount?: number;
  tag: string; // human-readable tag shown in filter chips
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const timeAgo = (d: Date): string => {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// ── Notification Generator ────────────────────────────────────────────────────

const NOTIF_STATE_KEY = "fintrack:notif-state";

function loadNotifState(): { read: Set<string>; dismissed: Set<string> } {
  try {
    const raw = localStorage.getItem(NOTIF_STATE_KEY);
    if (raw) {
      const { read, dismissed } = JSON.parse(raw);
      return { read: new Set(read), dismissed: new Set(dismissed) };
    }
  } catch { }
  return { read: new Set(), dismissed: new Set() };
}

function saveNotifState(read: Set<string>, dismissed: Set<string>) {
  try {
    localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify({
      read: [...read], dismissed: [...dismissed],
    }));
  } catch { }
}

function generateNotifications(transactions: Transaction[]): SmartNotification[] {
  if (!transactions.length) return [];

  const now = new Date();
  // Stable slug-based IDs (deterministic from content)
  const mk = (slug: string) => `notif-${slug}`;

  const notifs: SmartNotification[] = [];
  const expenses = transactions.filter(t => t.type === "expense");
  const income   = transactions.filter(t => t.type === "income");

  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

  // ── 1. Welcome / account summary ─────────────────────────────────────────
  notifs.push({
    id: mk("account-summary"), type: "INFO", read: false,
    title: "Account Summary Ready",
    message: `You have ${transactions.length} transactions recorded. Income: ${fmt(totalIncome)} · Expenses: ${fmt(totalExpenses)}.`,
    icon: Sparkles, tag: "Summary",
    createdAt: new Date(now.getTime() - 0),
  });

  // ── 2. Net savings / deficit ──────────────────────────────────────────────
  const net = totalIncome - totalExpenses;
  if (net > 0) {
    notifs.push({
      id: mk("positive-net"), type: "SUCCESS", read: false,
      title: "Positive Net Balance",
      message: `Great news! You have a net surplus of ${fmt(net)} this period. Keep it up!`,
      icon: TrendingUp, tag: "Savings", amount: net,
      createdAt: new Date(now.getTime() - 10 * 60000),
    });
  } else if (net < 0) {
    notifs.push({
      id: mk("spending-exceeds"), type: "WARNING", read: false,
      title: "Spending Exceeds Income",
      message: `Your expenses exceed income by ${fmt(Math.abs(net))}. Review your spending to get back on track.`,
      icon: TrendingDown, tag: "Budget", amount: Math.abs(net),
      createdAt: new Date(now.getTime() - 10 * 60000),
    });
  }

  // ── 3. Income notifications ───────────────────────────────────────────────
  income.slice(0, 2).forEach((t, i) => {
    notifs.push({
      id: mk(`income-${i}`), type: "SUCCESS", read: false,
      title: "Income Received",
      message: `${fmt(t.amount)} credited from ${t.merchant || t.description}${t.category ? ` (${t.category})` : ""}.`,
      icon: DollarSign, tag: "Income", amount: t.amount,
      category: t.category,
      createdAt: new Date(now.getTime() - (20 + i * 15) * 60000),
    });
  });

  // ── 4. Large expense notifications ───────────────────────────────────────
  expenses
    .filter(t => t.amount > 500)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .forEach((t, i) => {
      notifs.push({
        id: mk(`large-expense-${i}`), type: "WARNING", read: false,
        title: "Large Expense Recorded",
        message: `${fmt(t.amount)} charged at ${t.merchant || t.description}${t.category ? ` in ${t.category}` : ""}.`,
        icon: CreditCard, tag: "Expenses", amount: t.amount,
        category: t.category,
        createdAt: new Date(now.getTime() - (45 + i * 20) * 60000),
      });
    });

  // ── 5. Top spending category ──────────────────────────────────────────────
  const catMap: Record<string, number> = {};
  expenses.forEach(t => {
    const c = t.category || "Uncategorized";
    catMap[c] = (catMap[c] || 0) + t.amount;
  });
  const topCats = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  if (topCats.length > 0) {
    const [cat, amt] = topCats[0];
    const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
    notifs.push({
      id: mk("top-category"), type: pct > 40 ? "WARNING" : "INFO", read: false,
      title: "Top Spending Category",
      message: `${cat} is your highest expense category at ${fmt(amt)} (${pct}% of total spending).`,
      icon: ShoppingBag, tag: "Categories", amount: amt,
      category: cat,
      createdAt: new Date(now.getTime() - 2 * 3600000),
    });
  }

  // ── 6. Monthly spending milestone ────────────────────────────────────────
  if (totalExpenses > 1000) {
    notifs.push({
      id: mk("spending-milestone"), type: "INFO", read: false,
      title: "Spending Milestone",
      message: `Your total expenses have reached ${fmt(totalExpenses)}. You've made ${expenses.length} expense transactions.`,
      icon: Target, tag: "Milestones", amount: totalExpenses,
      createdAt: new Date(now.getTime() - 2.5 * 3600000),
    });
  }

  // ── 7. Recurring merchant detected ───────────────────────────────────────
  const merchantMap: Record<string, number> = {};
  expenses.forEach(t => {
    const key = t.merchant || t.description;
    merchantMap[key] = (merchantMap[key] || 0) + 1;
  });
  Object.entries(merchantMap)
    .filter(([, c]) => c >= 3)
    .slice(0, 2)
    .forEach(([merchant, count], i) => {
      notifs.push({
        id: mk(`recurring-${merchant.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}`), type: "INFO", read: false,
        title: "Recurring Transaction Detected",
        message: `You've transacted ${count}× at ${merchant}. This looks like a subscription or regular habit.`,
        icon: Repeat, tag: "Recurring",
        createdAt: new Date(now.getTime() - (3 + i * 0.5) * 3600000),
      });
    });

  // ── 8. Category count summary ─────────────────────────────────────────────
  const uniqueCats = Object.keys(catMap).length;
  if (uniqueCats >= 3) {
    notifs.push({
      id: mk("spending-diversified"), type: "INFO", read: false,
      title: "Spending Diversified Across Categories",
      message: `Your expenses are spread across ${uniqueCats} categories. Top 3: ${topCats.slice(0, 3).map(([c]) => c).join(", ")}.`,
      icon: Filter, tag: "Summary",
      createdAt: new Date(now.getTime() - 4 * 3600000),
    });
  }

  // ── 9. Savings rate if positive ───────────────────────────────────────────
  if (totalIncome > 0 && net > 0) {
    const rate = Math.round((net / totalIncome) * 100);
    notifs.push({
      id: mk("savings-rate"), type: "SUCCESS", read: false,
      title: rate >= 20 ? "Excellent Savings Rate! 🎉" : "Good Savings Progress",
      message: `You're saving ${rate}% of income (${fmt(net)}). ${rate >= 20 ? "You're well above the recommended 20% savings benchmark!" : "Aim for 20% to build a strong financial cushion."}`,
      icon: Gift, tag: "Savings", amount: net,
      createdAt: new Date(now.getTime() - 5 * 3600000),
    });
  }

  // ── Sort by date desc (newest first), then stagger slightly ──────────────
  return notifs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((n, i) => ({ ...n, read: i > 3 })); // first 4 start as unread
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotifType, {
  border: string; iconBg: string; iconColor: string;
  badgeBg: string; badgeText: string; label: string;
}> = {
  SUCCESS: {
    border: "border-l-emerald-400", iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-100", badgeText: "text-emerald-700", label: "Success",
  },
  WARNING: {
    border: "border-l-amber-400", iconBg: "bg-amber-50", iconColor: "text-amber-600",
    badgeBg: "bg-amber-100", badgeText: "text-amber-700", label: "Warning",
  },
  ERROR: {
    border: "border-l-red-400", iconBg: "bg-red-50", iconColor: "text-red-600",
    badgeBg: "bg-red-100", badgeText: "text-red-700", label: "Error",
  },
  INFO: {
    border: "border-l-blue-400", iconBg: "bg-blue-50", iconColor: "text-blue-600",
    badgeBg: "bg-blue-100", badgeText: "text-blue-600", label: "Info",
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [isAuth, setIsAuth]             = useState(false);
  const [isCheckingAuth, setChecking]   = useState(true);
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter]     = useState<"all" | NotifType>("all");
  const [tagFilter, setTagFilter]       = useState<string>("all");
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/register?mode=signin");
    } else {
      setIsAuth(true);
      setChecking(false);
    }
  }, [router]);

  // ── Fetch & generate ──────────────────────────────────────────────────────
  const fetchAndGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const txns = await transactionsAPI.getAll();
      const { read, dismissed } = loadNotifState();
      const generated = generateNotifications(txns)
        .filter(n => !dismissed.has(n.id))
        .map(n => ({ ...n, read: read.has(n.id) }));
      setNotifications(generated);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuth) void fetchAndGenerate();
  }, [isAuth, fetchAndGenerate]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const allTags     = useMemo(() => ["all", ...new Set(notifications.map(n => n.tag))], [notifications]);

  const filtered = useMemo(() => notifications.filter(n => {
    const readOk = filter === "all" || (filter === "unread" ? !n.read : n.read);
    const typeOk = typeFilter === "all" || n.type === typeFilter;
    const tagOk  = tagFilter === "all" || n.tag === tagFilter;
    return readOk && typeOk && tagOk;
  }), [notifications, filter, typeFilter, tagFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = (id: string) => {
    setNotifications(p => {
      const next = p.map(n => n.id === id ? { ...n, read: true } : n);
      const { read, dismissed } = loadNotifState();
      read.add(id);
      saveNotifState(read, dismissed);
      return next;
    });
  };
  const dismiss = (id: string) => {
    setNotifications(p => {
      const next = p.filter(n => n.id !== id);
      const { read, dismissed } = loadNotifState();
      dismissed.add(id);
      saveNotifState(read, dismissed);
      return next;
    });
  };
  const markAllRead = () => {
    setNotifications(p => {
      const next = p.map(n => ({ ...n, read: true }));
      const { dismissed } = loadNotifState();
      const read = new Set(next.map(n => n.id));
      saveNotifState(read, dismissed);
      return next;
    });
  };
  const clearAll = () => {
    if (confirm("Clear all notifications?")) {
      const { read, dismissed } = loadNotifState();
      notifications.forEach(n => dismissed.add(n.id));
      saveNotifState(read, dismissed);
      setNotifications([]);
    }
  };

  // ── Loading / Auth ─────────────────────────────────────────────────────────
  if (isCheckingAuth || !isAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Inbox</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Notifications</h1>
            <p className="text-sm text-gray-400 mt-1">
              {loading
                ? "Loading your notifications…"
                : unreadCount > 0
                  ? `${unreadCount} unread · ${notifications.length} total · Updated ${lastUpdated ? timeAgo(lastUpdated) : "—"}`
                  : notifications.length > 0
                    ? `All caught up 🎉 · Updated ${lastUpdated ? timeAgo(lastUpdated) : "—"}`
                    : "No notifications yet"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => void fetchAndGenerate()} disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition">
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        {notifications.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {([
              { label: "Total",   value: notifications.length,                        color: "text-gray-900", bg: "bg-white" },
              { label: "Unread",  value: unreadCount,                                 color: "text-blue-600",  bg: "bg-blue-50" },
              { label: "Success", value: notifications.filter(n=>n.type==="SUCCESS").length, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Warning", value: notifications.filter(n=>n.type==="WARNING").length, color: "text-amber-600",   bg: "bg-amber-50" },
            ] as const).map(s => (
              <div key={s.label} className={`rounded-3xl border border-gray-100 ${s.bg} p-4 text-center shadow-sm`}>
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Read filter */}
          <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 w-fit">
            {(["all", "unread", "read"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                  filter === f ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
                }`}>
                {f}
                {f === "unread" && unreadCount > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filter === "unread" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"
                  }`}>{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tag chips */}
          {allTags.length > 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              {allTags.map(tag => (
                <button key={tag} onClick={() => setTagFilter(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    tagFilter === tag
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}>
                  {tag === "all" ? "All Topics" : tag}
                </button>
              ))}
            </div>
          )}

          {/* Type chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "SUCCESS", "WARNING", "INFO", "ERROR"] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  typeFilter === t
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {t === "all" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Notification list ────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-semibold">Generating notifications…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-red-700 mb-1">Failed to load</p>
            <p className="text-xs text-red-500 mb-4">{error}</p>
            <button onClick={() => void fetchAndGenerate()}
              className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition">
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-blue-300" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">No Transactions Found</h3>
            <p className="text-sm text-gray-400">Add transactions first — notifications are generated from your spending data.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">No matches</h3>
            <p className="text-sm text-gray-400">Try clearing your filters.</p>
            <button onClick={() => { setFilter("all"); setTypeFilter("all"); setTagFilter("all"); }}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(notif => {
              const cfg = TYPE_CONFIG[notif.type];
              const Icon = notif.icon;
              return (
                <div key={notif.id}
                  className={`group bg-white rounded-3xl border border-l-4 border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${cfg.border} ${
                    notif.read ? "opacity-70" : ""
                  }`}>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                        <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-sm font-bold ${notif.read ? "text-gray-500" : "text-gray-900"}`}>
                              {notif.title}
                            </h4>
                            {/* Type badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                              {cfg.label}
                            </span>
                            {/* Tag */}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {notif.tag}
                            </span>
                            {/* Unread dot */}
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>

                          {/* Actions — visible on hover */}
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notif.read && (
                              <button onClick={() => markRead(notif.id)} title="Mark as read"
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            )}
                            <button onClick={() => dismiss(notif.id)} title="Dismiss"
                              className="p-1.5 rounded-lg hover:bg-red-50 transition">
                              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className={`text-sm mt-1 leading-relaxed ${notif.read ? "text-gray-400" : "text-gray-600"}`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {notif.amount && (
                            <span className={`text-xs font-bold ${cfg.iconColor}`}>{fmt(notif.amount)}</span>
                          )}
                          {notif.category && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {notif.category}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-gray-300">
                            <Clock className="w-3 h-3" />
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer summary ───────────────────────────────────────────────── */}
        {!loading && notifications.length > 0 && (
          <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
            <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#3b82f6,#6366f1,#8b5cf6)" }} />
            <div className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Notification Summary</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong>{notifications.length} notifications</strong> generated from your transaction history.{" "}
                  {unreadCount > 0
                    ? <span className="text-blue-600 font-semibold">{unreadCount} unread. </span>
                    : <span className="text-emerald-600 font-semibold">All caught up! </span>}
                  Notifications refresh automatically with each new transaction.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}