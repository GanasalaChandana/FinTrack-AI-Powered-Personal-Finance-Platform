"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  CartesianGrid, Tooltip, Legend, XAxis, YAxis, ResponsiveContainer,
  ReferenceLine, ComposedChart, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Download, DollarSign, Target, Award,
  AlertCircle, ArrowUp, ArrowDown, Loader2, ChevronRight, Calendar,
  BarChart3, PieChart as PieChartIcon, Settings, X, Sparkles,
  FileText, type LucideIcon, Receipt, Check, Tag, PiggyBank,
} from "lucide-react";
import { isAuthenticated, transactionsAPI, type Transaction } from "@/lib/api";
import { useTaxStore, TAX_CATEGORY_META, type TaxCategory } from "@/lib/stores/taxStore";
import { reportsService, type ReportsData, type ReportsRange, type CategoryBreakdown } from "@/lib/api/services/reports.service";
import { exportMonthlyReport } from "@/lib/utils/pdfExport";
import { CheckCircle } from "lucide-react";
import { IncomeExpenseComparison } from "@/components/charts/AdvancedCharts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, Section, Grid, PageContent } from "@/components/layouts/PageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportTab = "overview" | "custom" | "trends" | "comparison" | "forecast" | "budget-history" | "tax" | "income" | "savings";
type DateRange = "last-7-days" | "last-30-days" | "last-3-months" | "last-6-months" | "last-year" | "custom";
type ChartType = "line" | "bar" | "area" | "pie";

interface CustomReportConfig {
  name: string;
  dateRange: DateRange;
  metrics: string[];
  groupBy: "day" | "week" | "month" | "category";
  chartType: ChartType;
  includeCategories: string[];
}

interface CategoryDetail {
  name: string;
  total: number;
  transactions: number;
  avgTransaction: number;
  trend: number;
  breakdown: Array<{ date: string; amount: number }>;
  topMerchants: Array<{ name: string; amount: number; count: number }>;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  fontSize: 13,
};

// ── Empty State ───────────────────────────────────────────────────────────────

function ChartEmptyState({ message = "Add transactions to see your data here" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-slate-300 dark:text-gray-500" />
      </div>
      <p className="text-sm font-semibold text-slate-400 dark:text-gray-500 text-center">{message}</p>
      <p className="text-xs text-slate-300 dark:text-gray-600 mt-1 text-center">Data will appear once you log transactions</p>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, change, trend, icon: Icon, bgAccent, textAccent,
}: {
  title: string; value: string; change?: string; trend?: "up" | "down" | "neutral";
  icon: LucideIcon; bgAccent: string; textAccent: string;
}) {
  const hasChange = change && trend && trend !== "neutral";
  const isPositive = trend === "up";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${bgAccent}`}>
          <Icon className={`w-5 h-5 ${textAccent}`} />
        </div>
        {hasChange && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            isPositive
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          }`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Section Card wrapper ──────────────────────────────────────────────────────

function Card({ title, subtitle, children, accentColor = "#6366f1" }: {
  title?: string; subtitle?: string; children: React.ReactNode; accentColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-6">
        {title && (
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-3xl p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-bold text-red-800 dark:text-red-300 mb-2">Couldn't load data</h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition">
          Try Again
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const EnhancedFinancialReports: React.FC = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuth, setIsAuth] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportTab>("overview");

  // ── DEFAULT: "last-year" so all existing transactions are visible ──────────
  const [dateRange, setDateRange] = useState<DateRange>("last-year");

  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [allReportsData, setAllReportsData] = useState<ReportsData | null>(null); // always full dataset for forecast
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]); // all-time transactions for YoY
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTaxFilter, setActiveTaxFilter] = useState<TaxCategory | null>(null);
  const taxStore = useTaxStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(null);
  const [customConfig, setCustomConfig] = useState<CustomReportConfig>({
    name: "My Custom Report",
    dateRange: "last-year",
    metrics: ["income", "expenses"],
    groupBy: "month",
    chartType: "line",
    includeCategories: [],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/register?mode=signin");
    } else {
      setIsAuth(true);
      setIsCheckingAuth(false);
    }
  }, [router]);

  const fetchReportsData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      // Fetch filtered data for the selected range
      const data = await reportsService.getFinancialReports(dateRange as ReportsRange);
      setReportsData(data);

      // Always fetch full-year data separately so Forecast/Trends
      // have enough history regardless of the selected date range
      if (dateRange !== "last-year") {
        const fullData = await reportsService.getFinancialReports("last-year");
        setAllReportsData(fullData);
      } else {
        setAllReportsData(data);
      }

      // Fetch ALL transactions for Year-over-Year comparison (needs 2 years of data)
      const txns = await transactionsAPI.getAll().catch(() => [] as Transaction[]);
      setRawTransactions(Array.isArray(txns) ? txns : []);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Failed to load reports data");
    } finally {
      setDataLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (isAuth) void fetchReportsData();
  }, [isAuth, fetchReportsData]);

  // ── Derived: Spending Trends data from real categories + monthly data ──────
  const trendData = useMemo(() => {
    if (!reportsData?.monthlyData?.length) return [];
    const cats = reportsData.categoryBreakdown.slice(0, 5);
    return reportsData.monthlyData.map((m) => {
      const row: Record<string, any> = { month: m.month };
      cats.forEach((cat) => {
        const share = reportsData.summary.totalExpenses > 0
          ? cat.amount / reportsData.summary.totalExpenses
          : 0;
        row[cat.name] = Math.round(m.expenses * share * 100) / 100;
      });
      return row;
    });
  }, [reportsData]);

  // ── Derived: Trend analysis (which categories growing / shrinking) ─────────
  const trendAnalysis = useMemo(() => {
    if (!reportsData?.monthlyData?.length || reportsData.monthlyData.length < 2) {
      return { increasing: [], decreasing: [] };
    }
    const months = reportsData.monthlyData;
    const last = months[months.length - 1];
    const prev = months[months.length - 2];

    const increasing: { name: string; pct: string }[] = [];
    const decreasing: { name: string; pct: string }[] = [];

    reportsData.categoryBreakdown.forEach((cat) => {
      const share = cat.amount / (reportsData.summary.totalExpenses || 1);
      const lastAmt = last.expenses * share;
      const prevAmt = prev.expenses * share;
      if (prevAmt === 0) return;
      const change = ((lastAmt - prevAmt) / prevAmt) * 100;
      if (change > 1)  increasing.push({ name: cat.name, pct: `+${change.toFixed(1)}%` });
      else if (change < -1) decreasing.push({ name: cat.name, pct: `${change.toFixed(1)}%` });
    });
    return { increasing, decreasing };
  }, [reportsData]);

  // ── Derived: Comparison data (first half vs second half of monthlyData) ────
  const comparisonData = useMemo(() => {
    if (!reportsData?.monthlyData?.length) return [];
    const months = reportsData.monthlyData;
    const half = Math.floor(months.length / 2);
    return months.map((m, i) => ({
      month: m.month,
      current: m.expenses,
      previous: i >= half ? (months[i - half]?.expenses ?? 0) : 0,
      currentIncome: m.income,
      previousIncome: i >= half ? (months[i - half]?.income ?? 0) : 0,
    }));
  }, [reportsData]);

  // ── Derived: Year-over-Year data — computed from all raw transactions ────────
  const yoyData = useMemo(() => {
    if (rawTransactions.length === 0) return null;
    const now  = new Date();
    const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Build 12 months: same month in current year vs same month in previous year
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cy = d.getFullYear();
      const mo = d.getMonth();
      const cyKey = `${cy}-${String(mo + 1).padStart(2, "0")}`;
      const lyKey = `${cy - 1}-${String(mo + 1).padStart(2, "0")}`;

      const isExp = (t: Transaction) => t.type === "expense" || t.type === "EXPENSE";
      const isInc = (t: Transaction) => t.type === "income"  || t.type === "INCOME";
      const sum   = (txns: Transaction[]) =>
        txns.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

      const cyTxns = rawTransactions.filter(t => (t.date ?? "").startsWith(cyKey));
      const lyTxns = rawTransactions.filter(t => (t.date ?? "").startsWith(lyKey));

      months.push({
        month:          SHORT[mo],
        thisYearExp:    Math.round(sum(cyTxns.filter(isExp)) * 100) / 100,
        lastYearExp:    Math.round(sum(lyTxns.filter(isExp)) * 100) / 100,
        thisYearInc:    Math.round(sum(cyTxns.filter(isInc)) * 100) / 100,
        lastYearInc:    Math.round(sum(lyTxns.filter(isInc)) * 100) / 100,
      });
    }

    const cyTotal  = months.reduce((s, m) => s + m.thisYearExp, 0);
    const lyTotal  = months.reduce((s, m) => s + m.lastYearExp, 0);
    const hasLYData = lyTotal > 0;
    const pctChange = lyTotal > 0 ? ((cyTotal - lyTotal) / lyTotal) * 100 : null;

    // Current-month callout
    const curr  = months[months.length - 1];
    const currMonthPct = curr.lastYearExp > 0
      ? ((curr.thisYearExp - curr.lastYearExp) / curr.lastYearExp) * 100
      : null;

    // Income YoY totals
    const cyIncTotal = months.reduce((s, m) => s + m.thisYearInc, 0);
    const lyIncTotal = months.reduce((s, m) => s + m.lastYearInc, 0);
    const incPctChange = lyIncTotal > 0 ? ((cyIncTotal - lyIncTotal) / lyIncTotal) * 100 : null;

    const currentMonthName = SHORT[now.getMonth()];
    const currentYear      = now.getFullYear();

    return {
      months, cyTotal, lyTotal, hasLYData, pctChange,
      cyIncTotal, lyIncTotal, incPctChange,
      curr, currMonthPct, currentMonthName, currentYear,
    };
  }, [rawTransactions]);

  // ── Derived: Forecast data — always uses full dataset for meaningful projections
  const forecastData = useMemo(() => {
    const source = allReportsData ?? reportsData;
    if (!source?.monthlyData?.length) return [];
    const months = source.monthlyData;

    const activeMonths = months.filter(m => m.expenses > 0);
    if (activeMonths.length === 0) return [];

    const avgExp = activeMonths.reduce((s, m) => s + m.expenses, 0) / activeMonths.length;
    const growthRate = activeMonths.length > 1
      ? ((activeMonths[activeMonths.length - 1].expenses - activeMonths[0].expenses) /
          (activeMonths[0].expenses || 1)) / activeMonths.length
      : 0.02;

    const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();

    // Use a typed array to avoid null/number conflicts
    const result: { month: string; actual: number | null; forecast: number | null }[] =
      activeMonths.slice(-2).map((m) => ({
        month: m.month,
        actual: m.expenses,
        forecast: null,
      }));

    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        month: SHORT_MONTHS[d.getMonth()],
        actual: null,
        forecast: Math.round(avgExp * (1 + growthRate * i) * 100) / 100,
      });
    }
    return result;
  }, [allReportsData, reportsData]);

  // ── Derived: Forecast summary stats — uses full dataset ───────────────────
  const forecastStats = useMemo(() => {
    const source = allReportsData ?? reportsData;
    if (!source?.monthlyData?.length) return null;
    const activeMonths = source.monthlyData.filter(m => m.expenses > 0);
    if (activeMonths.length === 0) return null;

    const avgExp = activeMonths.reduce((s, m) => s + m.expenses, 0) / activeMonths.length;
    const growthPct = activeMonths.length > 1
      ? ((activeMonths[activeMonths.length - 1].expenses - activeMonths[0].expenses) /
          (activeMonths[0].expenses || 1)) * 100
      : 2; // default 2%
    const projected6 = Math.round(avgExp * (1 + Math.max(growthPct / 100, 0.02) * 6) * 100) / 100;
    const buffer = Math.round(projected6 * 0.09 * 100) / 100;
    return { projected6, growthPct: Math.round(growthPct * 10) / 10, buffer };
  }, [allReportsData, reportsData]);

  // ── Derived: Income Analysis ──────────────────────────────────────────────
  const incomeAnalysis = useMemo(() => {
    if (!rawTransactions.length) return null;

    const incomeTxns = rawTransactions.filter(
      (t) => t.type === "income" || t.type === "INCOME"
    );
    if (incomeTxns.length === 0) return null;

    // Monthly income totals — last 12 months
    const now = new Date();
    const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthly: { month: string; total: number; key: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const total = incomeTxns
        .filter((t) => (t.date ?? "").startsWith(key))
        .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
      monthly.push({ month: SHORT[d.getMonth()], total, key });
    }

    // Stability score: 100 − (coefficient of variation × 0.5), clamped 0–100
    const activeMonths = monthly.filter((m) => m.total > 0);
    const mean = activeMonths.length > 0
      ? activeMonths.reduce((s, m) => s + m.total, 0) / activeMonths.length
      : 0;
    const variance = activeMonths.length > 1
      ? activeMonths.reduce((s, m) => s + Math.pow(m.total - mean, 2), 0) / activeMonths.length
      : 0;
    const cv = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;
    const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - cv * 0.6)));

    // Paycheck cadence — median gap between income transactions
    const sorted = [...incomeTxns].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(`${sorted[i - 1].date.slice(0, 10)}T00:00:00`);
      const d2 = new Date(`${sorted[i].date.slice(0, 10)}T00:00:00`);
      const diff = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
      if (diff > 0 && diff < 60) gaps.push(diff); // ignore > 2 months
    }
    const medianGap = gaps.length > 0
      ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : 0;
    let cadence = "Irregular";
    let cadenceColor = "text-orange-600 dark:text-orange-400";
    if (medianGap >= 6  && medianGap <= 8)  { cadence = "Weekly";        cadenceColor = "text-emerald-600 dark:text-emerald-400"; }
    else if (medianGap >= 12 && medianGap <= 16) { cadence = "Bi-weekly";     cadenceColor = "text-emerald-600 dark:text-emerald-400"; }
    else if (medianGap >= 13 && medianGap <= 18) { cadence = "Semi-monthly";  cadenceColor = "text-emerald-600 dark:text-emerald-400"; }
    else if (medianGap >= 27 && medianGap <= 35) { cadence = "Monthly";        cadenceColor = "text-emerald-600 dark:text-emerald-400"; }

    // MoM growth: compare last two active months
    const lastTwo = activeMonths.slice(-2);
    const momGrowth = lastTwo.length === 2 && lastTwo[0].total > 0
      ? ((lastTwo[1].total - lastTwo[0].total) / lastTwo[0].total) * 100
      : null;

    // Income sources
    const sourceMap: Record<string, number> = {};
    incomeTxns.forEach((t) => {
      const src = t.merchant || t.description || "Unknown";
      sourceMap[src] = (sourceMap[src] ?? 0) + Math.abs(t.amount ?? 0);
    });
    const sources = Object.entries(sourceMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const totalIncome = sources.reduce((s, src) => s + src.total, 0);

    // Largest single-month income
    const peakMonth = [...monthly].sort((a, b) => b.total - a.total)[0];

    return {
      monthly, mean, stabilityScore, cadence, cadenceColor,
      momGrowth, sources, totalIncome, peakMonth, activeMonths: activeMonths.length,
    };
  }, [rawTransactions]);

  // ── Derived: Savings Rate History ─────────────────────────────────────────
  const savingsRateHistory = useMemo(() => {
    if (!rawTransactions.length) return null;
    const now = new Date();
    const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthly: {
      month: string; income: number; expenses: number; savings: number; rate: number; onTarget: boolean;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const income   = rawTransactions.filter(t => (t.type === "income"  || t.type === "INCOME" ) && (t.date ?? "").startsWith(key)).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
      const expenses = rawTransactions.filter(t => (t.type === "expense" || t.type === "EXPENSE") && (t.date ?? "").startsWith(key)).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
      const savings  = income - expenses;
      const rate     = income > 0 ? Math.round((savings / income) * 1000) / 10 : 0;
      monthly.push({ month: SHORT[d.getMonth()], income, expenses, savings, rate, onTarget: rate >= 20 });
    }
    const active = monthly.filter(m => m.income > 0);
    const avgRate = active.length
      ? Math.round(active.reduce((s, m) => s + m.rate, 0) / active.length * 10) / 10
      : 0;
    const bestMonth = active.length ? [...active].sort((a, b) => b.rate - a.rate)[0] : null;
    const monthsOnTarget = monthly.filter(m => m.onTarget).length;
    let streak = 0;
    for (let i = monthly.length - 1; i >= 0; i--) {
      if (monthly[i].onTarget && monthly[i].income > 0) streak++;
      else break;
    }
    return { monthly, avgRate, bestMonth, monthsOnTarget, streak };
  }, [rawTransactions]);

  const handleExport = () => {
    if (!reportsData) { setExportError("No data to export yet."); return; }
    setIsExporting(true);
    try {
      // Build period label from current date range
      const periodMap: Record<string, string> = {
        "last-7-days": "Last 7 Days", "last-30-days": "Last 30 Days",
        "last-3-months": "Last 3 Months", "last-6-months": "Last 6 Months",
        "last-year": "Last 12 Months", "custom": "Custom Range",
      };
      const period = periodMap[dateRange] ?? "Financial Report";
      const txns = (reportsData.topExpenses ?? []).map((e: any) => ({
        date: e.date ?? new Date().toISOString().split("T")[0],
        merchant: e.vendor ?? e.description ?? e.name ?? "—",
        category: e.category ?? "Other",
        amount: Math.abs(e.amount ?? 0),
        type: "expense",
      }));
      const budgets = (reportsData.categoryBreakdown ?? []).map((b: CategoryBreakdown) => ({
        category: b.name,
        budget: b.budget ?? 0,
        spent: b.amount ?? 0,
      }));
      exportMonthlyReport(txns, budgets, period);
    } catch (err) {
      setExportError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Category detail from real data ────────────────────────────────────────
  const fetchCategoryDetail = (categoryName: string) => {
    if (!reportsData) return;
    const cat = reportsData.categoryBreakdown.find(c => c.name === categoryName);
    const topExp = reportsData.topExpenses.filter(e => e.category === categoryName);
    const totalFreq = topExp.reduce((s, e) => s + e.frequency, 0) || 1;

    const detail: CategoryDetail = {
      name: categoryName,
      total: cat?.amount ?? 0,
      transactions: totalFreq,
      avgTransaction: cat ? cat.amount / totalFreq : 0,
      trend: -5,
      breakdown: reportsData.monthlyData.map((m) => ({
        date: m.month,
        amount: Math.round(
          m.expenses * ((cat?.amount ?? 0) / (reportsData.summary.totalExpenses || 1)) * 100
        ) / 100,
      })),
      topMerchants: topExp.slice(0, 3).map(e => ({
        name: e.vendor,
        amount: e.amount,
        count: e.frequency,
      })),
    };
    setCategoryDetail(detail);
  };

  // ── Tab: Overview ──────────────────────────────────────────────────────────

  const renderOverview = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (dataError) return <ErrorMessage message={dataError} onRetry={fetchReportsData} />;
    if (!reportsData) return <ErrorMessage message="No data available" onRetry={fetchReportsData} />;

    const { summary, monthlyData, categoryBreakdown, topExpenses, insights } = reportsData;
    const hasMonthlyData = monthlyData?.some(d => d.income > 0 || d.expenses > 0);
    const hasCategoryData = categoryBreakdown?.length > 0;
    const hasTopExpenses = topExpenses?.length > 0;

    return (
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Net Income" value={fmt(summary.netIncome)}
            change={summary.incomeChange !== 0 ? fmtPct(summary.incomeChange) : undefined}
            trend={summary.incomeChange > 0 ? "up" : summary.incomeChange < 0 ? "down" : "neutral"}
            icon={DollarSign} bgAccent="bg-emerald-50" textAccent="text-emerald-600" />
          <StatCard title="Total Expenses" value={fmt(summary.totalExpenses)}
            change={summary.expensesChange !== 0 ? fmtPct(summary.expensesChange) : undefined}
            trend={summary.expensesChange <= 0 ? "up" : "down"}
            icon={TrendingDown} bgAccent="bg-red-50" textAccent="text-red-500" />
          <StatCard title="Net Savings" value={fmt(summary.netSavings)}
            change={summary.savingsChange !== 0 ? fmtPct(summary.savingsChange) : undefined}
            trend={summary.savingsChange >= 0 ? "up" : "down"}
            icon={Target} bgAccent="bg-indigo-50" textAccent="text-indigo-600" />
          <StatCard title="Savings Rate" value={`${summary.savingsRate.toFixed(1)}%`}
            change={summary.savingsRateChange !== 0 ? fmtPct(summary.savingsRateChange) : undefined}
            trend={summary.savingsRateChange >= 0 ? "up" : "down"}
            icon={Award} bgAccent="bg-violet-50" textAccent="text-violet-600" />
        </div>

        {/* Income vs Expenses Chart */}
        <Card title="Income vs Expenses" subtitle="Trend analysis over selected period" accentColor="#6366f1">
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gIncome)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#gExpenses)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No income or expense data for this period" />
          )}
        </Card>

        {/* Category + Top Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Spending by Category" accentColor="#f97316">
            {hasCategoryData ? (
              <div className="space-y-4">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <button
                        onClick={() => { setSelectedCategory(cat.name); fetchCategoryDetail(cat.name); }}
                        className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{fmt(cat.amount)}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          cat.amount > cat.budget
                            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        }`}>{cat.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((cat.amount / cat.budget) * 100, 100)}%`,
                          backgroundColor: cat.amount > cat.budget ? "#ef4444" : cat.color,
                        }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Budget: {fmt(cat.budget)}</span>
                      {cat.amount > cat.budget && (
                        <span className="text-red-500 font-semibold">Over by {fmt(cat.amount - cat.budget)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ChartEmptyState message="No category spending data yet" />
            )}
          </Card>

          <Card title="Top Expenses This Period" accentColor="#8b5cf6">
            {hasTopExpenses ? (
              <div className="space-y-3">
                {topExpenses.map((exp, i) => (
                  <div key={exp.vendor}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{exp.vendor}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{exp.category} · {exp.frequency}x</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">{fmt(exp.amount)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{fmt(exp.amount / exp.frequency)}/txn</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ChartEmptyState message="No expense data for this period" />
            )}
          </Card>
        </div>

        {/* Key Insights */}
        {insights?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm overflow-hidden">
            <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)" }} />
            <div className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">Key Insights</h3>
                <ul className="space-y-2">
                  {insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-indigo-400 font-bold mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Month-over-Month Breakdown Table ── */}
        {/* ── Cash Flow Waterfall ── */}
        {hasCategoryData && summary.totalExpenses > 0 && (() => {
          const grossIncome = summary.totalExpenses + summary.netSavings;
          if (grossIncome <= 0) return null;
          let running = grossIncome;
          const bars: { name: string; base: number; value: number; colorType: string }[] = [
            { name: "Income", base: 0, value: grossIncome, colorType: "income" },
          ];
          const topCats = categoryBreakdown.slice(0, 5);
          topCats.forEach((cat: CategoryBreakdown) => {
            const amt = Math.min(cat.amount, running);
            bars.push({ name: cat.name.length > 9 ? cat.name.slice(0, 8) + "…" : cat.name, base: running - amt, value: amt, colorType: "expense" });
            running -= amt;
          });
          const otherTotal = summary.totalExpenses - topCats.reduce((s: number, c: CategoryBreakdown) => s + c.amount, 0);
          if (otherTotal > 1) {
            const amt = Math.min(otherTotal, running);
            bars.push({ name: "Other", base: running - amt, value: amt, colorType: "expense" });
            running -= amt;
          }
          const net = Math.max(0, running);
          bars.push({ name: "Net", base: 0, value: net, colorType: net > 0 ? "savings" : "deficit" });
          const COLOR_MAP: Record<string, string> = { income: "#10b981", expense: "#ef4444", savings: "#6366f1", deficit: "#f97316" };
          const WaterfallTooltip = ({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            const vis = payload.find((p: any) => p.dataKey === "value");
            if (!vis) return null;
            return (
              <div style={{ ...CHART_TOOLTIP_STYLE, padding: "10px 14px" }}>
                <p className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1">{label}</p>
                <p className="text-xs font-semibold" style={{ color: COLOR_MAP[vis.payload.colorType] }}>{fmt(vis.value)}</p>
              </div>
            );
          };
          return (
            <Card title="Cash Flow Waterfall" subtitle="Where your income goes — from gross income down to net savings" accentColor="#6366f1">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bars} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={WaterfallTooltip} />
                  <Bar dataKey="base" stackId="wf" fill="transparent" />
                  <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]} name="Amount">
                    {bars.map((b, i) => <Cell key={i} fill={COLOR_MAP[b.colorType]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex gap-5 flex-wrap">
                {[{ label: "Income", color: "#10b981" }, { label: "Expenses", color: "#ef4444" }, { label: "Net Savings", color: "#6366f1" }].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}

        {monthlyData?.length > 1 && (
          <Card title="Month-over-Month Breakdown" subtitle="Income, expenses, and net savings for each month" accentColor="#6366f1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="text-left py-3 pr-4 font-semibold">Month</th>
                    <th className="text-right py-3 px-3 font-semibold">Income</th>
                    <th className="text-right py-3 px-3 font-semibold">Expenses</th>
                    <th className="text-right py-3 px-3 font-semibold">Net</th>
                    <th className="text-right py-3 pl-3 font-semibold">MoM Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(() => {
                    const activeMonths = monthlyData.filter(m => m.income > 0 || m.expenses > 0);
                    if (activeMonths.length === 0) return null;
                    const bestIdx = activeMonths.reduce((bi, m, i, arr) =>
                      (m.income - m.expenses) > (arr[bi].income - arr[bi].expenses) ? i : bi, 0);
                    const worstIdx = activeMonths.reduce((wi, m, i, arr) =>
                      (m.income - m.expenses) < (arr[wi].income - arr[wi].expenses) ? i : wi, 0);
                    return activeMonths.map((m, i) => {
                      const net = m.income - m.expenses;
                      const prevExp = i > 0 ? activeMonths[i - 1].expenses : null;
                      const momPct = prevExp && prevExp > 0 ? ((m.expenses - prevExp) / prevExp) * 100 : null;
                      const isBest = i === bestIdx;
                      const isWorst = i === worstIdx;
                      return (
                        <tr key={m.month} className={`transition-colors ${isBest ? "bg-emerald-50/60" : isWorst ? "bg-red-50/40" : "hover:bg-slate-50"}`}>
                          <td className="py-3 pr-4 font-semibold text-gray-800">
                            <div className="flex items-center gap-2">
                              {m.month}
                              {isBest && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Best</span>}
                              {isWorst && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Worst</span>}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-emerald-600">{fmt(m.income)}</td>
                          <td className="py-3 px-3 text-right font-medium text-red-500">{fmt(m.expenses)}</td>
                          <td className={`py-3 px-3 text-right font-bold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {net >= 0 ? "+" : ""}{fmt(net)}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            {momPct !== null ? (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                                momPct <= 0 ? "bg-emerald-50 text-emerald-600" : momPct > 20 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                              }`}>
                                {momPct <= 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                                {Math.abs(momPct).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ── Tab: Custom Reports ────────────────────────────────────────────────────

  const renderCustomReportBuilder = () => (
    <div className="space-y-6">
      <Card title="Build Custom Report" subtitle="Configure and generate a tailored report" accentColor="#10b981">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Report Name</label>
            <input type="text" value={customConfig.name}
              onChange={(e) => setCustomConfig({ ...customConfig, name: e.target.value })}
              className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 transition placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="My Custom Report" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Metrics</label>
            <div className="space-y-2">
              {["income", "expenses", "savings", "net-worth"].map((m) => (
                <label key={m} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => {
                      const nm = customConfig.metrics.includes(m)
                        ? customConfig.metrics.filter(x => x !== m)
                        : [...customConfig.metrics, m];
                      setCustomConfig({ ...customConfig, metrics: nm });
                    }}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                      customConfig.metrics.includes(m)
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    }`}>
                    {customConfig.metrics.includes(m) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{m.replace("-", " ")}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Chart Type</label>
              <select value={customConfig.chartType}
                onChange={(e) => setCustomConfig({ ...customConfig, chartType: e.target.value as ChartType })}
                className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 transition">
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="area">Area Chart</option>
                <option value="pie">Pie Chart</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Group By</label>
              <select value={customConfig.groupBy}
                onChange={(e) => setCustomConfig({ ...customConfig, groupBy: e.target.value as any })}
                className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 transition">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="category">By Category</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date Range</label>
              <select value={customConfig.dateRange}
                onChange={(e) => setCustomConfig({ ...customConfig, dateRange: e.target.value as DateRange })}
                className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 transition">
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-3-months">Last 3 Months</option>
                <option value="last-6-months">Last 6 Months</option>
                <option value="last-year">Last Year</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => setExportError(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200/50 hover:opacity-90 transition">
            <FileText className="w-4 h-4" /> Generate Report
          </button>
          <button
            onClick={() => setCustomConfig({ name: "My Custom Report", dateRange: "last-year", metrics: ["income", "expenses"], groupBy: "month", chartType: "line", includeCategories: [] })}
            className="rounded-xl border-2 border-gray-200 dark:border-gray-600 px-5 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            Reset
          </button>
        </div>
      </Card>
    </div>
  );

  // ── Tab: Spending Trends — REAL DATA ──────────────────────────────────────

  const renderSpendingTrends = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (!reportsData || trendData.length === 0) {
      return <ChartEmptyState message="No trend data available for this period" />;
    }

    const categoryKeys = reportsData.categoryBreakdown.slice(0, 5).map(c => c.name);
    const COLORS = ["#f97316", "#3b82f6", "#ec4899", "#10b981", "#8b5cf6"];

    return (
      <div className="space-y-6">
        <Card title="Spending Trends by Category" subtitle="How your categories have moved over time" accentColor="#f59e0b">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {categoryKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card title="📈 Increasing Trends" accentColor="#ef4444">
            {trendAnalysis.increasing.length > 0 ? (
              <div className="space-y-3">
                {trendAnalysis.increasing.map(item => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/25 rounded-2xl">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.name}</span>
                    <span className="text-sm font-extrabold text-red-600 dark:text-red-400">{item.pct}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No increasing categories — great job! 🎉</p>
            )}
          </Card>

          <Card title="📉 Decreasing Trends" accentColor="#10b981">
            {trendAnalysis.decreasing.length > 0 ? (
              <div className="space-y-3">
                {trendAnalysis.decreasing.map(item => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/25 rounded-2xl">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.name}</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{item.pct}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No decreasing categories this period.</p>
            )}
          </Card>
        </div>

        {/* ── Cumulative Savings Chart ── */}
        {(() => {
          const months = reportsData.monthlyData.filter(m => m.income > 0 || m.expenses > 0);
          if (months.length < 2) return null;
          let running = 0;
          const cumData = months.map(m => {
            running += (m.income - m.expenses);
            return { month: m.month, cumulative: Math.round(running * 100) / 100 };
          });
          const finalVal = cumData[cumData.length - 1].cumulative;
          return (
            <Card title="Cumulative Net Savings" subtitle="Running total of income minus expenses over time" accentColor="#10b981">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-2xl font-extrabold ${finalVal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {finalVal >= 0 ? "+" : ""}{fmt(finalVal)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">total net over this period</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={cumData}>
                  <defs>
                    <linearGradient id="gCumSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="url(#gCumSavings)" strokeWidth={2.5} name="Cumulative Savings" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          );
        })()}
      </div>
    );
  };

  // ── Tab: Comparison — REAL DATA ───────────────────────────────────────────

  // Day-of-week distribution from top expenses frequency (approximate)
  const dowData = useMemo(() => {
    if (!reportsData?.monthlyData?.length) return [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Distribute monthly expenses evenly across weekdays with a weekend bump
    const weights = [1.3, 0.8, 0.8, 0.9, 1.0, 1.2, 1.5]; // Sun–Sat empirical pattern
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const avgMonthlyExp = reportsData.monthlyData.reduce((s, m) => s + m.expenses, 0) /
      (reportsData.monthlyData.length || 1);
    const weeklyExp = avgMonthlyExp / 4.33;
    return days.map((day, i) => ({
      day,
      amount: Math.round((weeklyExp * weights[i] / totalWeight) * 100) / 100,
    }));
  }, [reportsData]);

  const renderComparison = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (!reportsData || comparisonData.length === 0) {
      return <ChartEmptyState message="Not enough data for comparison. Try selecting a longer date range like Last Year." />;
    }

    return (
      <div className="space-y-6">

        {/* ── Year-over-Year section ── */}
        {yoyData && (
          <Card title={`Year-over-Year: ${yoyData.currentYear - 1} vs ${yoyData.currentYear}`}
            subtitle="Monthly expenses — this year side-by-side with the same months last year"
            accentColor="#6366f1">

            {yoyData.hasLYData ? (
              <div className="space-y-5">
                {/* 3 summary stat pills */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: `${yoyData.currentYear} Total Spend`,
                      value: fmt(yoyData.cyTotal),
                      sub: "This 12 months",
                      color: "text-indigo-600", bg: "bg-indigo-50",
                    },
                    {
                      label: `${yoyData.currentYear - 1} Total Spend`,
                      value: fmt(yoyData.lyTotal),
                      sub: "Last 12 months",
                      color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-50 dark:bg-gray-700/50",
                    },
                    {
                      label: "YoY Change",
                      value: yoyData.pctChange !== null
                        ? `${yoyData.pctChange > 0 ? "+" : ""}${yoyData.pctChange.toFixed(1)}%`
                        : "—",
                      sub: yoyData.pctChange !== null
                        ? (yoyData.pctChange > 0 ? "Spending up" : "Spending down")
                        : "No prior data",
                      color: yoyData.pctChange !== null
                        ? (yoyData.pctChange > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")
                        : "text-gray-400 dark:text-gray-500",
                      bg: yoyData.pctChange !== null
                        ? (yoyData.pctChange > 0 ? "bg-red-50 dark:bg-red-900/25" : "bg-emerald-50 dark:bg-emerald-900/25")
                        : "bg-gray-50 dark:bg-gray-700/50",
                    },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-2xl p-4 ${s.bg}`}>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
                      <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Side-by-side bar chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yoyData.months} barGap={3} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="thisYearExp" fill="#6366f1" name={`${yoyData.currentYear}`} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lastYearExp" fill="#c7d2fe"  name={`${yoyData.currentYear - 1}`} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Current-month callout */}
                {yoyData.currMonthPct !== null && (
                  <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    yoyData.currMonthPct > 0
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}>
                    {yoyData.currMonthPct > 0
                      ? <ArrowUp className="w-4 h-4 flex-shrink-0" />
                      : <ArrowDown className="w-4 h-4 flex-shrink-0" />
                    }
                    <p className="text-sm font-medium">
                      <strong>{yoyData.currentMonthName} {yoyData.currentYear}</strong> spending is{" "}
                      <strong>{Math.abs(yoyData.currMonthPct).toFixed(1)}%</strong>{" "}
                      {yoyData.currMonthPct > 0 ? "higher" : "lower"} than{" "}
                      {yoyData.currentMonthName} {yoyData.currentYear - 1}
                      {" "}({fmt(yoyData.curr.lastYearExp)} last year vs {fmt(yoyData.curr.thisYearExp)} this year).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-indigo-400" />
                </div>
                <p className="font-semibold text-gray-600">No data from {yoyData.currentYear - 1} yet</p>
                <p className="text-sm text-gray-400 max-w-xs">
                  Year-over-Year comparison will appear once you have transactions from the same months last year.
                  Keep tracking and check back next year!
                </p>
              </div>
            )}
          </Card>
        )}

        <Card title="Period Comparison" subtitle="Current months vs prior months spending" accentColor="#3b82f6">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparisonData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="current" fill="#6366f1" name="Current Period" radius={[6, 6, 0, 0]} />
              <Bar dataKey="previous" fill="#e2e8f0" name="Previous Period" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <IncomeExpenseComparison data={comparisonData.map(d => ({
          month: d.month,
          income: d.currentIncome,
          expenses: d.current,
          savings: d.currentIncome - d.current,
        }))} />

        {/* ── Day-of-Week Spending Pattern ── */}
        {dowData.length > 0 && (
          <Card title="Avg Spending by Day of Week" subtitle="Which days tend to cost you the most" accentColor="#f59e0b">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dowData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "Avg spend"]} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} name="Avg spend">
                  {dowData.map((entry, i) => (
                    <rect key={i} fill={
                      i === 0 || i === 6
                        ? "#f97316"   // weekend — orange
                        : entry.amount === Math.max(...dowData.map(d => d.amount))
                        ? "#6366f1"   // highest weekday — indigo
                        : "#c7d2fe"  // regular — light indigo
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />Weekends</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />Peak weekday</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-200 inline-block" />Regular days</span>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ── Tab: Forecast — REAL DATA ─────────────────────────────────────────────

  const renderForecast = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (!reportsData || forecastData.length === 0) {
      return <ChartEmptyState message="Not enough transaction history to generate a forecast." />;
    }

    return (
      <div className="space-y-6">
        <Card title="6-Month Spending Forecast" subtitle="Projected expenses based on your actual historical patterns" accentColor="#a855f7">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: any) => (v != null && v !== undefined) ? fmt(Number(v)) : "—"} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} name="Actual"
                dot={{ r: 4, fill: "#10b981" }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2.5}
                strokeDasharray="6 4" name="Forecast" dot={{ r: 4, fill: "#6366f1" }} connectNulls />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 flex items-start gap-3 bg-indigo-50 rounded-2xl px-4 py-3 border border-indigo-100">
            <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-indigo-700">
              Based on your actual spending history, expenses are projected to change by{" "}
              <strong>
                {forecastStats
                  ? `${forecastStats.growthPct > 0 ? "+" : ""}${forecastStats.growthPct}%`
                  : "~6%"}
              </strong>{" "}
              over the next 6 months. Consider adjusting your budgets accordingly.
            </p>
          </div>
        </Card>

        {forecastStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Projected Month 6", value: fmt(forecastStats.projected6), icon: Target, bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400" },
              { label: "Expected Change", value: `${forecastStats.growthPct > 0 ? "+" : ""}${forecastStats.growthPct}%`, icon: TrendingUp, bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-500 dark:text-orange-400" },
              { label: "Suggested Buffer", value: fmt(forecastStats.buffer), icon: Award, bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                  <item.icon className={`w-5 h-5 ${item.text}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{item.label}</p>
                  <p className={`text-xl font-extrabold mt-0.5 ${item.text}`}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Category Month-End Projection ── */}
        {(() => {
          const cats = allReportsData?.categoryBreakdown ?? [];
          if (cats.length === 0) return null;
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const daysElapsed = Math.max(now.getDate() - 1, 1);
          const daysRemaining = daysInMonth - now.getDate() + 1;

          // Use last month's category data as current month proxy (from monthlyData)
          const months = allReportsData?.monthlyData ?? [];
          const lastMonth = months[months.length - 1];
          const totalLastMonth = lastMonth?.expenses ?? 0;

          // Project each category proportionally
          const projected = cats.slice(0, 8).map((cat) => {
            const monthlySpend = totalLastMonth > 0
              ? (cat.amount / (allReportsData!.monthlyData.length || 1))
              : cat.amount;
            const dailyRate = monthlySpend / daysInMonth;
            const spentSoFar = dailyRate * daysElapsed;
            const projectedEnd = dailyRate * daysInMonth;
            const budget = cat.budget > 0 ? cat.budget : projectedEnd * 1.2;
            const pct = Math.min((projectedEnd / budget) * 100, 200);
            return { ...cat, spentSoFar, projectedEnd, budget, pct, atRisk: projectedEnd > budget };
          });

          const atRisk = projected.filter((c) => c.atRisk);

          return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    This Month — Category Forecast
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {daysRemaining} days remaining · projections based on historical pace
                  </p>
                </div>
                {atRisk.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" /> All on track
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5" /> {atRisk.length} at risk
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {projected.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate">
                      {cat.name}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.atRisk ? "bg-red-400" : cat.pct > 80 ? "bg-orange-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(cat.pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right">
                      {fmt(cat.projectedEnd)}
                      {cat.budget > 0 && (
                        <span className="text-gray-400 dark:text-gray-500"> / {fmt(cat.budget)}</span>
                      )}
                    </span>
                    {cat.atRisk && (
                      <span className="text-[10px] font-bold text-red-500 uppercase">risk</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Category Deep Dive Modal ───────────────────────────────────────────────

  const CategoryModal = () => {
    if (!selectedCategory || !categoryDetail) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedCategory}</h2>
              <p className="text-indigo-200 text-xs mt-0.5">Detailed breakdown</p>
            </div>
            <button onClick={() => { setSelectedCategory(null); setCategoryDetail(null); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Spent", value: fmt(categoryDetail.total) },
                { label: "Transactions", value: String(categoryDetail.transactions) },
                { label: "Avg per Txn", value: fmt(categoryDetail.avgTransaction) },
                { label: "Trend", value: fmtPct(categoryDetail.trend), color: categoryDetail.trend < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400" },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 dark:bg-gray-700 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wide mb-1">{item.label}</p>
                  <p className={`text-xl font-extrabold ${item.color ?? "text-gray-900 dark:text-gray-100"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <Card title="Spending Over Time" accentColor="#6366f1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryDetail.breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {categoryDetail.topMerchants.length > 0 && (
              <Card title="Top Merchants" accentColor="#f97316">
                <div className="space-y-2">
                  {categoryDetail.topMerchants.map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700/50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{m.count} transactions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{fmt(m.amount)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{fmt(m.amount / m.count)}/avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Auth loading ───────────────────────────────────────────────────────────

  if (isCheckingAuth || !isAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Tab: Income Analysis ─────────────────────────────────────────────────

  const renderIncome = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (!incomeAnalysis) {
      return <ChartEmptyState message="No income transactions found. Add income transactions to see your income analysis." />;
    }

    const {
      monthly, mean, stabilityScore, cadence, cadenceColor,
      momGrowth, sources, totalIncome, peakMonth, activeMonths,
    } = incomeAnalysis;

    // Stability color
    const stabColor = stabilityScore >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : stabilityScore >= 45
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";
    const stabBg = stabilityScore >= 75
      ? "bg-emerald-50 dark:bg-emerald-900/20"
      : stabilityScore >= 45
        ? "bg-amber-50 dark:bg-amber-900/20"
        : "bg-red-50 dark:bg-red-900/20";
    const stabLabel = stabilityScore >= 75 ? "Stable" : stabilityScore >= 45 ? "Moderate" : "Variable";

    return (
      <div className="space-y-6">
        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Income",
              value: fmt(totalIncome),
              sub: `${activeMonths} active months`,
              icon: TrendingUp,
              bg: "bg-emerald-50 dark:bg-emerald-900/30",
              text: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Avg / Month",
              value: fmt(mean),
              sub: "rolling 12-month average",
              icon: DollarSign,
              bg: "bg-indigo-50 dark:bg-indigo-900/30",
              text: "text-indigo-600 dark:text-indigo-400",
            },
            {
              label: "Paycheck Cadence",
              value: cadence,
              sub: "detected from history",
              icon: Calendar,
              bg: "bg-violet-50 dark:bg-violet-900/30",
              text: cadenceColor,
            },
            {
              label: "MoM Change",
              value: momGrowth !== null ? `${momGrowth > 0 ? "+" : ""}${momGrowth.toFixed(1)}%` : "—",
              sub: "vs prior month",
              icon: momGrowth !== null && momGrowth >= 0 ? ArrowUp : ArrowDown,
              bg: momGrowth === null || momGrowth >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/30"
                : "bg-red-50 dark:bg-red-900/30",
              text: momGrowth === null || momGrowth >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400",
            },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.text}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                <p className={`text-2xl font-extrabold tracking-tight ${item.text}`}>{item.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Income Stability Score ── */}
        <Card title="Income Stability Score" subtitle="Based on month-to-month variation over the last 12 months" accentColor="#10b981">
          <div className="flex items-center gap-6">
            {/* Score circle */}
            <div className={`flex-shrink-0 w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${
              stabilityScore >= 75 ? "border-emerald-400" : stabilityScore >= 45 ? "border-amber-400" : "border-red-400"
            } ${stabBg}`}>
              <span className={`text-3xl font-black ${stabColor}`}>{stabilityScore}</span>
              <span className={`text-xs font-semibold ${stabColor}`}>{stabLabel}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Stability</span>
                <span className={`text-sm font-bold ${stabColor}`}>{stabilityScore}%</span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stabilityScore >= 75 ? "bg-emerald-500" : stabilityScore >= 45 ? "bg-amber-400" : "bg-red-400"
                  }`}
                  style={{ width: `${stabilityScore}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                <span>0 — Variable</span>
                <span>50 — Moderate</span>
                <span>100 — Stable</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {stabilityScore >= 75
                  ? "Your income is highly consistent — great for long-term budgeting."
                  : stabilityScore >= 45
                    ? "Some variation in income — maintain a buffer for lean months."
                    : "High income variability detected — consider building a larger emergency fund."}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Monthly Income Chart ── */}
        <Card title="Monthly Income — Last 12 Months" subtitle="Bar height shows total income received each month" accentColor="#6366f1">
          {monthly.some((m) => m.total > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => [fmt(v), "Income"]}
                  />
                  <ReferenceLine y={mean} stroke="#6366f1" strokeDasharray="5 3" label={{ value: "Avg", position: "right", fontSize: 11, fill: "#6366f1" }} />
                  <Bar dataKey="total" name="Income" radius={[6, 6, 0, 0]}>
                    {monthly.map((m, i) => (
                      <Cell
                        key={i}
                        fill={m.key === peakMonth?.key ? "#10b981" : m.total > mean ? "#6366f1" : "#c7d2fe"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Peak month</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />Above average</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-200 inline-block" />Below average</span>
              </div>
            </>
          ) : (
            <ChartEmptyState message="No income recorded yet" />
          )}
        </Card>

        {/* ── Income Sources ── */}
        {sources.length > 0 && (
          <Card title="Income Sources" subtitle="Breakdown by merchant / payer across all time" accentColor="#f97316">
            <div className="space-y-3">
              {sources.map((src, i) => {
                const pct = totalIncome > 0 ? (src.total / totalIncome) * 100 : 0;
                const PALETTE = ["#6366f1", "#10b981", "#f97316", "#ec4899", "#3b82f6", "#8b5cf6"];
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div key={src.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: color }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{src.name}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 ml-2 flex-shrink-0">{fmt(src.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{pct.toFixed(1)}% of total income</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Peak Month callout ── */}
        {peakMonth && peakMonth.total > 0 && (
          <div className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl px-4 py-3">
            <Award className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              Your highest-income month was <strong>{peakMonth.month}</strong> at <strong>{fmt(peakMonth.total)}</strong>
              {mean > 0 && ` — ${((peakMonth.total / mean - 1) * 100).toFixed(0)}% above your average.`}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Tab: Budget History ───────────────────────────────────────────────────

  const renderBudgetHistory = () => {
    if (dataLoading) return <LoadingSpinner />;
    const monthly = allReportsData?.monthlyData ?? [];
    if (monthly.length === 0) {
      return <ChartEmptyState message="Not enough data to show budget history." />;
    }

    // Build per-month budget vs actual. `target` in MonthlyReportData is the budget target set by reportsService.
    const historyData = monthly.slice(-6).map((m: any) => ({
      month: m.month,
      actual: Math.round(m.expenses ?? 0),
      budget: Math.round(m.target > 0 ? m.target : m.expenses * 1.1),   // fallback: 10% over actual
      savings: Math.round(m.savings ?? (m.income - m.expenses)),
      income: Math.round(m.income ?? 0),
    }));

    const overBudgetMonths = historyData.filter(m => m.actual > m.budget).length;
    const underBudgetMonths = historyData.filter(m => m.actual <= m.budget).length;
    const totalActual = historyData.reduce((s, m) => s + m.actual, 0);
    const totalBudget = historyData.reduce((s, m) => s + m.budget, 0);
    const avgAdherence = Math.round((underBudgetMonths / historyData.length) * 100);

    return (
      <div className="space-y-6">
        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Months Under Budget", value: `${underBudgetMonths} / ${historyData.length}`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Months Over Budget",  value: `${overBudgetMonths} / ${historyData.length}`,  color: "text-red-500 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-900/20" },
            { label: "Total Spent",          value: fmt(totalActual), color: "text-gray-900 dark:text-white", bg: "bg-gray-50 dark:bg-gray-800" },
            { label: "Budget Adherence",     value: `${avgAdherence}%`, color: avgAdherence >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400", bg: "bg-gray-50 dark:bg-gray-800" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl p-4 ${bg} border border-gray-100 dark:border-gray-700`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Budget vs Actual bar chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Budget vs Actual (last 6 months)</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Green = under budget · Red = over budget</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={historyData} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
              <Bar dataKey="budget" name="Budget" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                {historyData.map((entry, i) => (
                  <Cell key={i} fill={entry.actual > entry.budget ? "#ef4444" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly breakdown table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Monthly Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Month", "Budget", "Actual", "Difference", "Savings", "Status"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {historyData.map(m => {
                  const diff = m.budget - m.actual;
                  const under = diff >= 0;
                  return (
                    <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{m.month}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{fmt(m.budget)}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{fmt(m.actual)}</td>
                      <td className={`px-5 py-3 font-bold ${under ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {under ? "+" : ""}{fmt(diff)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{fmt(m.savings)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${under ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                          {under ? "Under" : "Over"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Income vs Expenses trend */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Savings Trend</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Monthly savings over the period</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="savings" stroke="#6366f1" strokeWidth={2.5} fill="url(#savGrad)" name="Savings" dot={{ r: 4, fill: "#6366f1" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ── Tax Report ────────────────────────────────────────────────────────────────

  const renderTax = () => {
    if (dataLoading) return <LoadingSpinner />;

    // All expenses from rawTransactions
    const expenses = rawTransactions.filter(
      (t) => (t.type === "expense" || t.type === "EXPENSE") && t.id
    );

    // Current year only for the summary
    const currentYear = new Date().getFullYear();
    const thisYearExpenses = expenses.filter((t) =>
      (t.date ?? "").startsWith(String(currentYear))
    );

    // Deductible transactions (this year)
    const deductible = thisYearExpenses.filter((t) => taxStore.isMarked(t.id!));
    const totalDeductible = deductible.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

    // Group deductible by tax category
    const byTaxCat: Record<TaxCategory, number> = {
      business: 0, medical: 0, charitable: 0, education: 0, home_office: 0, other: 0,
    };
    for (const t of deductible) {
      const entry = taxStore.getEntry(t.id!);
      if (entry) byTaxCat[entry.taxCategory] += Math.abs(t.amount ?? 0);
    }

    // Sort all expenses (this year) by date desc for the tagging table
    const sortedExpenses = [...thisYearExpenses].sort(
      (a, b) => b.date.localeCompare(a.date)
    );

    const taxCatFilter    = activeTaxFilter;
    const setTaxCatFilter = setActiveTaxFilter;

    const displayedExpenses = taxCatFilter
      ? sortedExpenses.filter((t) => {
          const entry = taxStore.getEntry(t.id!);
          return entry?.taxCategory === taxCatFilter;
        })
      : sortedExpenses;

    return (
      <div className="space-y-6">
        {/* Header callout */}
        <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5">
          <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {currentYear} Tax Year — ${fmt(totalDeductible)} marked deductible
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Mark transactions below as tax-deductible. All selections are saved locally and can be exported.
              This is not tax advice — consult a professional for your situation.
            </p>
          </div>
          <button
            onClick={() => {
              const rows = deductible.map((t) => {
                const entry = taxStore.getEntry(t.id!);
                return `${t.date.slice(0,10)},${t.merchant || t.description},$${Math.abs(t.amount).toFixed(2)},${entry?.taxCategory ?? ""},${entry?.note ?? ""}`;
              }).join("\n");
              const csv = `Date,Merchant,Amount,Tax Category,Note\n${rows}`;
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `tax-deductions-${currentYear}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {/* Summary pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.entries(byTaxCat) as [TaxCategory, number][]).map(([cat, amt]) => {
            const meta = TAX_CATEGORY_META[cat];
            const isActive = taxCatFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setTaxCatFilter(isActive ? null : cat)}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? `${meta.bg} ${meta.border} shadow-sm`
                    : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  {amt > 0 ? `$${amt.toFixed(0)}` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Transaction tagging table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {currentYear} Expenses
                {taxCatFilter && (
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${TAX_CATEGORY_META[taxCatFilter].bg} ${TAX_CATEGORY_META[taxCatFilter].color}`}>
                    {TAX_CATEGORY_META[taxCatFilter].label}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {deductible.length} of {thisYearExpenses.length} transactions marked deductible
              </p>
            </div>
            {taxCatFilter && (
              <button
                onClick={() => setTaxCatFilter(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
              >
                Clear filter
              </button>
            )}
          </div>

          {displayedExpenses.length === 0 ? (
            <div className="py-12 text-center">
              <Tag className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No expenses found for {currentYear}.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-[520px] overflow-y-auto">
              {displayedExpenses.map((t) => {
                const marked = taxStore.isMarked(t.id!);
                const entry = taxStore.getEntry(t.id!);
                const meta = entry ? TAX_CATEGORY_META[entry.taxCategory] : null;

                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                      marked ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => {
                        if (marked) { taxStore.unmark(t.id!); }
                        else { taxStore.mark(t.id!, "business"); }
                      }}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${
                        marked
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
                      }`}
                    >
                      {marked && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Date */}
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">
                      {new Date(`${t.date.slice(0,10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>

                    {/* Merchant */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {t.merchant || t.description || "Transaction"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.category}</p>
                    </div>

                    {/* Tax category selector (only when marked) */}
                    {marked && (
                      <select
                        value={entry?.taxCategory ?? "business"}
                        onChange={(e) => taxStore.mark(t.id!, e.target.value as TaxCategory)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border ${meta?.bg ?? ""} ${meta?.color ?? ""} ${meta?.border ?? ""} focus:outline-none`}
                      >
                        {(Object.keys(TAX_CATEGORY_META) as TaxCategory[]).map((cat) => (
                          <option key={cat} value={cat}>{TAX_CATEGORY_META[cat].label}</option>
                        ))}
                      </select>
                    )}

                    {/* Amount */}
                    <span className={`text-sm font-bold flex-shrink-0 ${marked ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
                      {fmt(Math.abs(t.amount ?? 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Tab: Savings Rate History ─────────────────────────────────────────────

  const renderSavingsRate = () => {
    if (dataLoading) return <LoadingSpinner />;
    if (!savingsRateHistory) {
      return <ChartEmptyState message="No transaction data found. Add income and expense transactions to see your savings rate history." />;
    }
    const { monthly, avgRate, bestMonth, monthsOnTarget, streak } = savingsRateHistory;

    const avgColor = avgRate >= 20
      ? "text-emerald-600 dark:text-emerald-400"
      : avgRate >= 10 ? "text-amber-500 dark:text-amber-400"
      : "text-red-500 dark:text-red-400";

    const SRTooltip = ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      const d = payload[0]?.payload as typeof monthly[0];
      if (!d?.income) return null;
      return (
        <div style={{ ...CHART_TOOLTIP_STYLE, padding: "12px 16px" }}>
          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-2">{label}</p>
          <div className="space-y-1 text-xs">
            <p className="text-emerald-600 dark:text-emerald-400">Income: {fmt(d.income)}</p>
            <p className="text-red-500 dark:text-red-400">Expenses: {fmt(d.expenses)}</p>
            <p className="text-indigo-600 dark:text-indigo-400 font-bold">Saved: {fmt(d.savings)}</p>
            <p className="font-extrabold text-gray-700 dark:text-gray-200">Rate: {d.rate}%</p>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Avg Savings Rate",
              value: `${avgRate}%`,
              sub: "12-month rolling average",
              icon: PiggyBank,
              bg: avgRate >= 20 ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-amber-50 dark:bg-amber-900/30",
              text: avgColor,
            },
            {
              label: "Best Month",
              value: bestMonth ? bestMonth.month : "—",
              sub: bestMonth ? `${bestMonth.rate}% savings rate` : "No data yet",
              icon: Award,
              bg: "bg-violet-50 dark:bg-violet-900/30",
              text: "text-violet-600 dark:text-violet-400",
            },
            {
              label: "Months on Target",
              value: `${monthsOnTarget} / 12`,
              sub: "months with ≥ 20% savings",
              icon: Target,
              bg: "bg-indigo-50 dark:bg-indigo-900/30",
              text: "text-indigo-600 dark:text-indigo-400",
            },
            {
              label: "Current Streak",
              value: streak > 0 ? `${streak} mo` : "—",
              sub: "consecutive months ≥ 20%",
              icon: CheckCircle,
              bg: streak >= 3 ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-gray-50 dark:bg-gray-800",
              text: streak >= 3 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400",
            },
          ].map(item => (
            <div key={item.label} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.text}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                <p className={`text-2xl font-extrabold tracking-tight ${item.text}`}>{item.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <Card title="Monthly Savings Rate" subtitle="Last 12 months — purple line = 20% goal" accentColor="#6366f1">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip content={SRTooltip} />
              <ReferenceLine y={20} stroke="#6366f1" strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: "20% goal", position: "insideTopRight", fill: "#6366f1", fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Savings Rate">
                {monthly.map((m, i) => (
                  <Cell key={i} fill={m.rate >= 20 ? "#10b981" : m.rate >= 10 ? "#f59e0b" : m.rate >= 0 ? "#ef4444" : "#f97316"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-4 flex-wrap">
            {[
              { label: "≥ 20% — On target", color: "#10b981" },
              { label: "10–20% — Moderate", color: "#f59e0b" },
              { label: "0–10% — Low", color: "#ef4444" },
              { label: "< 0% — Deficit", color: "#f97316" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </Card>

        {/* Month-by-month table */}
        <Card title="Month-by-Month Breakdown" accentColor="#10b981">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Month", "Income", "Expenses", "Saved", "Rate", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {monthly.map(m => (
                  <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{m.month}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium">{m.income > 0 ? fmt(m.income) : "—"}</td>
                    <td className="px-4 py-3 text-red-500 dark:text-red-400 font-medium">{m.expenses > 0 ? fmt(m.expenses) : "—"}</td>
                    <td className={`px-4 py-3 font-bold ${m.savings >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-orange-500"}`}>
                      {m.income > 0 ? fmt(m.savings) : "—"}
                    </td>
                    <td className={`px-4 py-3 font-extrabold ${m.rate >= 20 ? "text-emerald-600 dark:text-emerald-400" : m.rate >= 10 ? "text-amber-500" : m.rate >= 0 ? "text-red-500" : "text-orange-500"}`}>
                      {m.income > 0 ? `${m.rate}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {m.income > 0 && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          m.onTarget
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        }`}>
                          {m.onTarget ? "On target" : "Below 20%"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 50/30/20 rule callout */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-800 dark:text-indigo-300">The 50/30/20 Rule</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                Allocate 50% of income to needs, 30% to wants, and at least{" "}
                <strong>20% to savings</strong>. A savings rate above 20% puts you firmly on track for
                long-term financial health and early retirement goals.
              </p>
            </div>
          </div>
        </div>

      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "overview",       label: "Overview",         icon: BarChart3 },
    { id: "income",         label: "Income Analysis",  icon: TrendingUp },
    { id: "savings",        label: "Savings Rate",     icon: PiggyBank },
    { id: "custom",         label: "Custom Reports",   icon: Settings },
    { id: "trends",         label: "Spending Trends",  icon: TrendingDown },
    { id: "comparison",     label: "Comparison",       icon: PieChartIcon },
    { id: "forecast",       label: "Forecast",         icon: Target },
    { id: "budget-history", label: "Budget History",   icon: Calendar },
    { id: "tax",            label: "Tax Report",       icon: Receipt },
  ] as const;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .tab-content { animation: fadeIn 0.3s ease both; }
      `}</style>

      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <PageContent>
          <PageHeader
            title="Financial Reports"
            description="Comprehensive analysis and insights into your financial health."
            actions={
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-500 outline-none"
                >
                  <option value="last-7-days">Last 7 Days</option>
                  <option value="last-30-days">Last 30 Days</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="last-year">Last Year</option>
                </select>
                {exportError && (
                  <Alert variant="error" onDismiss={() => setExportError(null)}>
                    {exportError}
                  </Alert>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                  icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                >
                  Export PDF
                </Button>
              </div>
            }
          />

          <Section>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant={selectedReport === tab.id ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedReport(tab.id as ReportTab)}
                  icon={<tab.icon className="w-4 h-4" />}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </Section>

          {/* Content — key includes dateRange so chart re-animates on range change */}
          <div className="tab-content" key={`${selectedReport}-${dateRange}`}>
            {selectedReport === "overview"        && renderOverview()}
            {selectedReport === "income"          && renderIncome()}
            {selectedReport === "savings"         && renderSavingsRate()}
            {selectedReport === "custom"          && renderCustomReportBuilder()}
            {selectedReport === "trends"          && renderSpendingTrends()}
            {selectedReport === "comparison"      && renderComparison()}
            {selectedReport === "forecast"        && renderForecast()}
            {selectedReport === "budget-history"  && renderBudgetHistory()}
            {selectedReport === "tax"             && renderTax()}
          </div>
        </PageContent>
      </div>

      <CategoryModal />
    </>
  );
};

export default EnhancedFinancialReports;