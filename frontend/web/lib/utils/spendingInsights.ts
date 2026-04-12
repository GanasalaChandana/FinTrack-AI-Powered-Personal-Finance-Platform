// lib/utils/spendingInsights.ts
// Natural-language AI spending insights — pure JS, no API calls

import { Transaction } from "@/lib/api";

export type InsightCategory =
  | "merchant"
  | "daily_avg"
  | "week_over_week"
  | "biggest_expense"
  | "weekend_pattern"
  | "budget_win"
  | "month_over_month"
  | "top_category"
  | "streak"
  | "upcoming";

export type InsightSentiment = "positive" | "neutral" | "warning" | "tip";

export interface SpendingInsight {
  id: string;
  emoji: string;
  title: string;
  description: string;
  sentiment: InsightSentiment;
  category: InsightCategory;
  value?: string; // highlighted number / stat
  valueLabel?: string; // label next to value
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function startOf(type: "week" | "month"): Date {
  const d = new Date();
  if (type === "week") {
    d.setDate(d.getDate() - d.getDay());
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function expenses(txs: Transaction[]) {
  return txs.filter((t) => t.type === "expense" || t.type === "EXPENSE");
}

function totalAmount(txs: Transaction[]) {
  return txs.reduce((s, t) => s + Math.abs(t.amount), 0);
}

function inRange(txs: Transaction[], from: Date, to?: Date) {
  const end = to ?? new Date();
  return txs.filter((t) => {
    const d = new Date(t.date);
    return d >= from && d <= end;
  });
}

// ── Insight generators ────────────────────────────────────────────────────────

function topMerchantInsight(txs: Transaction[]): SpendingInsight | null {
  const thisMonth = inRange(expenses(txs), startOf("month"));
  if (thisMonth.length < 3) return null;

  const counts: Record<string, { count: number; total: number }> = {};
  for (const t of thisMonth) {
    const m = (t as any).merchant || t.description || "Unknown";
    if (!counts[m]) counts[m] = { count: 0, total: 0 };
    counts[m].count++;
    counts[m].total += Math.abs(t.amount);
  }

  const top = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0];
  if (!top || top[1].count < 2) return null;
  const [name, { count, total }] = top;

  return {
    id: "top-merchant",
    emoji: "🏪",
    title: "Most Visited Merchant",
    description: `You've visited ${name} ${count} times this month, spending ${fmt(total)} total.`,
    sentiment: "neutral",
    category: "merchant",
    value: fmt(total),
    valueLabel: `${count} visits`,
  };
}

function dailyAverageInsight(txs: Transaction[]): SpendingInsight | null {
  const now = new Date();
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 3) return null;

  const thisMonth = inRange(expenses(txs), startOf("month"));
  if (thisMonth.length === 0) return null;

  const spent = totalAmount(thisMonth);
  const dailyAvg = spent / dayOfMonth;
  const projected = dailyAvg * daysInMonth(now);

  return {
    id: "daily-avg",
    emoji: "📊",
    title: "Daily Spending Average",
    description: `You're spending ${fmt(dailyAvg)}/day this month. At this rate, you'll spend ${fmt(projected)} by month end.`,
    sentiment: "neutral",
    category: "daily_avg",
    value: fmt(dailyAvg),
    valueLabel: "per day",
  };
}

function weekOverWeekInsight(txs: Transaction[]): SpendingInsight | null {
  const now = new Date();
  const thisWeekStart = startOf("week");
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const thisWeek = totalAmount(inRange(expenses(txs), thisWeekStart));
  const lastWeek = totalAmount(inRange(expenses(txs), lastWeekStart, lastWeekEnd));

  if (lastWeek === 0 || thisWeek === 0) return null;

  const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
  const absPct = Math.abs(pct).toFixed(0);

  if (Math.abs(pct) < 5) return null;

  const up = pct > 0;
  return {
    id: "week-over-week",
    emoji: up ? "📈" : "📉",
    title: up ? "Spending Up This Week" : "Spending Down This Week",
    description: up
      ? `You've spent ${fmt(thisWeek)} this week — ${absPct}% more than last week (${fmt(lastWeek)}).`
      : `Great job! You've spent ${fmt(thisWeek)} this week — ${absPct}% less than last week (${fmt(lastWeek)}).`,
    sentiment: up ? (pct > 40 ? "warning" : "neutral") : "positive",
    category: "week_over_week",
    value: `${up ? "+" : "-"}${absPct}%`,
    valueLabel: "vs last week",
  };
}

function biggestExpenseInsight(txs: Transaction[]): SpendingInsight | null {
  const thisMonth = inRange(expenses(txs), startOf("month"));
  if (thisMonth.length === 0) return null;

  const biggest = thisMonth.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const desc = (biggest as any).merchant || biggest.description || "Unknown";

  return {
    id: "biggest-expense",
    emoji: "💸",
    title: "Biggest Expense This Month",
    description: `Your largest single purchase was ${desc} for ${fmt(Math.abs(biggest.amount))} on ${new Date(biggest.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
    sentiment: Math.abs(biggest.amount) > 500 ? "warning" : "neutral",
    category: "biggest_expense",
    value: fmt(Math.abs(biggest.amount)),
    valueLabel: desc,
  };
}

function weekendPatternInsight(txs: Transaction[]): SpendingInsight | null {
  const exp = expenses(txs);
  if (exp.length < 10) return null;

  let weekendTotal = 0, weekdayTotal = 0;
  let weekendCount = 0, weekdayCount = 0;

  for (const t of exp) {
    const day = new Date(t.date).getDay();
    if (day === 0 || day === 6) {
      weekendTotal += Math.abs(t.amount);
      weekendCount++;
    } else {
      weekdayTotal += Math.abs(t.amount);
      weekdayCount++;
    }
  }

  if (weekdayCount === 0 || weekendCount === 0) return null;

  const weekendAvg = weekendTotal / weekendCount;
  const weekdayAvg = weekdayTotal / weekdayCount;
  const ratio = weekendAvg / weekdayAvg;

  if (ratio < 1.3 && ratio > 0.7) return null; // not significant

  const higher = ratio >= 1.3;
  return {
    id: "weekend-pattern",
    emoji: higher ? "🎉" : "💪",
    title: higher ? "Weekend Spending Spike" : "Weekday Spending Higher",
    description: higher
      ? `Your average weekend spend (${fmt(weekendAvg)}) is ${ratio.toFixed(1)}x higher than weekdays (${fmt(weekdayAvg)}). Plan ahead!`
      : `You actually spend more on weekdays (${fmt(weekdayAvg)}) than weekends (${fmt(weekendAvg)}). Weekend warrior on a budget!`,
    sentiment: higher && ratio > 2 ? "warning" : "tip",
    category: "weekend_pattern",
    value: `${ratio.toFixed(1)}x`,
    valueLabel: higher ? "vs weekdays" : "weekdays vs weekends",
  };
}

function topCategoryInsight(txs: Transaction[]): SpendingInsight | null {
  const thisMonth = inRange(expenses(txs), startOf("month"));
  if (thisMonth.length < 5) return null;

  const total = totalAmount(thisMonth);
  const byCat: Record<string, number> = {};
  for (const t of thisMonth) {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount);
  }

  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;

  const pct = ((top[1] / total) * 100).toFixed(0);

  return {
    id: "top-category",
    emoji: "🏆",
    title: `${top[0]} Leads Your Spending`,
    description: `${top[0]} accounts for ${pct}% of your total spending this month (${fmt(top[1])} out of ${fmt(total)}).`,
    sentiment: Number(pct) > 50 ? "warning" : "neutral",
    category: "top_category",
    value: `${pct}%`,
    valueLabel: "of total spending",
  };
}

function monthOverMonthInsight(txs: Transaction[]): SpendingInsight | null {
  const now = new Date();
  const thisMonthStart = startOf("month");
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonth = totalAmount(inRange(expenses(txs), thisMonthStart));
  const lastMonth = totalAmount(inRange(expenses(txs), lastMonthStart, lastMonthEnd));

  if (lastMonth === 0 || thisMonth === 0) return null;

  // Project current month based on days elapsed
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(now);
  const projected = (thisMonth / dayOfMonth) * totalDays;
  const diff = projected - lastMonth;
  const pct = Math.abs((diff / lastMonth) * 100).toFixed(0);

  if (Math.abs(diff) < 20) return null;

  const saving = diff < 0;
  return {
    id: "month-over-month",
    emoji: saving ? "🎯" : "⚠️",
    title: saving ? "On Track to Spend Less" : "Projected to Spend More",
    description: saving
      ? `Projected to spend ${fmt(Math.abs(diff))} less than last month. Keep it up!`
      : `On track to spend ${fmt(diff)} more than last month (${fmt(lastMonth)}). Consider cutting back.`,
    sentiment: saving ? "positive" : "warning",
    category: "month_over_month",
    value: `${saving ? "-" : "+"}${pct}%`,
    valueLabel: "vs last month (projected)",
  };
}

function noSpendStreakInsight(txs: Transaction[]): SpendingInsight | null {
  const exp = expenses(txs);
  if (exp.length === 0) return null;

  const sorted = exp
    .map((t) => new Date(t.date).toISOString().split("T")[0])
    .sort()
    .reverse();

  // Find consecutive days with no spending from today backwards
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 30; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() - i);
    const dateStr = check.toISOString().split("T")[0];
    if (sorted.includes(dateStr)) break;
    streak++;
  }

  if (streak < 1) return null;

  return {
    id: "no-spend-streak",
    emoji: "🔥",
    title: streak === 1 ? "No-Spend Day!" : `${streak}-Day No-Spend Streak!`,
    description:
      streak === 1
        ? "You haven't spent anything today. Every penny saved counts!"
        : `Amazing! You haven't made any purchases in the last ${streak} days. That's real discipline!`,
    sentiment: "positive",
    category: "streak",
    value: `${streak}`,
    valueLabel: streak === 1 ? "day" : "days",
  };
}

function transactionCountInsight(txs: Transaction[]): SpendingInsight | null {
  const thisMonth = inRange(expenses(txs), startOf("month"));
  const lastMonthStart = new Date();
  lastMonthStart.setDate(1);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date();
  lastMonthEnd.setDate(0);
  const lastMonth = inRange(expenses(txs), lastMonthStart, lastMonthEnd);

  if (thisMonth.length < 3 || lastMonth.length < 3) return null;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(now);
  const projected = Math.round((thisMonth.length / dayOfMonth) * totalDays);
  const diff = projected - lastMonth.length;

  if (Math.abs(diff) < 3) return null;

  const more = diff > 0;
  return {
    id: "tx-count",
    emoji: more ? "📋" : "✅",
    title: more ? "More Transactions Than Usual" : "Fewer Transactions This Month",
    description: more
      ? `You're on track for ~${projected} transactions this month — ${diff} more than last month (${lastMonth.length}).`
      : `You're on track for ~${projected} transactions — ${Math.abs(diff)} fewer than last month. More intentional spending!`,
    sentiment: more ? "neutral" : "positive",
    category: "merchant",
    value: String(projected),
    valueLabel: "projected transactions",
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateSpendingInsights(transactions: Transaction[]): SpendingInsight[] {
  const generators = [
    noSpendStreakInsight,
    weekOverWeekInsight,
    monthOverMonthInsight,
    topMerchantInsight,
    dailyAverageInsight,
    biggestExpenseInsight,
    weekendPatternInsight,
    topCategoryInsight,
    transactionCountInsight,
  ];

  const insights: SpendingInsight[] = [];
  for (const gen of generators) {
    try {
      const result = gen(transactions);
      if (result) insights.push(result);
    } catch {
      // skip failed generators silently
    }
  }

  // Positive first, then neutral, then warnings
  const order: InsightSentiment[] = ["positive", "tip", "neutral", "warning"];
  return insights.sort((a, b) => order.indexOf(a.sentiment) - order.indexOf(b.sentiment));
}
