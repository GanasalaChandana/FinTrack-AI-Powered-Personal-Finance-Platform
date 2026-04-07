// services/reports.service.ts

import { apiRequest, transactionsAPI, type Transaction } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportsRange =
  | "last-7-days"
  | "last-30-days"
  | "last-3-months"
  | "last-6-months"
  | "last-year"
  | "custom";

export interface MonthlyReportData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  target: number;
}

export interface CategoryBreakdown {
  name: string;
  amount: number;
  budget: number;
  percentage: number;
  color: string;
}

export interface SavingsGoal {
  name: string;
  current: number;
  target: number;
  progress: number;
  color: string;
}

export interface TopExpense {
  vendor: string;
  category: string;
  amount: number;
  frequency: number;
}

export interface FinancialSummary {
  netIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  incomeChange: number;
  expensesChange: number;
  savingsChange: number;
  savingsRateChange: number;
}

export interface ReportsData {
  summary: FinancialSummary;
  monthlyData: MonthlyReportData[];
  categoryBreakdown: CategoryBreakdown[];
  savingsGoals: SavingsGoal[];
  topExpenses: TopExpense[];
  insights: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_GATEWAY = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const buildUrl = (path: string) =>
  `${API_GATEWAY}${path.startsWith("/") ? path : `/${path}`}`;

const CATEGORY_COLORS: Record<string, string> = {
  "food & dining": "#f97316",
  food:            "#f97316",
  dining:          "#f97316",
  transportation:  "#3b82f6",
  transport:       "#3b82f6",
  shopping:        "#ec4899",
  entertainment:   "#8b5cf6",
  "bills & utilities": "#10b981",
  bills:           "#10b981",
  utilities:       "#10b981",
  healthcare:      "#ef4444",
  health:          "#ef4444",
  medical:         "#ef4444",
  income:          "#22c55e",
  salary:          "#22c55e",
  other:           "#94a3b8",
};

const DEFAULT_BUDGETS: Record<string, number> = {
  "food & dining": 600,
  food:            600,
  dining:          600,
  transportation:  300,
  transport:       300,
  shopping:        400,
  entertainment:   200,
  "bills & utilities": 500,
  bills:           500,
  utilities:       500,
  healthcare:      200,
  health:          200,
  other:           300,
};

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely parse any date string/number into a Date, returns null on failure */
function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    // Try DD-MM-YYYY or DD/MM/YYYY
    const dmY = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (dmY) return new Date(`${dmY[3]}-${dmY[2]}-${dmY[1]}`);
  }
  return null;
}

/** Normalise transaction type to "income" | "expense" */
function txType(t: Transaction): "income" | "expense" {
  const v = ((t.type ?? "") as string).toLowerCase().trim();
  if (v === "income" || v === "credit" || v === "deposit") return "income";
  return "expense";
}

function cutoffDate(range: ReportsRange): Date {
  const d = new Date();
  switch (range) {
    case "last-7-days":   d.setDate(d.getDate() - 7);         break;
    case "last-30-days":  d.setDate(d.getDate() - 30);        break;
    case "last-3-months": d.setMonth(d.getMonth() - 3);       break;
    case "last-6-months": d.setMonth(d.getMonth() - 6);       break;
    case "last-year":     d.setFullYear(d.getFullYear() - 1); break;
    default:              d.setDate(d.getDate() - 30);
  }
  return d;
}

function prevCutoffDate(range: ReportsRange): Date {
  const curr = cutoffDate(range);
  const d = new Date(curr);
  switch (range) {
    case "last-7-days":   d.setDate(d.getDate() - 7);         break;
    case "last-30-days":  d.setDate(d.getDate() - 30);        break;
    case "last-3-months": d.setMonth(d.getMonth() - 3);       break;
    case "last-6-months": d.setMonth(d.getMonth() - 6);       break;
    case "last-year":     d.setFullYear(d.getFullYear() - 1); break;
    default:              d.setDate(d.getDate() - 30);
  }
  return d;
}

function inWindow(t: Transaction, from: Date, to: Date): boolean {
  const d = parseDate(t.date);
  if (!d) return false;
  return d >= from && d <= to;
}

function pct(change: number, base: number): number {
  if (base === 0) return 0;
  return Math.round(((change - base) / base) * 1000) / 10;
}

const _fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name.toLowerCase()] ?? "#6366f1";
}

function getCategoryBudget(name: string): number {
  return DEFAULT_BUDGETS[name.toLowerCase()] ?? 300;
}

// ─── Core computation ─────────────────────────────────────────────────────────

function computeReportsData(allTxns: Transaction[], range: ReportsRange): ReportsData {
  const now = new Date();

  if (allTxns.length > 0) {
    console.log("📊 Sample transaction:", JSON.stringify(allTxns[0], null, 2));
  }

  const cutoff    = cutoffDate(range);
  const prevEnd   = new Date(cutoff);
  const prevStart = prevCutoffDate(range);

  let current  = allTxns.filter((t) => inWindow(t, cutoff, now));
  let previous = allTxns.filter((t) => inWindow(t, prevStart, prevEnd));

  console.log(`📊 Cutoff: ${cutoff.toISOString()} | In window: ${current.length} / ${allTxns.length}`);

  // ── KEY FIX: If date filter returns nothing, show ALL data ─────────────────
  // This handles cases where stored transaction dates are outside the selected
  // range (e.g. test data from months ago, or wrong date format being stored).
  let usingAllData = false;
  if (current.length === 0 && allTxns.length > 0) {
    console.warn("⚠️ No transactions match date range — falling back to ALL transactions");
    current = allTxns;
    previous = [];
    usingAllData = true;
  }

  const sum = (txns: Transaction[], type: "income" | "expense") =>
    txns.filter((t) => txType(t) === type).reduce((s, t) => s + Math.abs(t.amount), 0);

  const curIncome   = sum(current,  "income");
  const curExpenses = sum(current,  "expense");
  const curSavings  = curIncome - curExpenses;
  const curRate     = curIncome > 0 ? (curSavings / curIncome) * 100 : 0;

  const prevIncome   = sum(previous, "income");
  const prevExpenses = sum(previous, "expense");
  const prevSavings  = prevIncome - prevExpenses;
  const prevRate     = prevIncome > 0 ? (prevSavings / prevIncome) * 100 : 0;

  console.log(`📊 Income: $${curIncome.toFixed(2)} | Expenses: $${curExpenses.toFixed(2)} | Savings: $${curSavings.toFixed(2)}`);

  const summary: FinancialSummary = {
    netIncome:         Math.round(curIncome   * 100) / 100,
    totalExpenses:     Math.round(curExpenses * 100) / 100,
    netSavings:        Math.round(curSavings  * 100) / 100,
    savingsRate:       Math.round(curRate * 10) / 10,
    incomeChange:      pct(curIncome,   prevIncome),
    expensesChange:    pct(curExpenses, prevExpenses),
    savingsChange:     pct(curSavings,  prevSavings),
    savingsRateChange: Math.round((curRate - prevRate) * 10) / 10,
  };

  // ── Monthly data ───────────────────────────────────────────────────────────
  const monthlyData: MonthlyReportData[] = [];

  if (usingAllData) {
    // Group by actual year-month from transaction dates
    const monthMap: Record<string, { income: number; expenses: number }> = {};
    allTxns.forEach((t) => {
      const d = parseDate(t.date);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 };
      if (txType(t) === "income") monthMap[key].income   += Math.abs(t.amount);
      else                        monthMap[key].expenses += Math.abs(t.amount);
    });

    Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .forEach(([key, { income, expenses }]) => {
        const monthIdx = parseInt(key.split("-")[1], 10) - 1;
        monthlyData.push({
          month:    SHORT_MONTHS[monthIdx],
          income:   Math.round(income   * 100) / 100,
          expenses: Math.round(expenses * 100) / 100,
          savings:  Math.round((income - expenses) * 100) / 100,
          target:   5000,
        });
      });
  } else {
    const monthCount =
      range === "last-7-days"   ? 1  :
      range === "last-30-days"  ? 1  :
      range === "last-3-months" ? 3  :
      range === "last-6-months" ? 6  :
      range === "last-year"     ? 12 : 1;

    for (let i = monthCount - 1; i >= 0; i--) {
      const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = new Date(d.getFullYear(), d.getMonth(), 1);
      const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthTxns = allTxns.filter((t) => inWindow(t, from, to));
      const mIncome   = sum(monthTxns, "income");
      const mExpenses = sum(monthTxns, "expense");
      monthlyData.push({
        month:    SHORT_MONTHS[d.getMonth()],
        income:   Math.round(mIncome   * 100) / 100,
        expenses: Math.round(mExpenses * 100) / 100,
        savings:  Math.round((mIncome - mExpenses) * 100) / 100,
        target:   5000,
      });
    }
  }

  // ── Category breakdown ─────────────────────────────────────────────────────
  const expensesByCat: Record<string, number> = {};
  current.filter((t) => txType(t) === "expense").forEach((t) => {
    const raw = t.category || "Other";
    const cat = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    expensesByCat[cat] = (expensesByCat[cat] || 0) + Math.abs(t.amount);
  });

  const totalExp = Object.values(expensesByCat).reduce((s, v) => s + v, 0) || 1;

  const categoryBreakdown: CategoryBreakdown[] = Object.entries(expensesByCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, amount]) => ({
      name,
      amount:     Math.round(amount * 100) / 100,
      budget:     getCategoryBudget(name),
      percentage: Math.round((amount / totalExp) * 1000) / 10,
      color:      getCategoryColor(name),
    }));

  // ── Top expenses ───────────────────────────────────────────────────────────
  const vendorMap: Record<string, { amount: number; freq: number; category: string }> = {};
  current.filter((t) => txType(t) === "expense").forEach((t) => {
    const v = t.merchant || t.description || "Unknown";
    if (!vendorMap[v]) vendorMap[v] = { amount: 0, freq: 0, category: t.category || "Other" };
    vendorMap[v].amount += Math.abs(t.amount);
    vendorMap[v].freq   += 1;
  });

  const topExpenses: TopExpense[] = Object.entries(vendorMap)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 5)
    .map(([vendor, { amount, freq, category }]) => ({
      vendor,
      category,
      amount:    Math.round(amount * 100) / 100,
      frequency: freq,
    }));

  // ── Insights ───────────────────────────────────────────────────────────────
  const insights: string[] = [];

  if (usingAllData) {
    insights.push("Showing all available transaction data (transactions were outside the selected date range).");
  }

  if (curSavings > 0) {
    insights.push(`You saved ${_fmt(curSavings)} — a savings rate of ${curRate.toFixed(1)}%.`);
  } else if (curSavings < 0) {
    insights.push(`You spent ${_fmt(Math.abs(curSavings))} more than you earned this period.`);
  }

  if (!usingAllData && summary.expensesChange !== 0) {
    insights.push(
      `Expenses are ${Math.abs(summary.expensesChange)}% ${
        summary.expensesChange > 0 ? "higher" : "lower"
      } compared to the previous period.`,
    );
  }

  const overBudget = categoryBreakdown.filter((c) => c.amount > c.budget);
  if (overBudget.length > 0) {
    insights.push(`You exceeded your budget in: ${overBudget.map((c) => c.name).join(", ")}.`);
  }

  if (topExpenses.length > 0) {
    insights.push(`Largest expense: ${topExpenses[0].vendor} at ${_fmt(topExpenses[0].amount)}.`);
  }

  return { summary, monthlyData, categoryBreakdown, savingsGoals: [], topExpenses, insights };
}

/** Check if a ReportsData response is genuinely populated */
function isEmptyReport(data: ReportsData): boolean {
  return (
    !data ||
    (data.summary.netIncome === 0 &&
      data.summary.totalExpenses === 0 &&
      (!data.monthlyData || data.monthlyData.length === 0))
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ReportsService {
  async getFinancialReports(dateRange: ReportsRange = "last-30-days"): Promise<ReportsData> {
    try {
      const raw  = await apiRequest<any>(`/api/reports/financial?range=${encodeURIComponent(dateRange)}`, { method: "GET" });
      const data: ReportsData = raw?.data ?? raw;
      if (!isEmptyReport(data)) {
        console.log("✅ Reports: using microservice data");
        return data;
      }
      console.warn("⚠️ Microservice returned empty — falling back to transactions");
    } catch (err) {
      console.warn("⚠️ Microservice unreachable:", err instanceof Error ? err.message : err);
    }
    return this._computeFromTransactions(dateRange);
  }

  private async _computeFromTransactions(dateRange: ReportsRange): Promise<ReportsData> {
    try {
      const txns = await transactionsAPI.getAll();
      const safeTxns = txns.map((t) => ({
        ...t,
        type:   ((t.type ?? "expense") as string).toLowerCase() as "income" | "expense",
        amount: Math.abs(t.amount),
      }));
      console.log(`✅ Computing reports from ${safeTxns.length} transactions`);
      return computeReportsData(safeTxns, dateRange);
    } catch (err) {
      console.error("❌ Failed to fetch transactions:", err);
      throw new Error("Unable to load reports data. Make sure you have added transactions.");
    }
  }

  async getMonthlySummary(dateRange: ReportsRange = "last-6-months"): Promise<MonthlyReportData[]> {
    try {
      return await apiRequest<MonthlyReportData[]>(`/api/reports/monthly-summary?range=${encodeURIComponent(dateRange)}`, { method: "GET" });
    } catch {
      return (await this._computeFromTransactions(dateRange)).monthlyData;
    }
  }

  async getCategoryBreakdown(dateRange: ReportsRange = "last-30-days"): Promise<CategoryBreakdown[]> {
    try {
      return await apiRequest<CategoryBreakdown[]>(`/api/reports/category-breakdown?range=${encodeURIComponent(dateRange)}`, { method: "GET" });
    } catch {
      return (await this._computeFromTransactions(dateRange)).categoryBreakdown;
    }
  }

  async getSavingsGoals(): Promise<SavingsGoal[]> {
    try {
      return await apiRequest<SavingsGoal[]>("/api/reports/savings-goals", { method: "GET" });
    } catch { return []; }
  }

  async getTopExpenses(dateRange: ReportsRange = "last-30-days", limit = 5): Promise<TopExpense[]> {
    try {
      return await apiRequest<TopExpense[]>(`/api/reports/top-expenses?range=${encodeURIComponent(dateRange)}&limit=${limit}`, { method: "GET" });
    } catch {
      return (await this._computeFromTransactions(dateRange)).topExpenses.slice(0, limit);
    }
  }

  async getFinancialInsights(dateRange: ReportsRange = "last-30-days"): Promise<string[]> {
    try {
      return await apiRequest<string[]>(`/api/reports/insights?range=${encodeURIComponent(dateRange)}`, { method: "GET" });
    } catch {
      return (await this._computeFromTransactions(dateRange)).insights;
    }
  }

  async exportReportPDF(dateRange: ReportsRange = "last-30-days"): Promise<Blob> {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("authToken") || localStorage.getItem("ft_token")
        : null;
    const userId =
      typeof window !== "undefined" ? localStorage.getItem("userId") : null;

    try {
      const url = buildUrl(`/api/reports/export/pdf?range=${encodeURIComponent(dateRange)}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...(token  && { Authorization: `Bearer ${token}` }),
          ...(userId && { "X-User-Id": userId }),
        },
        credentials: "include",
      });
      if (response.ok) return response.blob();
      throw new Error(`${response.status}`);
    } catch (err) {
      console.warn("⚠️ PDF export falling back to client-side:", err);
    }

    const txns = await transactionsAPI.getAll();
    const data  = computeReportsData(txns, dateRange);

    const rows = txns
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 200)
      .map((t, i) => {
        const bg    = i % 2 === 0 ? "#ffffff" : "#f9fafb";
        const type  = ((t.type ?? "") as string).toLowerCase();
        const color = type === "income" ? "#059669" : "#dc2626";
        return `<tr style="background:${bg}">
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:11px">${t.date}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:11px">${t.merchant || t.description}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:11px">${t.category}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:11px;color:${color};font-weight:600;text-align:right">
            ${type === "income" ? "+" : "-"}${_fmt(Math.abs(t.amount))}
          </td></tr>`;
      }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>FinTrack Report — ${dateRange}</title>
<style>
  body{font-family:Arial,sans-serif;padding:24px;color:#111}
  h1{color:#4f46e5;font-size:22px;margin-bottom:4px}
  .meta{color:#6b7280;font-size:12px;margin-bottom:20px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .stat-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
  .stat-value{font-size:18px;font-weight:700;margin-top:4px}
  table{width:100%;border-collapse:collapse}
  th{background:#4f46e5;color:#fff;padding:9px 10px;text-align:left;font-size:11px}
  .print-btn{position:fixed;top:16px;right:16px;background:#4f46e5;color:#fff;
    border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px}
  @media print{.print-btn{display:none}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
<h1>FinTrack Financial Report</h1>
<p class="meta">Period: ${dateRange.replace(/-/g, " ")} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</p>
<div class="stats">
  <div class="stat"><div class="stat-label">Total Income</div>
    <div class="stat-value" style="color:#059669">${_fmt(data.summary.netIncome)}</div></div>
  <div class="stat"><div class="stat-label">Total Expenses</div>
    <div class="stat-value" style="color:#dc2626">${_fmt(data.summary.totalExpenses)}</div></div>
  <div class="stat"><div class="stat-label">Net Savings</div>
    <div class="stat-value" style="color:#4f46e5">${_fmt(data.summary.netSavings)}</div></div>
  <div class="stat"><div class="stat-label">Savings Rate</div>
    <div class="stat-value">${data.summary.savingsRate.toFixed(1)}%</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Merchant / Description</th><th>Category</th>
  <th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table></body></html>`;

    return new Blob([html], { type: "text/html;charset=utf-8" });
  }

  async getComparisonData(period1: string, period2: string): Promise<any> {
    try {
      return await apiRequest<any>(`/api/reports/comparison?period1=${encodeURIComponent(period1)}&period2=${encodeURIComponent(period2)}`, { method: "GET" });
    } catch { return null; }
  }

  async getForecastData(months = 6): Promise<any> {
    try {
      return await apiRequest<any>(`/api/reports/forecast?months=${months}`, { method: "GET" });
    } catch { return null; }
  }
}

export const reportsService = new ReportsService();