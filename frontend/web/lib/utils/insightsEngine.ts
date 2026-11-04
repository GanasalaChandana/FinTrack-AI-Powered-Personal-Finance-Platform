// lib/utils/insightsEngine.ts
// Rule-based spending insights and the savings action plan (Insights page).
// Pure functions so they can be unit-tested.

import type { Transaction as ApiTransaction } from "@/lib/api";
import { detectRecurring } from "@/lib/utils/recurringDetection";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpendingInsight {
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

/**
 * Subscriptions as the Subscriptions page sees them: services that recur on a
 * regular schedule (shared detector), costed per month. Counting individual
 * keyword-matching payments made 10 Netflix/Spotify charges "10 subscriptions"
 * and called their 3-month total a monthly cost.
 */
export function detectedSubscriptions(transactions: ApiTransaction[]) {
  const subs = detectRecurring(transactions as any).items.filter((i) => i.isSubscription);
  const perMonth = (a: number, f: string) => (f === "weekly" ? a * 4.33 : f === "biweekly" ? a * 2.17 : a);
  const monthly = subs.reduce((s, i) => s + perMonth(Math.abs(i.amount), i.frequency), 0);
  return { count: subs.length, monthly, names: subs.map((i) => i.merchant) };
}

/** Costs you can't trim week to week (rent, utilities, insurance…): flagged, but no "cut 15%" savings. */
/** Type check that accepts "expense" / "EXPENSE" alike. */
const isType = (t: ApiTransaction, type: "income" | "expense") =>
  String(t.type ?? "").toLowerCase() === type;

export const FIXED_COST_CATEGORIES = new Set([
  "Housing", "Rent", "Mortgage", "Bills & Utilities", "Utilities", "Insurance", "Education", "Healthcare",
]);

/** Number of distinct months the transactions span (at least 1), to turn totals into monthly averages. */
export function monthsCovered(txns: ApiTransaction[]): number {
  return Math.max(new Set(txns.map((t) => (t.date ?? "").slice(0, 7)).filter(Boolean)).size, 1);
}

export function generateInsights(transactions: ApiTransaction[]): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  if (transactions.length === 0) return insights;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const expenses     = transactions.filter((t) => isType(t, "expense"));
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
      const fixed = FIXED_COST_CATEGORIES.has(topCat);
      const monthlyAvg = topAmt / monthsCovered(expenses);
      insights.push({
        id: "top-category", type: "info", priority: 2,
        title: `${topCat} Dominates Your Spending`,
        message: `${topCat} is ${pct.toFixed(0)}% of all expenses — $${topAmt.toFixed(2)} total.` +
          (fixed ? " It's mostly a fixed cost, so the time to act is at renewal or when you compare providers." : ""),
        impact: pct > 50 ? "high" : "medium",
        category: topCat, amount: topAmt, actionable: true,
        actions: fixed
          ? ["Compare providers before your next renewal", "Check for unused services in this category", "Plan other spending around it"]
          : ["Set a budget for this category", "Find cheaper alternatives", "Track weekly instead of monthly"],
        // A fixed cost isn't something you cut by 10% next month; others: 10% of the monthly average, per year
        savingsEstimate: fixed ? 0 : monthlyAvg * 0.1 * 12,
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
      // 30% of the monthly average, per year (smallTotal spans the whole history)
      savingsEstimate: (smallTotal / monthsCovered(small)) * 0.3 * 12,
    });
  }

  // ── 5. Subscription audit ──────────────────────────────────────────────────
  const subs = detectedSubscriptions(transactions);
  if (subs.count > 0) {
    insights.push({
      id: "subscriptions", type: "tip", priority: 3,
      title: `${subs.count} Subscription${subs.count === 1 ? "" : "s"} Detected`,
      message: `${subs.names.slice(0, 3).join(", ")}${subs.count > 3 ? "…" : ""} cost $${subs.monthly.toFixed(2)}/month — $${(subs.monthly * 12).toFixed(2)}/year.`,
      impact: "medium", amount: subs.monthly, actionable: true,
      actions: ["List every active subscription", "Cancel unused services", "Switch to annual billing (saves ~20%)"],
      savingsEstimate: subs.monthly * 0.25 * 12, // cut 25%
    });
  }

  // ── 6. Weekend vs weekday ──────────────────────────────────────────────────
  let weekend = 0, weekday = 0;
  expenses.forEach((t) => {
    const d = new Date(t.date).getDay();
    if (d === 0 || d === 6) weekend += Math.abs(t.amount); else weekday += Math.abs(t.amount);
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
    .filter((t) => isType(t, "income") && t.date?.startsWith(thisMonthKey))
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


export interface ActionTip {
  id: string;
  title: string;
  description: string;
  annualSavings: number;
  category?: string;
  iconType: "scissors" | "smartphone" | "coffee" | "zap" | "calendar";
}

export function generateActionPlan(transactions: ApiTransaction[]): ActionTip[] {
  const tips: ActionTip[] = [];
  const expenses = transactions.filter(t => isType(t, "expense"));
  if (expenses.length === 0) return tips;

  const monthSet = new Set(expenses.map(t => (t.date ?? "").slice(0, 7)));
  const months = Math.max(monthSet.size, 1);

  // Category totals → monthly avg
  const catTotals: Record<string, number> = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] ?? 0) + Math.abs(t.amount ?? 0); });
  // Only flexible spending gets a "trim it" tip
  const flexibleTop = Object.entries(catTotals)
    .filter(([name]) => !FIXED_COST_CATEGORIES.has(name))
    .map(([name, total]) => ({ name, monthlyAvg: total / months }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)[0];

  // Tip: trim top category by 15%
  if (flexibleTop && flexibleTop.monthlyAvg > 50) {
    const c = flexibleTop;
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
  const secondFlexible = Object.entries(catTotals)
    .filter(([name]) => !FIXED_COST_CATEGORIES.has(name) && name !== flexibleTop?.name)
    .map(([name, total]) => ({ name, monthlyAvg: total / months }))
    .sort((x, y) => y.monthlyAvg - x.monthlyAvg)[0];
  if (secondFlexible && secondFlexible.monthlyAvg > 30) {
    const c = secondFlexible;
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

  // Tip: subscriptions (same detection as the Subscriptions page)
  const subs = detectedSubscriptions(transactions);
  if (subs.count > 0) {
    const saving = Math.round(subs.monthly * 0.3 * 12);
    tips.push({
      id: "sub-audit",
      title: `Audit ${subs.count} subscription${subs.count !== 1 ? "s" : ""}`,
      description: `Your subscriptions cost ~$${Math.round(subs.monthly)}/month. Cancelling even 1–2 unused ones saves $${saving}/year.`,
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
    if (d === 0 || d === 6) weekend += Math.abs(t.amount ?? 0); else weekday += Math.abs(t.amount ?? 0);
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
