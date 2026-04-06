"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Wallet,
  PiggyBank, AlertCircle, Loader2, Upload, BarChart3, Camera,
  Brain, RefreshCw, Activity, CreditCard, Lock, Zap, Plus, Calendar, X,
} from "lucide-react";

import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { BudgetComparisonChart } from "@/components/dashboard/BudgetComparisonChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { GoalProgressChart } from "@/components/dashboard/GoalProgressChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { CSVImportModal, type CSVRow } from "@/components/CSVImportModal";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import {
  getToken,
  isAuthenticated as checkAuth,
  transactionsAPI,
  budgetsAPI,
  goalsAPI,
  type Budget,
  type Transaction,
  type Goal,
} from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────

interface ToastMessage { id: number; message: string; type: "success" | "error" }

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white pointer-events-auto transition-all ${
            t.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, show, dismiss };
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Range
// ─────────────────────────────────────────────────────────────────────────────

type DateRange = "30" | "90" | "180" | "365";
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "30": "30 days", "90": "90 days", "180": "6 months", "365": "1 year",
};

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      <Calendar className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
      {(["30", "90", "180", "365"] as DateRange[]).map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {DATE_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loaders
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
        <div className="w-16 h-6 bg-gray-100 rounded-lg" />
      </div>
      <div className="w-24 h-3 bg-gray-100 rounded mb-2" />
      <div className="w-32 h-7 bg-gray-200 rounded mb-2" />
      <div className="w-20 h-2 bg-gray-100 rounded mb-3" />
      <div className="h-12 bg-gray-50 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="w-40 h-5 bg-gray-200 rounded mb-6" />
      <div className="h-48 bg-gray-100 rounded-lg" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

const safePercentChange = (current: number, previous: number): number | null => {
  if (previous === 0 || isNaN(previous) || isNaN(current)) return null;
  return ((current - previous) / previous) * 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// Data processing
// ─────────────────────────────────────────────────────────────────────────────

const processSpendingTrend = (transactions: Transaction[], days: number) => {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const numMonths = days <= 30 ? 1 : days <= 90 ? 3 : days <= 180 ? 6 : 12;
  const data = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTxns = transactions.filter((t) => t.date?.startsWith(monthKey));
    const income   = monthTxns.filter((t) => t.type === "income" || t.type === "INCOME").reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const expenses = monthTxns.filter((t) => t.type === "expense" || t.type === "EXPENSE").reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    data.push({ month: MONTHS[date.getMonth()], income, expenses, savings: income - expenses });
  }
  return data;
};

const processBudgetComparison = (budgets: Budget[], transactions: Transaction[] = []) => {
  if (!Array.isArray(budgets) || budgets.length === 0) return [];

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const spendingByCategory = new Map<string, number>();
  transactions
    .filter((t) => (t.type === "expense" || t.type === "EXPENSE") && t.date?.startsWith(thisMonthKey))
    .forEach((t) => {
      const cat = (t.category ?? "").trim().toLowerCase();
      if (cat) spendingByCategory.set(cat, (spendingByCategory.get(cat) ?? 0) + Math.abs(t.amount ?? 0));
    });

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  return budgets
    .filter((b) => b.category?.trim() && b.budget > 0)
    .map((b) => {
      const category = b.category.trim();
      const budget   = b.budget;
      const apiSpent = b.spent;

      const catNorm = normalize(category);
      let txSpent = spendingByCategory.get(category.toLowerCase()) ?? 0;
      if (txSpent === 0) {
        for (const [key, val] of spendingByCategory.entries()) {
          const keyNorm = normalize(key);
          if (keyNorm === catNorm || keyNorm.includes(catNorm) || catNorm.includes(keyNorm)) {
            txSpent = val;
            break;
          }
        }
      }

      const spent = apiSpent > 0 ? apiSpent : txSpent;
      return { category, budget, spent, remaining: Math.max(budget - spent, 0) };
    });
};

const processCategoryBreakdown = (transactions: Transaction[], days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const categoryMap = new Map<string, number>();
  transactions
    .filter((t) => (t.type === "expense" || t.type === "EXPENSE") && t.date >= cutoffStr)
    .forEach((t) => {
      const current = categoryMap.get(t.category) ?? 0;
      categoryMap.set(t.category, current + Math.abs(t.amount ?? 0));
    });

  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
  return Array.from(categoryMap.entries())
    .map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
};

const buildSparkline = (trendData: any[], key: "income" | "expenses" | "savings") =>
  trendData.map((m) => ({ v: m[key] }));

// ✅ FIXED: Calculate stats directly from transactions within date range
const calculateStats = (transactions: Transaction[], days: number, goalsList: Goal[]) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = transactions.filter((t) => t.date >= cutoffStr);

  const totalIncome = filtered
    .filter((t) => t.type === "income" || t.type === "INCOME")
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const totalExpenses = filtered
    .filter((t) => t.type === "expense" || t.type === "EXPENSE")
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const totalSavings = totalIncome - totalExpenses;

  // Previous period for % change
  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - days);
  const prevCutoffStr = prevCutoff.toISOString().slice(0, 10);

  const prevFiltered = transactions.filter(
    (t) => t.date >= prevCutoffStr && t.date < cutoffStr
  );

  const prevIncome = prevFiltered
    .filter((t) => t.type === "income" || t.type === "INCOME")
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const prevExpenses = prevFiltered
    .filter((t) => t.type === "expense" || t.type === "EXPENSE")
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const incomeChange   = safePercentChange(totalIncome, prevIncome);
  const expensesChange = safePercentChange(totalExpenses, prevExpenses);

  const goalsSavings = goalsList.reduce(
    (s, g) => s + (g.currentAmount ?? (g as any).current ?? 0), 0
  );
  const netWorth = goalsSavings + totalSavings;

  return { totalIncome, totalExpenses, totalSavings, netWorth, incomeChange, expensesChange };
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty state card
// ─────────────────────────────────────────────────────────────────────────────

const EmptyStatCard = ({ title, description, action, actionLabel }: {
  title: string; description: string; action: () => void; actionLabel: string;
}) => (
  <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
    <p className="mb-1 font-semibold text-gray-400">{title}</p>
    <p className="mb-3 text-sm text-gray-400">{description}</p>
    <button onClick={action} className="mx-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
      <Plus className="h-3 w-3" /> {actionLabel}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { toasts, show: showToast, dismiss } = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]             = useState(true);
  const [loadingData, setLoadingData]         = useState(false);
  const [userName, setUserName]               = useState<string>("");
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(null);
  const [dateRange, setDateRange]             = useState<DateRange>("90");

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allBudgets, setAllBudgets]           = useState<Budget[]>([]);
  const [goals, setGoals]                     = useState<Goal[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);

  const [spendingTrendData, setSpendingTrendData]       = useState<any[]>([]);
  const [budgetComparisonData, setBudgetComparisonData] = useState<any[]>([]);
  const [categoryData, setCategoryData]                 = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalIncome: 0, totalExpenses: 0, totalSavings: 0, netWorth: 0,
    incomeChange: null as number | null, expensesChange: null as number | null,
  });

  const [showCsvModal, setShowCsvModal]                   = useState(false);
  const [showTransactionModal, setShowTransactionModal]   = useState(false);
  const [editingTransaction, setEditingTransaction]       = useState<any>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!checkAuth()) { router.replace("/register?mode=signin&reason=session_required"); return; }
    try {
      const token = getToken();
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserName(payload.name || payload.email?.split("@")[0] || "");
      }
    } catch {}
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "?") { e.preventDefault(); setShowKeyboardShortcuts(true); return; }
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "n": e.preventDefault(); setEditingTransaction(null); setShowTransactionModal(true); break;
          case "d": e.preventDefault(); router.push("/dashboard"); break;
          case "b": e.preventDefault(); router.push("/goals-budgets?tab=budgets"); break;
          case "t": e.preventDefault(); router.push("/transactions"); break;
          case "r": e.preventDefault(); router.push("/reports"); break;
          case "g": e.preventDefault(); router.push("/goals-budgets?tab=goals"); break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  // ── Fetch raw data ✅ FIXED: now also fetches goals ──────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [transactions, budgets, goalsList] = await Promise.all([
        transactionsAPI.getAll().catch(() => [] as Transaction[]),
        budgetsAPI.getAll().catch(() => [] as Budget[]),
        goalsAPI.getAll().catch(() => [] as Goal[]),
      ]);

      setAllTransactions(Array.isArray(transactions) ? transactions : []);
      setAllBudgets(Array.isArray(budgets) ? budgets : []);
      setGoals(Array.isArray(goalsList) ? goalsList : []);
      setHasTransactions(Array.isArray(transactions) && transactions.length > 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("fetchDashboardData error:", err);
      showToast("Failed to refresh data", "error");
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => { if (isAuthenticated) fetchDashboardData(); }, [isAuthenticated, fetchDashboardData]);

  // ── Recompute derived data ✅ FIXED: stats from raw transactions ─────────
  useEffect(() => {
    const days = parseInt(dateRange);
    const trendData = processSpendingTrend(allTransactions, days);
    setSpendingTrendData(trendData);
    setBudgetComparisonData(processBudgetComparison(allBudgets, allTransactions));
    setCategoryData(processCategoryBreakdown(allTransactions, days));
    setStats(calculateStats(allTransactions, days, goals));
  }, [allTransactions, allBudgets, goals, dateRange]);

  // ── Sparklines — always 6-month window ───────────────────────────────────
  const sparklineTrend    = processSpendingTrend(allTransactions, 180);
  const incomeSparkline   = buildSparkline(sparklineTrend, "income");
  const expensesSparkline = buildSparkline(sparklineTrend, "expenses");
  const savingsSparkline  = buildSparkline(sparklineTrend, "savings");

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleImportTransactions = async (rows: CSVRow[]): Promise<void> => {
    const norm = (v: unknown) => (v ?? "").toString().trim();
    const requests = rows.map((row) => {
      const date        = norm(row["Date"]        ?? row["date"]);
      const merchant    = norm(row["Merchant"]    ?? row["merchant"]);
      const description = norm(row["Description"] ?? row["description"] ?? merchant);
      const category    = norm(row["Category"]    ?? row["category"]    ?? "Other");
      const rawAmount   = Number(row["Amount"]    ?? row["amount"]      ?? 0);
      const typeRaw     = norm(row["Type"]        ?? row["type"]);
      const type: "income" | "expense" =
        typeRaw.toLowerCase() === "income" || typeRaw.toLowerCase() === "credit" ? "income" : "expense";
      const amount = Math.abs(rawAmount || 0);
      if (!date || !merchant || !amount) return Promise.resolve(null);
      return transactionsAPI.create({ date, merchant, description, amount, category, type }).catch(() => null);
    });
    await Promise.all(requests);
    await fetchDashboardData();
    showToast("Transactions imported successfully!");
  };

  const handleSaveTransaction = async (transaction: any) => {
    try {
      if (editingTransaction) {
        await transactionsAPI.update(editingTransaction.id, transaction);
        showToast("Transaction updated!");
      } else {
        await transactionsAPI.create(transaction);
        showToast("Transaction added!");
      }
      await fetchDashboardData();
      setShowTransactionModal(false);
      setEditingTransaction(null);
    } catch {
      showToast("Failed to save transaction. Please try again.", "error");
    }
  };

  const handleAddTransaction = () => { setEditingTransaction(null); setShowTransactionModal(true); };

  const hasAlerts = hasTransactions && (
    budgetComparisonData.some((b) => b.spent > b.budget) ||
    (stats.expensesChange !== null && stats.expensesChange > 20)
  );

  // ── Loading screen ────────────────────────────────────────────────────────
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <KeyboardShortcuts isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => { setShowTransactionModal(false); setEditingTransaction(null); }}
        onSave={handleSaveTransaction}
        transaction={editingTransaction}
        mode={editingTransaction ? "edit" : "add"}
      />
      <CSVImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onImport={handleImportTransactions}
        requiredHeaders={["Date", "Merchant", "Description", "Amount", "Category", "Type"]}
        title="Import Transactions from CSV"
        description="Upload a CSV export from your bank."
        maxFileSize={10}
        sampleData={[
          { Date: "2024-01-15", Merchant: "Starbucks", Description: "Morning coffee", Amount: -5.5,  Category: "Food & Dining", Type: "expense" },
          { Date: "2024-01-15", Merchant: "Salary",    Description: "Monthly salary", Amount: 5000,  Category: "Income",        Type: "income"  },
        ]}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">

        {/* ── Header ── */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="mb-1 text-3xl font-bold text-gray-900">
                  {userName ? `Welcome back, ${userName} 👋` : "Dashboard"}
                </h1>
                <div className="flex items-center gap-3">
                  <p className="text-gray-600">Your financial overview at a glance</p>
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      · Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/advanced-features")}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-700 px-4 py-2 font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-800"
                >
                  <Zap className="h-4 w-4" />
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">NEW</span>
                  Advanced Features
                </button>
                <button
                  onClick={() => router.push("/transactions")}
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  View Transactions
                </button>
                <button
                  onClick={() => router.push("/goals-budgets")}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800"
                >
                  Goals & Budgets
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="space-y-8">

            {/* Onboarding banner */}
            {!hasTransactions && (
              <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="mb-1 text-lg font-bold text-indigo-900">🎉 Welcome to FinTrack!</h2>
                    <p className="text-sm text-indigo-700">Get started by adding your first transaction or importing from your bank.</p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button onClick={handleAddTransaction} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                      + Add Transaction
                    </button>
                    <button onClick={() => setShowCsvModal(true)} className="rounded-lg border-2 border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                      Import CSV
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Date range picker */}
            {hasTransactions && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold text-gray-500">Showing data for</h2>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}

            {/* ── Stat Cards ── */}
            {loadingData ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[0,1,2,3].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {hasTransactions ? (
                  <>
                    <StatCard
                      title="Total Income"
                      value={formatCurrency(stats.totalIncome)}
                      change={stats.incomeChange}
                      icon={TrendingUp}
                      color="from-green-500 to-green-600"
                      description={
                        stats.incomeChange === null
                          ? "This period · No previous data"
                          : `This period · ${stats.incomeChange >= 0 ? "+" : ""}${stats.incomeChange.toFixed(1)}% vs previous`
                      }
                      sparklineData={incomeSparkline}
                      onClick={() => router.push("/transactions?type=income")}
                    />
                    <StatCard
                      title="Total Expenses"
                      value={formatCurrency(stats.totalExpenses)}
                      change={stats.expensesChange}
                      icon={TrendingDown}
                      color="from-red-500 to-red-600"
                      description={
                        stats.expensesChange === null
                          ? "This period · No previous data"
                          : `This period · ${stats.expensesChange >= 0 ? "+" : ""}${stats.expensesChange.toFixed(1)}% vs previous`
                      }
                      sparklineData={expensesSparkline}
                      onClick={() => router.push("/transactions?type=expense")}
                    />
                    <StatCard
                      title="Net Savings"
                      value={formatCurrency(stats.totalSavings)}
                      icon={PiggyBank}
                      color="from-blue-500 to-blue-600"
                      description="Income - Expenses"
                      sparklineData={savingsSparkline}
                    />
                    <StatCard
                      title="Net Worth"
                      value={formatCurrency(stats.netWorth)}
                      icon={Wallet}
                      color="from-purple-500 to-purple-600"
                      description="Goals + Savings"
                      onClick={() => router.push("/goals-budgets?tab=goals")}
                    />
                  </>
                ) : (
                  <>
                    <EmptyStatCard title="Total Income"   description="No income recorded yet"          action={handleAddTransaction}                          actionLabel="Add income" />
                    <EmptyStatCard title="Total Expenses" description="No expenses recorded yet"        action={handleAddTransaction}                          actionLabel="Add expense" />
                    <EmptyStatCard title="Net Savings"    description="Add transactions to see savings" action={() => setShowCsvModal(true)}                   actionLabel="Import CSV" />
                    <EmptyStatCard title="Net Worth"      description="Set goals to track net worth"    action={() => router.push("/goals-budgets?tab=goals")} actionLabel="Create a goal" />
                  </>
                )}
              </div>
            )}

            {/* ── Charts row 1 ── */}
            {loadingData ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SkeletonChart /><SkeletonChart />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SpendingTrendChart data={spendingTrendData} />
                <BudgetComparisonChart
                  data={budgetComparisonData}
                  onCategoryClick={(cat) => router.push(`/transactions?category=${encodeURIComponent(cat)}`)}
                  onAddBudget={() => router.push("/goals-budgets?tab=budgets")}
                />
              </div>
            )}

            {/* ── Charts row 2 ── */}
            {!loadingData && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {categoryData.length > 0 ? (
                  <CategoryPieChart data={categoryData} />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                    <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
                    <p className="font-semibold text-gray-400">Spending by Category</p>
                    <p className="mt-1 text-sm text-gray-400">Add expense transactions to see your spending breakdown</p>
                    <button onClick={handleAddTransaction} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                      + Add Expense
                    </button>
                  </div>
                )}

                {goals.length > 0 ? (
                  <GoalProgressChart goals={goals.map((g, i) => ({ id: g.id || String(i), name: g.name, target: g.targetAmount ?? 0, current: g.currentAmount ?? 0, icon: g.icon || "🎯", color: g.color || "from-blue-500 to-blue-600", }))} />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                    <Target className="mb-3 h-10 w-10 text-gray-300" />
                    <p className="font-semibold text-gray-400">Savings Goals Progress</p>
                    <p className="mt-1 text-sm text-gray-400">No active goals yet.</p>
                    <button onClick={() => router.push("/goals-budgets?tab=goals")} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                      + Create Goal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Quick Actions ── */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-8 text-white shadow-xl">
              <h3 className="mb-4 text-2xl font-bold">Quick Actions</h3>

              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold">NEW</span>
                  <span className="text-sm font-semibold">Advanced Financial Tools</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: TrendingUp, label: "Cash Flow Forecast", sub: "Predict future balance",  tab: "forecast"     },
                    { icon: BarChart3,  label: "Investments",         sub: "Track your portfolio",   tab: "investments"  },
                    { icon: CreditCard, label: "Debt Payoff",         sub: "Plan your debt freedom", tab: "debt"         },
                    { icon: Lock,       label: "Bank Connect",         sub: "Link your accounts",    tab: "plaid"        },
                  ].map(({ icon: Icon, label, sub, tab }) => (
                    <button
                      key={tab}
                      onClick={() => router.push(`/advanced-features?tab=${tab}`)}
                      className="rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-500/40 to-emerald-500/40 p-4 text-left shadow-lg backdrop-blur-sm transition-all hover:from-green-500/50 hover:to-emerald-500/50"
                    >
                      <Icon className="mb-2 h-8 w-8" />
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-blue-100">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-6 h-px bg-white/20" />

              <div>
                <div className="mb-3 text-sm font-semibold opacity-90">Essential Tools</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: DollarSign, label: "Add Transaction", sub: "Record income or expense", action: handleAddTransaction },
                    { icon: Upload,     label: "Import CSV",       sub: "Upload from bank",        action: () => setShowCsvModal(true) },
                    { icon: Wallet,     label: "Set Budget",       sub: "Update spending limits",  action: () => router.push("/goals-budgets?tab=budgets") },
                    { icon: BarChart3,  label: "View Reports",     sub: "See insights",            action: () => router.push("/reports") },
                    { icon: Camera,     label: "Scan Receipt",     sub: "Extract from photos",     action: () => router.push("/receipts") },
                    { icon: Brain,      label: "AI Insights",      sub: "Smart analysis",          action: () => router.push("/insights") },
                    { icon: Activity,   label: "Health Score",     sub: "Check wellness",          action: () => router.push("/health") },
                    { icon: RefreshCw,  label: "Recurring",        sub: "Manage subscriptions",    action: () => router.push("/recurring") },
                  ].map(({ icon: Icon, label, sub, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="rounded-xl bg-white/20 p-4 text-left backdrop-blur-sm transition-all hover:bg-white/30"
                    >
                      <Icon className="mb-2 h-8 w-8" />
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-blue-100">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Financial Alerts ── */}
            {hasAlerts && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="mt-1 h-6 w-6 flex-shrink-0 text-amber-600" />
                  <div>
                    <h3 className="mb-2 font-bold text-amber-900">Financial Alerts</h3>
                    <ul className="space-y-2 text-sm text-amber-800">
                      {budgetComparisonData.filter((b) => b.spent > b.budget).map((b, i) => (
                        <li key={i}>
                          • <span className="font-semibold">{b.category}</span> is over budget by {formatCurrency(b.spent - b.budget)}
                        </li>
                      ))}
                      {stats.expensesChange !== null && stats.expensesChange > 20 && (
                        <li>• Your expenses increased by {stats.expensesChange.toFixed(1)}% this period</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}