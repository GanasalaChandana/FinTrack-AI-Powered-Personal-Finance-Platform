"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Brain, Loader2, Sparkles, AlertTriangle, CheckCircle, Info,
  Lightbulb, TrendingUp, TrendingDown, ArrowRight, X, ChevronDown,
  Filter, RefreshCw, AlertCircle, DollarSign, Calendar, Star,
  Scissors, Smartphone, Coffee, Zap,
} from "lucide-react";
import { transactionsAPI, type Transaction as ApiTransaction } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpendingInsight {
  id: string;
  type: "warning" | "success" | "info" | "tip";
  title: string;
  message: string;
  impact: "high" | "medium" | "low";
  category?: string;
  amount?: number;
  actionable: boolean;
  actions?: string[];
  priority: number;
  savingsEstimate?: number; // annual savings if user acts
}

// ── Insight thresholds (centralised so they're easy to adjust) ───────────────
const THRESHOLDS = {
  largeExpense:        500,   // single transaction flagged as large
  microSpendMax:        25,   // transactions under this are "micro"
  microSpendMinCount:    8,   // need at least this many micro-txns to warn
  weekendSpendPct:      45,   // weekend % above this triggers a tip
  categoryDominancePct: 30,   // category % above this triggers a warning
  categorySpikePct:     50,   // month-over-month growth % to flag a spike
  categorySpikeMini:    50,   // min $ amount for category spike to matter
  lowSavingsRate:       10,   // savings rate below this is "low"
  goodSavingsRate:      20,   // savings rate above this is "excellent"
};

// ── Insight engine ────────────────────────────────────────────────────────────

function generateInsights(transactions: ApiTransaction[]): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  if (transactions.length === 0) return insights;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const expenses     = transactions.filter((t) => t.type === "expense");
  const thisMonth    = expenses.filter((t) => t.date?.startsWith(thisMonthKey));
  const lastMonth    = expenses.filter((t) => t.date?.startsWith(lastMonthKey));

  const thisTotal = thisMonth.reduce((s, t) => s + Math.abs(t.amount), 0);
  const lastTotal = lastMonth.reduce((s, t) => s + Math.abs(t.amount), 0);

  // ── 1. Month-over-month spike ──────────────────────────────────────────────
  if (lastTotal > 0 && thisTotal > 0) {
    const pctChange = ((thisTotal - lastTotal) / lastTotal) * 100;
    if (pctChange > 20) {
      insights.push({
        id: "mom-spike", type: "warning", priority: 1,
        title: `Spending Up ${pctChange.toFixed(0)}% This Month`,
        message: `You've spent $${thisTotal.toFixed(2)} this month vs $${lastTotal.toFixed(2)} last month — a $${(thisTotal - lastTotal).toFixed(2)} increase.`,
        impact: pctChange > 50 ? "high" : "medium",
        amount: thisTotal - lastTotal, actionable: true,
        actions: ["Review this month's new expenses", "Identify which category spiked", "Set a monthly spending cap"],
      });
    } else if (pctChange < -10) {
      insights.push({
        id: "mom-drop", type: "success", priority: 4,
        title: `Great Job — Spending Down ${Math.abs(pctChange).toFixed(0)}%`,
        message: `You spent $${(lastTotal - thisTotal).toFixed(2)} less this month than last month. Keep it up!`,
        impact: "low", amount: lastTotal - thisTotal, actionable: false,
      });
    }
  }

  // ── 2. Top spending category ──────────────────────────────────────────────
  const byCategory: Record<string, number> = {};
  expenses.forEach((t) => { byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount); });
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (sorted.length > 0) {
    const [topCat, topAmt] = sorted[0];
    const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const pct   = total > 0 ? (topAmt / total) * 100 : 0;
    if (pct > THRESHOLDS.categoryDominancePct) {
      insights.push({
        id: "top-category", type: "info", priority: 2,
        title: `${topCat} Dominates Your Spending`,
        message: `${topCat} is ${pct.toFixed(0)}% of all expenses — $${topAmt.toFixed(2)} total.`,
        impact: pct > 50 ? "high" : "medium",
        category: topCat, amount: topAmt, actionable: true,
        actions: ["Set a budget for this category", "Find cheaper alternatives", "Track weekly instead of monthly"],
        savingsEstimate: topAmt * 0.1 * 12, // 10% reduction × 12 months
      });
    }
  }

  // ── 3. Category trend: growing month-over-month ───────────────────────────
  const thisMonthByCategory: Record<string, number> = {};
  const lastMonthByCategory: Record<string, number> = {};
  thisMonth.forEach((t) => { thisMonthByCategory[t.category] = (thisMonthByCategory[t.category] ?? 0) + Math.abs(t.amount); });
  lastMonth.forEach((t) => { lastMonthByCategory[t.category] = (lastMonthByCategory[t.category] ?? 0) + Math.abs(t.amount); });

  Object.entries(thisMonthByCategory).forEach(([cat, amt]) => {
    const prev = lastMonthByCategory[cat] ?? 0;
    if (prev > 0 && (amt - prev) / prev > THRESHOLDS.categorySpikePct / 100 && amt > THRESHOLDS.categorySpikeMini) {
      insights.push({
        id: `cat-spike-${cat}`, type: "warning", priority: 2,
        title: `${cat} Spending Jumped ${(((amt - prev) / prev) * 100).toFixed(0)}%`,
        message: `${cat} went from $${prev.toFixed(2)} to $${amt.toFixed(2)} this month.`,
        impact: "medium", category: cat, amount: amt - prev, actionable: true,
        actions: [`Review ${cat} transactions`, "Set a budget alert", "Find substitutes"],
      });
    }
  });

  // ── 4. Impulse buying (many small transactions) ───────────────────────────
  const small     = expenses.filter((t) => Math.abs(t.amount) < THRESHOLDS.microSpendMax);
  const smallTotal = small.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (small.length > THRESHOLDS.microSpendMinCount) {
    insights.push({
      id: "impulse", type: "warning", priority: 2,
      title: "Micro-Spending Adding Up",
      message: `${small.length} transactions under $${THRESHOLDS.microSpendMax} totalled $${smallTotal.toFixed(2)}. Small buys compound fast.`,
      impact: "medium", amount: smallTotal, actionable: true,
      actions: ["Apply the 24-hour rule before small purchases", "Set a daily cash allowance", "Delete shopping apps"],
      savingsEstimate: smallTotal * 0.3 * 12,
    });
  }

  // ── 5. Subscription audit ──────────────────────────────────────────────────
  const subKeywords = ["subscription", "netflix", "spotify", "disney", "hulu", "apple", "amazon prime", "youtube", "gym"];
  const subs = transactions.filter((t) => {
    const d = (t.description ?? "").toLowerCase();
    return subKeywords.some((k) => d.includes(k));
  });
  if (subs.length > 0) {
    const subsTotal = subs.reduce((s, t) => s + Math.abs(t.amount), 0);
    insights.push({
      id: "subscriptions", type: "tip", priority: 3,
      title: `${subs.length} Subscriptions Detected`,
      message: `${subs.length} recurring services cost $${subsTotal.toFixed(2)}/month — $${(subsTotal * 12).toFixed(2)}/year.`,
      impact: "medium", amount: subsTotal, actionable: true,
      actions: ["List every active subscription", "Cancel unused services", "Switch to annual billing (saves ~20%)"],
      savingsEstimate: subsTotal * 0.25 * 12, // cut 25%
    });
  }

  // ── 6. Weekend vs weekday ──────────────────────────────────────────────────
  let weekend = 0, weekday = 0;
  expenses.forEach((t) => {
    const d = new Date(t.date).getDay();
    (d === 0 || d === 6) ? (weekend += Math.abs(t.amount)) : (weekday += Math.abs(t.amount));
  });
  const wkPct = weekend + weekday > 0 ? (weekend / (weekend + weekday)) * 100 : 0;
  if (wkPct > THRESHOLDS.weekendSpendPct) {
    insights.push({
      id: "weekend", type: "tip", priority: 4,
      title: "Weekend Spending Pattern",
      message: `${wkPct.toFixed(0)}% of spending ($${weekend.toFixed(2)}) happens on weekends.`,
      impact: "low", amount: weekend, actionable: true,
      actions: ["Plan weekend activities in advance", "Meal prep on Fridays", "Set a weekly fun budget"],
    });
  }

  // ── 7. Savings rate ───────────────────────────────────────────────────────
  const incomeThisMonth = transactions
    .filter((t) => t.type === "income" && t.date?.startsWith(thisMonthKey))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  if (incomeThisMonth > 0 && thisTotal > 0) {
    const savingsRate = ((incomeThisMonth - thisTotal) / incomeThisMonth) * 100;
    if (savingsRate < THRESHOLDS.lowSavingsRate && savingsRate >= 0) {
      insights.push({
        id: "savings-rate", type: "warning", priority: 1,
        title: `Low Savings Rate: ${savingsRate.toFixed(0)}%`,
        message: `You're saving only ${savingsRate.toFixed(0)}% of income this month. Aim for 20%+ for financial stability.`,
        impact: "high", actionable: true,
        actions: ["Set up auto-transfer to savings on payday", "Track daily spending", "Find one expense to cut"],
        savingsEstimate: incomeThisMonth * 0.1 * 12,
      });
    } else if (savingsRate >= THRESHOLDS.goodSavingsRate) {
      insights.push({
        id: "good-savings", type: "success", priority: 5,
        title: `Excellent Savings Rate: ${savingsRate.toFixed(0)}%`,
        message: `Saving ${savingsRate.toFixed(0)}% of income puts you ahead of 80% of people. Keep it up!`,
        impact: "low", actionable: false,
      });
    }
  }

  // ── 8. Best spending day ──────────────────────────────────────────────────
  const byDay: Record<number, number[]> = {};
  expenses.forEach((t) => {
    const d = new Date(t.date).getDay();
    (byDay[d] = byDay[d] ?? []).push(Math.abs(t.amount));
  });
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let bestDay = "", lowest = Infinity;
  Object.entries(byDay).forEach(([d, amts]) => {
    const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
    if (avg < lowest && amts.length >= 2) { lowest = avg; bestDay = DAY_NAMES[+d]; }
  });
  if (bestDay) {
    insights.push({
      id: "best-day", type: "success", priority: 6,
      title: `${bestDay} Is Your Best Day`,
      message: `Your average spend on ${bestDay} is only $${lowest.toFixed(2)} — your most controlled spending day.`,
      impact: "low", actionable: false,
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

// ── Design maps ───────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  warning: { bg: "bg-white dark:bg-gray-800", border: "border-red-200 dark:border-red-800/50",         iconBg: "bg-red-50 dark:bg-red-900/20",         iconText: "text-red-500",     label: "Warning", labelBg: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",             bar: "bg-red-500" },
  success: { bg: "bg-white dark:bg-gray-800", border: "border-emerald-200 dark:border-emerald-800/40", iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconText: "text-emerald-600", label: "Win",     labelBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400", bar: "bg-emerald-500" },
  info:    { bg: "bg-white dark:bg-gray-800", border: "border-indigo-200 dark:border-indigo-800/40",   iconBg: "bg-indigo-50 dark:bg-indigo-900/30",   iconText: "text-indigo-600",  label: "Info",    labelBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",     bar: "bg-indigo-500" },
  tip:     { bg: "bg-white dark:bg-gray-800", border: "border-amber-200 dark:border-amber-800/40",     iconBg: "bg-amber-50 dark:bg-amber-900/20",     iconText: "text-amber-600",   label: "Tip",     labelBg: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",         bar: "bg-amber-400" },
};

const IMPACT_STYLES = {
  high:   "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  low:    "bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-300",
};

const TYPE_ICONS = {
  warning: AlertTriangle,
  success: CheckCircle,
  info:    Info,
  tip:     Lightbulb,
};

const FILTER_OPTIONS = [
  { value: "all",     label: "All",      icon: Star },
  { value: "warning", label: "Warnings", icon: AlertTriangle },
  { value: "success", label: "Wins",     icon: CheckCircle },
  { value: "info",    label: "Insights", icon: Info },
  { value: "tip",     label: "Tips",     icon: Lightbulb },
] as const;

type FilterVal = typeof FILTER_OPTIONS[number]["value"];

// ── Savings projection card ───────────────────────────────────────────────────

function SavingsProjection({ insights }: { insights: SpendingInsight[] }) {
  const total = insights
    .filter((i) => i.savingsEstimate && i.savingsEstimate > 0)
    .reduce((s, i) => s + (i.savingsEstimate ?? 0), 0);

  if (total === 0) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-white shadow-lg">
      <div className="flex items-center gap-3 mb-1">
        <TrendingUp className="w-5 h-5 opacity-80" />
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Potential Annual Savings</p>
      </div>
      <p className="text-4xl font-black tracking-tight">
        ${total.toFixed(0)}
        <span className="text-lg font-semibold opacity-70">/yr</span>
      </p>
      <p className="text-sm opacity-70 mt-1">
        If you act on {insights.filter((i) => i.savingsEstimate).length} insight{insights.filter((i) => i.savingsEstimate).length !== 1 ? "s" : ""} above
      </p>
    </div>
  );
}

// ── Action Plan ───────────────────────────────────────────────────────────────

interface ActionTip {
  id: string;
  title: string;
  description: string;
  annualSavings: number;
  category?: string;
  iconType: "scissors" | "smartphone" | "coffee" | "zap" | "calendar";
}

const PLAN_DONE_KEY = "fintrack:action-plan-done";

function loadPlanDone(): Set<string> {
  try {
    const raw = localStorage.getItem(PLAN_DONE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}
function savePlanDone(ids: Set<string>) {
  try { localStorage.setItem(PLAN_DONE_KEY, JSON.stringify([...ids])); } catch {}
}

function generateActionPlan(transactions: ApiTransaction[]): ActionTip[] {
  const tips: ActionTip[] = [];
  const expenses = transactions.filter(t => t.type === "expense" || t.type === "EXPENSE");
  if (expenses.length === 0) return tips;

  const now = new Date();
  const monthSet = new Set(expenses.map(t => (t.date ?? "").slice(0, 7)));
  const months = Math.max(monthSet.size, 1);

  // Category totals → monthly avg
  const catTotals: Record<string, number> = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] ?? 0) + Math.abs(t.amount ?? 0); });
  const topCats = Object.entries(catTotals)
    .map(([name, total]) => ({ name, monthlyAvg: total / months }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
    .slice(0, 3);

  // Tip: trim top category by 15%
  if (topCats[0] && topCats[0].monthlyAvg > 50) {
    const c = topCats[0];
    const saving = Math.round(c.monthlyAvg * 0.15 * 12);
    tips.push({
      id: "top-cat-cut",
      title: `Trim ${c.name} by 15%`,
      description: `You spend ~$${Math.round(c.monthlyAvg)}/month on ${c.name}. A 15% cut frees up $${saving}/year without a big lifestyle change.`,
      annualSavings: saving,
      category: c.name,
      iconType: "scissors",
    });
  }

  // Tip: second category if meaningfully large
  if (topCats[1] && topCats[1].monthlyAvg > 30) {
    const c = topCats[1];
    const saving = Math.round(c.monthlyAvg * 0.1 * 12);
    tips.push({
      id: "second-cat-cut",
      title: `Find deals on ${c.name}`,
      description: `${c.name} costs ~$${Math.round(c.monthlyAvg)}/month. Comparison-shopping or couponing 10% off saves $${saving}/year.`,
      annualSavings: saving,
      category: c.name,
      iconType: "zap",
    });
  }

  // Tip: subscriptions
  const subKeywords = ["netflix", "spotify", "disney", "hulu", "apple", "amazon prime", "youtube", "gym", "subscription", "prime"];
  const subs = expenses.filter(t =>
    subKeywords.some(k => (t.description ?? "").toLowerCase().includes(k) || (t.merchant ?? "").toLowerCase().includes(k))
  );
  if (subs.length > 0) {
    const monthlySubCost = subs.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) / months;
    const saving = Math.round(monthlySubCost * 0.3 * 12);
    tips.push({
      id: "sub-audit",
      title: `Audit ${subs.length} subscription${subs.length !== 1 ? "s" : ""}`,
      description: `Detected subscriptions cost ~$${Math.round(monthlySubCost)}/month. Cancelling even 1–2 unused ones saves $${saving}/year.`,
      annualSavings: saving,
      iconType: "smartphone",
    });
  }

  // Tip: micro-spending
  const micro = expenses.filter(t => Math.abs(t.amount ?? 0) < 25);
  if (micro.length >= 8) {
    const monthlyMicro = micro.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) / months;
    const saving = Math.round(monthlyMicro * 0.3 * 12);
    tips.push({
      id: "impulse-cuts",
      title: "Apply the 24-hour rule",
      description: `${micro.length} small purchases (<$25) add up to ~$${Math.round(monthlyMicro)}/month. Waiting 24 hours before buying cuts impulse spend by ~30% — saving $${saving}/year.`,
      annualSavings: saving,
      iconType: "coffee",
    });
  }

  // Tip: weekend spending
  let weekend = 0, weekday = 0;
  expenses.forEach(t => {
    const d = new Date((t.date ?? "") + "T00:00:00").getDay();
    (d === 0 || d === 6) ? (weekend += Math.abs(t.amount ?? 0)) : (weekday += Math.abs(t.amount ?? 0));
  });
  const weekendPct = weekend + weekday > 0 ? (weekend / (weekend + weekday)) * 100 : 0;
  if (weekendPct > 42) {
    const saving = Math.round((weekend / months) * 0.2 * 12);
    tips.push({
      id: "weekend-plan",
      title: "Plan your weekends ahead",
      description: `${Math.round(weekendPct)}% of spending happens on weekends. Pre-planning activities and meals can cut weekend spend 20% — saving ~$${saving}/year.`,
      annualSavings: saving,
      iconType: "calendar",
    });
  }

  return tips.sort((a, b) => b.annualSavings - a.annualSavings);
}

const ICON_MAP = {
  scissors: Scissors,
  smartphone: Smartphone,
  coffee: Coffee,
  zap: Zap,
  calendar: Calendar,
} as const;

function ActionPlanSection({ transactions }: { transactions: ApiTransaction[] }) {
  const tips = useMemo(() => generateActionPlan(transactions), [transactions]);
  const [done, setDone] = useState<Set<string>>(() => loadPlanDone());

  const toggle = (id: string) => {
    setDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      savePlanDone(next);
      return next;
    });
  };

  if (tips.length === 0) return null;

  const totalSavings = tips.reduce((s, t) => s + t.annualSavings, 0);
  const doneCount = tips.filter(t => done.has(t.id)).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right, #f97316, #f59e0b, #eab308)" }} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Personalised</p>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 leading-tight">Action Plan</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {doneCount}/{tips.length} actions completed
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Potential savings</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${totalSavings.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">/year if all done</p>
          </div>
        </div>

        {/* Progress bar */}
        {tips.length > 0 && (
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-5">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${(doneCount / tips.length) * 100}%` }}
            />
          </div>
        )}

        {/* Tips list */}
        <div className="space-y-3">
          {tips.map((tip, i) => {
            const Icon = ICON_MAP[tip.iconType];
            const isDone = done.has(tip.id);
            return (
              <div
                key={tip.id}
                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                  isDone
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 opacity-70"
                    : "bg-slate-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-700/40"
                }`}
              >
                {/* Rank + icon */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isDone
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : "bg-amber-100 dark:bg-amber-900/30"
                  }`}>
                    {isDone
                      ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      : <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    }
                  </div>
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500">#{i + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className={`text-sm font-bold leading-snug ${
                      isDone ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
                    }`}>
                      {tip.title}
                    </p>
                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-extrabold flex items-center gap-1 flex-shrink-0">
                      <TrendingUp className="w-3 h-3" />
                      ${tip.annualSavings.toLocaleString()}/yr
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tip.description}</p>
                  {tip.category && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-full text-[10px] font-semibold">
                      {tip.category}
                    </span>
                  )}
                </div>

                {/* Checkbox */}
                <button
                  onClick={() => toggle(tip.id)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-gray-300 dark:border-gray-500 hover:border-emerald-400"
                  }`}
                  title={isDone ? "Mark undone" : "Mark done"}
                >
                  {isDone && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {doneCount === tips.length && tips.length > 0 && (
          <div className="mt-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              All actions complete! Keep it up — you're on track to save ${totalSavings.toLocaleString()}/year. 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const DISMISSED_KEY = "fintrack:dismissed-insights";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { }
  return new Set();
}

function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch { }
}

function AIInsightsDashboard({ transactions }: { transactions: ApiTransaction[] }) {
  const insights   = useMemo(() => generateInsights(transactions), [transactions]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [filter, setFilter]       = useState<FilterVal>("all");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const active   = useMemo(() => insights.filter((i) => !dismissed.has(i.id)), [insights, dismissed]);
  const filtered = useMemo(
    () => filter === "all" ? active : active.filter((i) => i.type === filter),
    [active, filter]
  );

  const counts = useMemo(() => ({
    warning: active.filter((i) => i.type === "warning").length,
    success: active.filter((i) => i.type === "success").length,
    info:    active.filter((i) => i.type === "info").length,
    tip:     active.filter((i) => i.type === "tip").length,
  }), [active]);

  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400 dark:text-indigo-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">No Insights Yet</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">Add more transactions to get personalised spending insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Summary header card ── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)" }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">AI Analysis</p>
                <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight">
                  {active.length} insight{active.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">From {transactions.length} transactions</p>
              </div>
            </div>

            {/* Count badges */}
            <div className="flex gap-2 flex-wrap">
              {(["warning", "tip", "success", "info"] as const).map((type) => {
                if (counts[type] === 0) return null;
                const Icon = TYPE_ICONS[type];
                const st   = TYPE_STYLES[type];
                return (
                  <button key={type} onClick={() => setFilter(type)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition-all hover:shadow-sm ${st.labelBg} border-current/10`}>
                    <Icon className="w-3.5 h-3.5" />
                    {counts[type]} {type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Savings projection ── */}
      <SavingsProjection insights={active} />

      {/* ── Filter tabs ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-1.5 flex gap-1 overflow-x-auto">
        {FILTER_OPTIONS.map((f) => {
          const count = f.value === "all" ? active.length : counts[f.value as keyof typeof counts] ?? 0;
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                filter === f.value ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700/50"
              }`}>
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
              {count > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  filter === f.value ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Insight cards ── */}
      <div className="space-y-4">
        {filtered.map((insight) => {
          const st     = TYPE_STYLES[insight.type];
          const Icon   = TYPE_ICONS[insight.type];
          const isOpen = expanded === insight.id;

          return (
            <div key={insight.id}
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${st.border}`}>
              {/* Accent bar */}
              <div className={`h-1 w-full ${st.bar}`} />

              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${st.iconBg}`}>
                    <Icon className={`w-5 h-5 ${st.iconText}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{insight.title}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${st.labelBg}`}>
                          {st.label}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${IMPACT_STYLES[insight.impact]}`}>
                          {insight.impact}
                        </span>
                      </div>
                      <button onClick={() => setDismissed((p) => { const n = new Set([...p, insight.id]); saveDismissed(n); return n; })}
                        className="p-1.5 rounded-xl text-gray-300 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{insight.message}</p>

                    {/* Pills */}
                    {(insight.category || insight.amount || insight.savingsEstimate) && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {insight.category && (
                          <span className="px-3 py-1 bg-slate-100 dark:bg-gray-700 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {insight.category}
                          </span>
                        )}
                        {insight.amount != null && (
                          <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${st.labelBg}`}>
                            ${insight.amount.toFixed(2)}
                          </span>
                        )}
                        {insight.savingsEstimate != null && (
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-extrabold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Save ~${insight.savingsEstimate.toFixed(0)}/yr
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {insight.actionable && insight.actions && (
                      <div className="mt-4">
                        <button
                          onClick={() => setExpanded(isOpen ? null : insight.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                            isOpen ? "bg-slate-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" : st.labelBg
                          }`}>
                          {isOpen ? "Hide" : "View"} Actions
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="mt-3 space-y-2">
                            {insight.actions.map((action, i) => (
                              <div key={i}
                                className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition cursor-pointer">
                                <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${st.iconText}`} />
                                {action}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty filtered */}
        {filtered.length === 0 && active.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-10 text-center">
            <Filter className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No {filter} insights.</p>
            <button onClick={() => setFilter("all")} className="mt-2 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:underline">
              Clear filter
            </button>
          </div>
        )}

        {/* All dismissed */}
        {active.length === 0 && insights.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-10 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">All insights dismissed!</p>
            <button onClick={() => { const empty = new Set<string>(); saveDismissed(empty); setDismissed(empty); }} className="mt-2 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:underline">
              Restore all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [isLoading, setIsLoading]         = useState(true);
  const [transactions, setTransactions]   = useState<ApiTransaction[]>([]);
  const [error, setError]                 = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await transactionsAPI.getAll();
      if (!Array.isArray(data)) throw new Error("Invalid response format");
      setTransactions(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load transactions");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Analysing your spending…</p>
        </div>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Couldn't Load Insights</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button onClick={loadTransactions}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-7">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">AI Powered</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Spending Insights</h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Smart analysis from {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <button onClick={loadTransactions}
            className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:shadow-md transition-all self-start flex-shrink-0">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
          </div>
        )}

        <AIInsightsDashboard transactions={transactions} />
        <ActionPlanSection transactions={transactions} />
      </div>
    </div>
  );
}