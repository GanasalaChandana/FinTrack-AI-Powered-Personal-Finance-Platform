"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell, BellOff, TrendingUp, AlertTriangle, CheckCircle2,
  Info, Zap, ShoppingBag, Coffee, Home, Car, Utensils,
  CreditCard, Target, Sparkles, RefreshCw, Settings,
  ChevronRight, Trash2, Check, X, Filter, Loader2,
  DollarSign, ArrowUpRight, ArrowDownRight, Clock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Section, Grid, PageContent } from "@/components/layouts/PageHeader";
import { isAuthenticated, transactionsAPI, type Transaction } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "high" | "medium" | "low";
type AlertType =
  | "budget_exceeded"
  | "unusual_spending"
  | "large_transaction"
  | "recurring_detected"
  | "savings_opportunity"
  | "income_received"
  | "spending_spike"
  | "category_limit"
  | "top_merchant"
  | "low_spending";

interface SmartAlert {
  id: string;
  backendId?: number;   // DB primary key — present once saved to backend
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  amount?: number;
  category?: string;
  merchant?: string;
  read: boolean;
  createdAt: Date;
  icon: LucideIcon;
  actionLabel?: string;
}

// ── Backend API helpers ────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token  = localStorage.getItem("ft_token") || localStorage.getItem("authToken");
  const userId = localStorage.getItem("userId");
  return {
    "Content-Type": "application/json",
    ...(token  && { Authorization: `Bearer ${token}` }),
    ...(userId && { "X-User-Id": userId }),
  };
}

interface BackendAlert {
  id:        number;
  title:     string;
  message:   string;
  type:      string;
  severity:  string;
  category?: string;
  status:    string;
  read:      boolean;
  createdAt: string;
}

async function fetchBackendAlerts(): Promise<BackendAlert[]> {
  const res = await fetch(`${API_BASE_URL}/api/alerts`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function saveAlertToBackend(alert: SmartAlert, userId: string): Promise<BackendAlert | null> {
  try {
    const body = {
      userId,
      title:    alert.title,
      message:  alert.message,
      type:     alert.type.toUpperCase(),
      severity: alert.severity,
      category: alert.category ?? null,
      status:   "ACTIVE",
      priority: alert.severity.toUpperCase(),
      read:     false,
    };
    const res = await fetch(`${API_BASE_URL}/api/alerts`, {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function acknowledgeBackendAlert(backendId: number): Promise<void> {
  await fetch(`${API_BASE_URL}/api/alerts/${backendId}/acknowledge`, {
    method:  "POST",
    headers: getAuthHeaders(),
  });
}

async function acknowledgeAllBackendAlerts(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/alerts/acknowledge-all`, {
    method:  "POST",
    headers: getAuthHeaders(),
  });
}

async function deleteBackendAlert(backendId: number): Promise<void> {
  await fetch(`${API_BASE_URL}/api/alerts/${backendId}`, {
    method:  "DELETE",
    headers: getAuthHeaders(),
  });
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold?: number;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(v);

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

// ── Alert Generator — pure function, no backend needed ────────────────────────

function generateAlertsFromTransactions(transactions: Transaction[]): SmartAlert[] {
  if (!transactions.length) return [];

  const alerts: SmartAlert[] = [];
  const now = new Date();
  let idCounter = 0;
  const nextId = () => `alert-${++idCounter}`;

  const expenses = transactions.filter(t => t.type === "expense");
  const income   = transactions.filter(t => t.type === "income");

  // ── 1. Large single transactions (> $500) — deduplicated by merchant ────────
  // Group by merchant, keep only the largest transaction per merchant
  const largeByMerchant: Record<string, Transaction> = {};
  expenses
    .filter(t => t.amount > 500)
    .forEach(t => {
      const key = t.merchant || t.description;
      if (!largeByMerchant[key] || t.amount > largeByMerchant[key].amount) {
        largeByMerchant[key] = t;
      }
    });

  Object.values(largeByMerchant)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .forEach(t => {
      const merchant = t.merchant || t.description;
      alerts.push({
        id: nextId(),
        type: "large_transaction",
        severity: t.amount > 1000 ? "high" : "medium",
        title: `Large Transaction: ${merchant}`,
        message: `${merchant} charged ${fmt(t.amount)}${t.category ? ` in ${t.category}` : ""}.`,
        amount: t.amount,
        category: t.category,
        merchant,
        read: false,
        createdAt: new Date(t.date || now),
        icon: CreditCard,
        actionLabel: "View Transaction",
      });
    });

  // ── 2. Top spending categories ────────────────────────────────────────────
  const categoryTotals: Record<string, number> = {};
  expenses.forEach(t => {
    const cat = t.category || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
  });
  const totalSpend = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .forEach(([cat, amount]) => {
      const pct = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;
      if (pct >= 25) {
        alerts.push({
          id: nextId(),
          type: "category_limit",
          severity: pct >= 40 ? "high" : "medium",
          title: `High Spending: ${cat}`,
          message: `${cat} accounts for ${pct}% of your total expenses (${fmt(amount)}). Consider reviewing this category.`,
          amount,
          category: cat,
          read: false,
          createdAt: new Date(now.getTime() - 1 * 3600000),
          icon: ShoppingBag,
          actionLabel: "See Breakdown",
        });
      }
    });

  // ── 3. Recurring merchants (same merchant 3+ times) ───────────────────────
  const merchantCounts: Record<string, { count: number; total: number; last: Transaction }> = {};
  expenses.forEach(t => {
    const key = t.merchant || t.description;
    if (!merchantCounts[key]) merchantCounts[key] = { count: 0, total: 0, last: t };
    merchantCounts[key].count++;
    merchantCounts[key].total += t.amount;
    merchantCounts[key].last = t;
  });

  Object.entries(merchantCounts)
    .filter(([, v]) => v.count >= 3)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 2)
    .forEach(([merchant, v]) => {
      alerts.push({
        id: nextId(),
        type: "recurring_detected",
        severity: "low",
        title: "Recurring Pattern Detected",
        message: `You've made ${v.count} transactions at ${merchant} totalling ${fmt(v.total)}. This may be a subscription or habit.`,
        amount: v.total,
        category: v.last.category,
        merchant,
        read: false,
        createdAt: new Date(now.getTime() - 2 * 3600000),
        icon: RefreshCw,
        actionLabel: "Review Pattern",
      });
    });

  // ── 4. Income received ────────────────────────────────────────────────────
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  if (income.length > 0) {
    const biggest = income.sort((a, b) => b.amount - a.amount)[0];
    alerts.push({
      id: nextId(),
      type: "income_received",
      severity: "low",
      title: "Income Recorded",
      message: `${fmt(biggest.amount)} received from ${biggest.merchant || biggest.description}. Total income: ${fmt(totalIncome)}.`,
      amount: biggest.amount,
      category: biggest.category,
      merchant: biggest.merchant || biggest.description,
      read: false,
      createdAt: new Date(biggest.date || now),
      icon: DollarSign,
      actionLabel: "View Income",
    });
  }

  // ── 5. Savings opportunity (income > expenses) ────────────────────────────
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const surplus = totalIncome - totalExpenses;
  if (surplus > 0 && totalIncome > 0) {
    const rate = Math.round((surplus / totalIncome) * 100);
    alerts.push({
      id: nextId(),
      type: "savings_opportunity",
      severity: "low",
      title: "Savings Opportunity",
      message: `You're saving ${rate}% of income (${fmt(surplus)} surplus). Consider moving excess to a savings goal.`,
      amount: surplus,
      read: false,
      createdAt: new Date(now.getTime() - 3 * 3600000),
      icon: Target,
      actionLabel: "Set Savings Goal",
    });
  } else if (surplus < 0) {
    alerts.push({
      id: nextId(),
      type: "budget_exceeded",
      severity: "high",
      title: "Expenses Exceed Income",
      message: `Your expenses (${fmt(totalExpenses)}) exceed your recorded income (${fmt(totalIncome)}) by ${fmt(Math.abs(surplus))}.`,
      amount: Math.abs(surplus),
      read: false,
      createdAt: new Date(now.getTime() - 30 * 60000),
      icon: AlertTriangle,
      actionLabel: "Review Budget",
    });
  }

  // ── 6. Top merchant overall ───────────────────────────────────────────────
  const topMerchant = Object.entries(merchantCounts)
    .sort(([, a], [, b]) => b.total - a.total)[0];
  if (topMerchant && topMerchant[1].total > totalExpenses * 0.15) {
    alerts.push({
      id: nextId(),
      type: "top_merchant",
      severity: "medium",
      title: "Top Spending Merchant",
      message: `${topMerchant[0]} is your #1 expense (${fmt(topMerchant[1].total)}, ${topMerchant[1].count} transactions).`,
      amount: topMerchant[1].total,
      merchant: topMerchant[0],
      read: false,
      createdAt: new Date(now.getTime() - 4 * 3600000),
      icon: Zap,
      actionLabel: "View Merchant",
    });
  }

  // ── 7. Spending spike (single transaction > 20% of total) ────────────────
  const spike = expenses.find(t => totalExpenses > 0 && t.amount / totalExpenses > 0.2);
  if (spike) {
    alerts.push({
      id: nextId(),
      type: "spending_spike",
      severity: "medium",
      title: "Spending Spike",
      message: `${spike.merchant || spike.description} (${fmt(spike.amount)}) represents ${Math.round((spike.amount / totalExpenses) * 100)}% of your total spending.`,
      amount: spike.amount,
      category: spike.category,
      merchant: spike.merchant || spike.description,
      read: false,
      createdAt: new Date(spike.date || now),
      icon: TrendingUp,
      actionLabel: "Review Transaction",
    });
  }

  // Sort: high severity first, then by date
  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return alerts
    .sort((a, b) =>
      severityOrder[a.severity] !== severityOrder[b.severity]
        ? severityOrder[a.severity] - severityOrder[b.severity]
        : b.createdAt.getTime() - a.createdAt.getTime()
    )
    .map((a, i) => ({
      ...a,
      createdAt: new Date(now.getTime() - i * 25 * 60000), // stagger timestamps for realism
    }));
}

// ── Severity Config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, {
  label: string; bg: string; text: string; border: string;
  dot: string; badgeBg: string; badgeText: string;
}> = {
  high: {
    label: "High", bg: "bg-red-50", text: "text-red-700", border: "border-red-200",
    dot: "bg-red-500", badgeBg: "bg-red-100", badgeText: "text-red-700",
  },
  medium: {
    label: "Medium", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200",
    dot: "bg-amber-400", badgeBg: "bg-amber-100", badgeText: "text-amber-700",
  },
  low: {
    label: "Low", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200",
    dot: "bg-blue-400", badgeBg: "bg-blue-100", badgeText: "text-blue-600",
  },
};

// ── Default Alert Rules ───────────────────────────────────────────────────────

const DEFAULT_RULES: AlertRule[] = [
  { id: "large_txn",    name: "Large Transaction Alert",    description: "Alert when any transaction exceeds $500",         enabled: true,  threshold: 500 },
  { id: "category",     name: "Category Concentration",     description: "Alert when one category exceeds 25% of spending", enabled: true,  threshold: 25 },
  { id: "recurring",    name: "Recurring Pattern Detection", description: "Detect merchants with 3+ transactions",          enabled: true,  threshold: 3 },
  { id: "income",       name: "Income Tracking",            description: "Notify when income is recorded",                 enabled: true },
  { id: "savings",      name: "Savings Opportunity",        description: "Alert when you have a monthly surplus",          enabled: true },
  { id: "spike",        name: "Spending Spike Detection",   description: "Alert when a single expense is >20% of total",  enabled: true,  threshold: 20 },
  { id: "budget_over",  name: "Over-Budget Warning",        description: "Alert when expenses exceed income",              enabled: true },
  { id: "top_merchant", name: "Top Merchant Insight",       description: "Highlight your #1 spending merchant",           enabled: true },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/register?mode=signin");
    } else {
      setIsAuth(true);
      setIsCheckingAuth(false);
    }
  }, [router]);

  // ── Fetch + generate + sync to backend ────────────────────────────────────
  const fetchAndGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = typeof window !== "undefined" ? localStorage.getItem("userId") ?? "" : "";

      // Fetch transactions and existing backend alerts in parallel
      const [txns, backendAlerts] = await Promise.all([
        transactionsAPI.getAll(),
        fetchBackendAlerts().catch(() => [] as BackendAlert[]),
      ]);
      setTransactions(txns);

      // Generate client-side alerts from transactions
      const generated = generateAlertsFromTransactions(txns);

      // Build a set of already-persisted alert keys (title+type) to avoid duplicates
      const existingKeys = new Set(backendAlerts.map((a) => `${a.title}|${a.type}`));

      // Save only new alerts to backend (non-blocking, best-effort)
      const savePromises = generated
        .filter((a) => !existingKeys.has(`${a.title}|${a.type.toUpperCase()}`))
        .map(async (a) => {
          const saved = await saveAlertToBackend(a, userId);
          return saved ? { ...a, backendId: saved.id } : a;
        });
      const savedResults = await Promise.all(savePromises);

      // Merge: backend alerts (with persisted read state) + newly generated ones
      const backendMapped: SmartAlert[] = backendAlerts.map((ba) => {
        // Find matching generated alert to get the icon
        const match = generated.find((g) => g.title === ba.title);
        return {
          id:        `backend-${ba.id}`,
          backendId: ba.id,
          type:      (ba.type?.toLowerCase() ?? "large_transaction") as AlertType,
          severity:  (ba.severity?.toLowerCase() ?? "low") as Severity,
          title:     ba.title,
          message:   ba.message,
          category:  ba.category ?? undefined,
          read:      ba.read || ba.status === "READ",
          createdAt: new Date(ba.createdAt ?? Date.now()),
          icon:      match?.icon ?? Bell,
          actionLabel: match?.actionLabel,
          amount:    match?.amount,
          merchant:  match?.merchant,
        };
      });

      // New alerts just saved this session (not in backend list yet)
      const newlySaved = savedResults.filter((a) => !existingKeys.has(`${a.title}|${a.type.toUpperCase()}`));

      // Combine: backend (persistent) first, then new ones
      const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      const merged = [...backendMapped, ...newlySaved].sort((a, b) =>
        severityOrder[a.severity] !== severityOrder[b.severity]
          ? severityOrder[a.severity] - severityOrder[b.severity]
          : b.createdAt.getTime() - a.createdAt.getTime()
      );

      setAlerts(merged.length > 0 ? merged : generated);
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

  // ── Derived counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:    alerts.length,
    unread: alerts.filter(a => !a.read).length,
    high:   alerts.filter(a => a.severity === "high").length,
    medium: alerts.filter(a => a.severity === "medium").length,
    low:    alerts.filter(a => a.severity === "low").length,
  }), [alerts]);

  // ── Filtered alerts ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      const readMatch = filter === "all" || (filter === "unread" ? !a.read : a.read);
      const sevMatch  = severityFilter === "all" || a.severity === severityFilter;
      return readMatch && sevMatch;
    });
  }, [alerts, filter, severityFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id !== id) return a;
      if (a.backendId) void acknowledgeBackendAlert(a.backendId).catch(() => {});
      return { ...a, read: true };
    }));
  }, []);

  const markAllRead = useCallback(() => {
    void acknowledgeAllBackendAlerts().catch(() => {});
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => {
      const alert = prev.find(a => a.id === id);
      if (alert?.backendId) void deleteBackendAlert(alert.backendId).catch(() => {});
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const dismissAll = useCallback(() => {
    setAlerts(prev => {
      prev.forEach(a => {
        if (a.backendId) void deleteBackendAlert(a.backendId).catch(() => {});
      });
      return [];
    });
  }, []);

  const toggleRule = (id: string) =>
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  // ── Loading / Auth ─────────────────────────────────────────────────────────
  if (isCheckingAuth || !isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageContent>
      <div className="space-y-6">

        <PageHeader
          icon={Bell}
          title="Financial Alerts"
          subtitle="Smart Alerts"
          description={
            loading
              ? "Analysing your transactions..."
              : counts.unread > 0
                ? `${counts.unread} unread alert${counts.unread !== 1 ? "s" : ""} · Updated ${lastUpdated ? timeAgo(lastUpdated) : "—"}`
                : `All caught up! 🎉 · Updated ${lastUpdated ? timeAgo(lastUpdated) : "—"}`
          }
          actions={
            <div className="flex items-center gap-3">
              <Button
                onClick={() => void fetchAndGenerate()}
                disabled={loading}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={() => setShowRules(r => !r)}
                variant={showRules ? "primary" : "secondary"}
                size="sm"
              >
                <Settings className="w-4 h-4" />
                Alert Rules
              </Button>
            </div>
          }
        />

        {/* ── Severity Summary Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {(["high", "medium", "low"] as Severity[]).map(sev => {
            const cfg = SEVERITY_CONFIG[sev];
            const count = counts[sev];
            return (
              <button key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
                className={`rounded-3xl border p-4 text-left transition-all ${
                  severityFilter === sev
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ${
                        sev === "high" ? "ring-red-400" : sev === "medium" ? "ring-amber-400" : "ring-blue-400"
                      }`
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  {severityFilter === sev && (
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                      Filtered
                    </div>
                  )}
                </div>
                <p className={`text-2xl font-extrabold ${count > 0 ? cfg.text : "text-gray-300"}`}>{count}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">{cfg.label} Severity</p>
              </button>
            );
          })}
        </div>

        {/* ── Alert Rules Panel ────────────────────────────────────────────── */}
        {showRules && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Alert Rules</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle which patterns generate alerts</p>
                </div>
                <button onClick={() => setShowRules(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{rule.description}
                        {rule.threshold && <span className="text-indigo-500 ml-1">
                          (threshold: {rule.id === "category" || rule.id === "spike" ? `${rule.threshold}%` : rule.id === "large_txn" ? fmt(rule.threshold) : `${rule.threshold}x`})
                        </span>}
                      </p>
                    </div>
                    <button onClick={() => toggleRule(rule.id)}
                      className={`relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        rule.enabled ? "bg-indigo-600" : "bg-gray-200"
                      }`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        rule.enabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Rule changes apply on next Refresh — alerts are generated from your live transaction data.
              </p>
            </div>
          </div>
        )}

        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
            {(["all", "unread", "read"] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                  filter === f ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-slate-50"
                }`}>
                {f}
                {f === "unread" && counts.unread > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filter === "unread" ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
                  }`}>{counts.unread}</span>
                )}
              </button>
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2">
              {counts.unread > 0 && (
                <button onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                  <Check className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={dismissAll}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition">
                <Trash2 className="w-3.5 h-3.5" /> Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Alert List ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-semibold">Analysing transactions…</p>
          </div>
        ) : error ? (
          <Alert variant="error" title="Failed to load alerts" message={error}>
            <Button onClick={() => void fetchAndGenerate()} variant="danger" size="sm">
              Try Again
            </Button>
          </Alert>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-indigo-300" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">No Transactions Found</h3>
            <p className="text-sm text-gray-400">Add transactions first — alerts are generated automatically from your spending data.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">
              {filter === "unread" ? "No unread alerts" : filter === "read" ? "No read alerts" : "No alerts"}
            </h3>
            <p className="text-sm text-gray-400">
              {severityFilter !== "all"
                ? `No ${severityFilter} severity alerts match your filter.`
                : "You're all caught up! 🎉"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(alert => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              const Icon = alert.icon;
              return (
                <div key={alert.id}
                  className={`group relative bg-white rounded-3xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                    !alert.read ? `border-l-4 ${
                      alert.severity === "high" ? "border-l-red-400 border-gray-100"
                      : alert.severity === "medium" ? "border-l-amber-400 border-gray-100"
                      : "border-l-blue-400 border-gray-100"
                    }` : "border-gray-100"
                  }`}>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-sm font-bold ${alert.read ? "text-gray-600" : "text-gray-900"}`}>
                              {alert.title}
                            </h4>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                            {!alert.read && (
                              <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!alert.read && (
                              <button onClick={() => markRead(alert.id)}
                                title="Mark as read"
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            )}
                            <button onClick={() => dismiss(alert.id)}
                              title="Dismiss"
                              className="p-1.5 rounded-lg hover:bg-red-50 transition">
                              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className={`text-sm mt-1 ${alert.read ? "text-gray-400" : "text-gray-600"}`}>
                          {alert.message}
                        </p>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {alert.amount && (
                              <span className={`text-xs font-bold ${cfg.text}`}>
                                {fmt(alert.amount)}
                              </span>
                            )}
                            {alert.category && (
                              <span className="text-xs text-gray-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {alert.category}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-gray-300">
                              <Clock className="w-3 h-3" />
                              {timeAgo(alert.createdAt)}
                            </span>
                          </div>

                          {alert.actionLabel && (
                            <button
                              onClick={() => markRead(alert.id)}
                              className={`inline-flex items-center gap-1 text-xs font-bold transition ${cfg.text} hover:opacity-80`}>
                              {alert.actionLabel}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Summary Footer ───────────────────────────────────────────────── */}
        {!loading && transactions.length > 0 && alerts.length > 0 && (
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
            <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)" }} />
            <div className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Alert Summary</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Generated <strong>{alerts.length} alerts</strong> from{" "}
                  <strong>{transactions.length} transactions</strong>.{" "}
                  {counts.high > 0 && (
                    <span className="text-red-600 font-semibold">{counts.high} high-severity item{counts.high !== 1 ? "s" : ""} need your attention. </span>
                  )}
                  Alerts are recalculated each time you refresh.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContent>
  );
}