"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Wallet,
  PiggyBank, AlertCircle, Loader2, Upload, BarChart3, Camera,
  Brain, RefreshCw, Activity, CreditCard, Lock, Zap, Plus, Calendar, X, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { PageContent, Section, Grid } from "@/components/layouts/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";

import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { BudgetComparisonChart } from "@/components/dashboard/BudgetComparisonChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { GoalProgressChart } from "@/components/dashboard/GoalProgressChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { AnomalyInsightsCard } from "@/components/dashboard/AnomalyInsightsCard";
import { BudgetForecastCard } from "@/components/dashboard/BudgetForecastCard";
import { HealthScoreWidget } from "@/components/dashboard/HealthScoreWidget";
import { RecurringTransactionsCard } from "@/components/dashboard/RecurringTransactionsCard";
import { SpendingInsightsCard } from "@/components/dashboard/SpendingInsightsCard";
import { DailySpendCard } from "@/components/dashboard/DailySpendCard";
import { SpendingByDayCard } from "@/components/dashboard/SpendingByDayCard";
import { SavingsGoalsCard } from "@/components/dashboard/SavingsGoalsCard";
import { MonthEndForecastCard } from "@/components/dashboard/MonthEndForecastCard";
import { NextMonthPredictionCard } from "@/components/dashboard/NextMonthPredictionCard";
import { AITopInsightBanner } from "@/components/dashboard/AITopInsightBanner";
import { BillRemindersCard } from "@/components/dashboard/BillRemindersCard";
import { BudgetAlertsCard } from "@/components/dashboard/BudgetAlertsCard";
import { SavingsRateCard } from "@/components/dashboard/SavingsRateCard";
import { NoSpendStreakCard } from "@/components/dashboard/NoSpendStreakCard";
import { TransactionModal } from "@/components/modals/TransactionModal";
import { CSVImportModal, type CSVRow } from "@/components/CSVImportModal";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OnboardingWizard, shouldShowOnboarding } from "@/components/OnboardingWizard";
import {
  getToken,
  isAuthenticated as checkAuth,
  transactionsAPI,
  budgetsAPI,
  goalsAPI,
  authAPI,
  type Budget,
  type Transaction,
  type Goal,
} from "@/lib/api";

// Note: Toast is now provided by ToastProvider in app layout

// ─────────────────────────────────────────────────────────────────────────────
// Date Range
// ─────────────────────────────────────────────────────────────────────────────

type DateRange = "30" | "90" | "180" | "365";
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "30": "30 days", "90": "90 days", "180": "6 months", "365": "1 year",
};

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-1 inline-flex">
      <Calendar className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 ml-1.5 flex-shrink-0" />
      {(["30", "90", "180", "365"] as DateRange[]).map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
            value === range
              ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          {DATE_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}

// Skeleton loaders are now imported from @/components/ui/Skeleton
function SkeletonChart() {
  return <CardSkeleton />;
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
  <div className="rounded-md border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 text-center">
    <p className="mb-1 font-semibold text-neutral-400 dark:text-neutral-500">{title}</p>
    <p className="mb-3 text-sm text-neutral-400 dark:text-neutral-500">{description}</p>
    <Button variant="ghost" onClick={action} icon={<Plus className="h-3 w-3" />}>
      {actionLabel}
    </Button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

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
  const [showOnboarding, setShowOnboarding]               = useState(false);
  const [showResetConfirm, setShowResetConfirm]           = useState(false);
  const [isResetting, setIsResetting]                     = useState(false);

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
    // Show onboarding wizard for first-time users (skip for demo accounts)
    const isDemo = typeof window !== "undefined" && localStorage.getItem("isDemo") === "true";
    if (!isDemo && shouldShowOnboarding()) setShowOnboarding(true);
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
      toast.error("Failed to refresh data");
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => { if (isAuthenticated) fetchDashboardData(); }, [isAuthenticated, fetchDashboardData]);

  // ── Recompute derived data ✅ FIXED: stats from raw transactions ─────────
  useEffect(() => {
    const days = parseInt(dateRange);
    const trendData = processSpendingTrend(allTransactions, days);
    setSpendingTrendData(trendData);
    const budgetData = processBudgetComparison(allBudgets, allTransactions);
    setBudgetComparisonData(budgetData);
    setCategoryData(processCategoryBreakdown(allTransactions, days));
    setStats(calculateStats(allTransactions, days, goals));

    // Write budget alert count to localStorage so Navigation can show a badge
    const atRiskCount = budgetData.filter((b) => b.budget > 0 && b.spent / b.budget >= 0.75).length;
    if (typeof window !== "undefined") {
      localStorage.setItem("fintrack-budget-alerts", atRiskCount.toString());
      window.dispatchEvent(new Event("fintrack-budget-alerts-updated"));
    }
  }, [allTransactions, allBudgets, goals, dateRange]);

  // ── Sparklines — always 6-month window ───────────────────────────────────
  const sparklineTrend    = processSpendingTrend(allTransactions, 180);
  const incomeSparkline   = buildSparkline(sparklineTrend, "income");
  const expensesSparkline = buildSparkline(sparklineTrend, "expenses");
  const savingsSparkline  = buildSparkline(sparklineTrend, "savings");

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleImportTransactions = async (rows: CSVRow[], clearFirst = true): Promise<void> => {
    if (clearFirst) {
      await transactionsAPI.clearAll();
    }
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
    toast.success("Transactions imported successfully!");
  };

  const handleSaveTransaction = async (transaction: any) => {
    try {
      if (editingTransaction) {
        await transactionsAPI.update(editingTransaction.id, transaction);
        toast.success("Transaction updated!");
      } else {
        await transactionsAPI.create(transaction);
        toast.success("Transaction added!");
      }
      await fetchDashboardData();
      setShowTransactionModal(false);
      setEditingTransaction(null);
    } catch {
      toast.error("Failed to save transaction. Please try again.");
    }
  };

  const handleAddTransaction = () => { setEditingTransaction(null); setShowTransactionModal(true); };

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      await authAPI.resetData();
      toast.success("Dashboard reset to demo data!");
      setShowResetConfirm(false);
      await fetchDashboardData();
    } catch {
      toast.error("Reset failed. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const hasAlerts = hasTransactions && (
    budgetComparisonData.some((b) => b.spent > b.budget) ||
    (stats.expensesChange !== null && stats.expensesChange > 20)
  );

  // ── Loading screen ────────────────────────────────────────────────────────
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-primary-600" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <KeyboardShortcuts isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />

      {/* ── Reset confirm dialog ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                <RotateCcw className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                Reset to Demo Data?
              </h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5 leading-relaxed">
              This will <span className="font-semibold text-red-500">permanently delete</span> all your
              current transactions, budgets, and goals — then replace them with realistic demo data.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 !bg-orange-500 hover:!bg-orange-600"
                onClick={handleResetData}
                isLoading={isResetting}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Yes, Reset
              </Button>
            </div>
          </div>
        </div>
      )}
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
        title="Import Bank Transactions"
        description="Upload a CSV from any bank — columns are detected automatically."
        maxFileSize={10}
      />

      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* ── Header ── */}
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                  {userName ? `Welcome back, ${userName}! 👋` : "Dashboard"}
                </h1>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                  Your financial overview at a glance
                  {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="secondary"
                  size="md"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={fetchDashboardData}
                  isLoading={loadingData}
                >
                  Refresh
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  icon={<RotateCcw className="w-4 h-4 text-orange-500" />}
                  onClick={() => setShowResetConfirm(true)}
                  title="Reset all data to demo dataset"
                >
                  <span className="text-orange-500 font-medium">Reset Data</span>
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleAddTransaction}
                >
                  Add Transaction
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <PageContent>

            {/* Onboarding banner */}
            {!hasTransactions && (
              <Alert
                variant="info"
                title="🎉 Welcome to FinTrack!"
                showIcon={false}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p>Get started by adding your first transaction or importing from your bank.</p>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleAddTransaction}
                    >
                      Add Transaction
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Upload className="w-4 h-4" />}
                      onClick={() => setShowCsvModal(true)}
                    >
                      Import CSV
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {/* ── AI Top Insight Banner — signature wow feature, first thing seen ── */}
            {!loadingData && hasTransactions && (
              <AITopInsightBanner transactions={allTransactions} />
            )}

            {/* Date range picker */}
            {hasTransactions && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Showing data for</span>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}

            {/* ── Stat Cards ── */}
            {loadingData ? (
              <Grid columns={4} gap="lg">
                {[0,1,2,3].map((i) => <CardSkeleton key={i} />)}
              </Grid>
            ) : (
              <Grid columns={4} gap="lg">
                {hasTransactions ? (
                  <>
                    <StatCard
                      title="Total Income"
                      value={formatCurrency(stats.totalIncome)}
                      change={stats.incomeChange}
                      icon={TrendingUp}
                      color="success"
                      sparklineData={incomeSparkline}
                      onClick={() => router.push("/transactions?type=income")}
                    />
                    <StatCard
                      title="Total Expenses"
                      value={formatCurrency(stats.totalExpenses)}
                      change={stats.expensesChange}
                      icon={TrendingDown}
                      color="error"
                      sparklineData={expensesSparkline}
                      onClick={() => router.push("/transactions?type=expense")}
                    />
                    <StatCard
                      title="Net Savings"
                      value={formatCurrency(stats.totalSavings)}
                      icon={PiggyBank}
                      color="primary"
                      sparklineData={savingsSparkline}
                    />
                    <StatCard
                      title="Net Worth"
                      value={formatCurrency(stats.netWorth)}
                      icon={Wallet}
                      color="accent"
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
              </Grid>
            )}

            {/* ── AI Insights Section ── */}
            {!loadingData && hasTransactions && (
              <>
                {/* Section header — inline style gradient bypasses Tailwind purge */}
                <div
                  className="flex items-center gap-4 px-5 py-3.5 rounded-2xl shadow-md"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)' }}
                >
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-extrabold text-white tracking-wide">AI INSIGHTS</span>
                  </div>
                  <div className="w-px h-6 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.3)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Real-time analysis of your spending patterns
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#c7d2fe' }}>
                      Anomaly detection · Budget forecasting · Next-month prediction — all client-side, zero latency
                    </p>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <span
                      className="text-xs font-semibold text-white px-3 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.2)' }}
                    >
                      4 models active
                    </span>
                  </div>
                </div>

                {/* 2-col on lg, 4-col on xl — cards get enough room at all sizes */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  <AnomalyInsightsCard transactions={allTransactions} />
                  <BudgetForecastCard transactions={allTransactions} budgets={allBudgets} />
                  <MonthEndForecastCard transactions={allTransactions} />
                  <NextMonthPredictionCard transactions={allTransactions} />
                </div>
              </>
            )}

            {/* ── Charts row 1 ── */}
            {loadingData ? (
              <Grid columns={2} gap="lg">
                <SkeletonChart />
                <SkeletonChart />
              </Grid>
            ) : (
              <Grid columns={2} gap="lg">
                <Section title="Spending Trend">
                  <SpendingTrendChart data={spendingTrendData} />
                </Section>
                <Section title="Budget Overview">
                  <BudgetComparisonChart
                    data={budgetComparisonData}
                    onCategoryClick={(cat) => router.push(`/transactions?category=${encodeURIComponent(cat)}`)}
                    onAddBudget={() => router.push("/goals-budgets?tab=budgets")}
                  />
                </Section>
              </Grid>
            )}

            {/* ── Charts row 2 ── */}
            {!loadingData && (
              <Grid columns={2} gap="lg">
                {categoryData.length > 0 ? (
                  <Section title="Spending by Category">
                    <CategoryPieChart data={categoryData} />
                  </Section>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center">
                    <BarChart3 className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
                    <p className="font-semibold text-neutral-500 dark:text-neutral-400">Spending by Category</p>
                    <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">Add expense transactions to see breakdown</p>
                    <Button onClick={handleAddTransaction} variant="primary" size="sm" className="mt-4" icon={<Plus className="w-4 h-4" />}>
                      Add Expense
                    </Button>
                  </div>
                )}

                {goals.length > 0 ? (
                  <Section title="Savings Goals Progress">
                    <GoalProgressChart goals={goals.map((g, i) => ({ id: g.id || String(i), name: g.name, target: g.targetAmount ?? 0, current: g.currentAmount ?? 0, icon: g.icon || "🎯", color: g.color || "from-primary-500 to-primary-600", }))} />
                  </Section>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center">
                    <Target className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
                    <p className="font-semibold text-neutral-500 dark:text-neutral-400">Savings Goals Progress</p>
                    <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">No active goals yet.</p>
                    <Button onClick={() => router.push("/goals-budgets?tab=goals")} variant="primary" size="sm" className="mt-4" icon={<Plus className="w-4 h-4" />}>
                      Create Goal
                    </Button>
                  </div>
                )}
              </Grid>
            )}

            {/* ── Secondary AI widgets (below charts) ── */}
            {!loadingData && hasTransactions && (
              <>
                {/* Bill Reminders — full-width so all upcoming bills are visible */}
                <BillRemindersCard transactions={allTransactions} />
                <Grid columns={2} gap="lg">
                  <SpendingInsightsCard transactions={allTransactions} />
                  <BudgetAlertsCard budgets={budgetComparisonData} />
                </Grid>
                <Grid columns={2} gap="lg">
                  <RecurringTransactionsCard transactions={allTransactions} />
                  <SavingsGoalsCard />
                </Grid>
                <Grid columns={2} gap="lg">
                  <SavingsRateCard transactions={allTransactions} />
                  <NoSpendStreakCard transactions={allTransactions} />
                </Grid>
                <SpendingByDayCard transactions={allTransactions} />
                <Grid columns={2} gap="lg">
                  <HealthScoreWidget transactions={allTransactions} budgets={allBudgets} />
                  <DailySpendCard transactions={allTransactions} />
                </Grid>
              </>
            )}

            {/* ── Quick Actions ── */}
            <Section title="Quick Actions" description="Essential tools to manage your finances">
              <Grid columns={4} gap="md">
                {[
                  { icon: DollarSign, label: "Add Transaction", action: handleAddTransaction },
                  { icon: Upload,     label: "Import CSV",       action: () => setShowCsvModal(true) },
                  { icon: Wallet,     label: "Set Budget",       action: () => router.push("/goals-budgets?tab=budgets") },
                  { icon: BarChart3,  label: "View Reports",     action: () => router.push("/reports") },
                  { icon: Camera,     label: "Scan Receipt",     action: () => router.push("/receipts") },
                  { icon: Brain,      label: "AI Insights",      action: () => router.push("/insights") },
                  { icon: Activity,   label: "Health Score",     action: () => router.push("/health") },
                  { icon: RefreshCw,  label: "Recurring",        action: () => router.push("/recurring") },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="flex flex-col items-center gap-2 p-4 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-900 dark:text-neutral-50"
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-semibold text-center">{label}</span>
                  </button>
                ))}
              </Grid>
            </Section>

            {/* ── Financial Alerts ── */}
            {hasAlerts && (
              <Alert variant="warning" title="Financial Alerts">
                <ul className="space-y-2 text-sm">
                  {budgetComparisonData.filter((b) => b.spent > b.budget).map((b, i) => (
                    <li key={i}>
                      <span className="font-semibold">{b.category}</span> is over budget by {formatCurrency(b.spent - b.budget)}
                    </li>
                  ))}
                  {stats.expensesChange !== null && stats.expensesChange > 20 && (
                    <li>Your expenses increased by {stats.expensesChange.toFixed(1)}% this period</li>
                  )}
                </ul>
              </Alert>
            )}
          </PageContent>
        </main>
      </div>
    </>
  );
}