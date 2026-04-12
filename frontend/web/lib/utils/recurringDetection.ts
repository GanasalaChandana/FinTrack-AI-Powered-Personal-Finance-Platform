// lib/utils/recurringDetection.ts
// Pure JS recurring transaction detection — no API calls needed

import { Transaction } from "@/lib/api";

export interface RecurringTransaction {
  merchant: string;
  category: string;
  amount: number;
  frequency: "monthly" | "weekly" | "biweekly";
  lastDate: string;
  nextExpected: string;
  occurrences: number;
  transactionIds: string[];
  isSubscription: boolean;
}

export interface RecurringSummary {
  items: RecurringTransaction[];
  totalMonthlyCommitment: number;
  totalSubscriptions: number;
  detectedCount: number;
}

// Known subscription keywords for instant tagging
const SUBSCRIPTION_KEYWORDS = [
  "netflix", "spotify", "hulu", "disney", "amazon prime", "apple",
  "youtube", "google", "microsoft", "adobe", "dropbox", "slack",
  "zoom", "github", "openai", "chatgpt", "notion", "figma",
  "canva", "grammarly", "duolingo", "headspace", "calm",
  "nytimes", "wsj", "medium", "patreon", "onlyfans",
  "icloud", "one drive", "onedrive", "prime video", "peacock",
  "paramount", "hbo", "max", "crunchyroll", "twitch",
  "playstation", "xbox", "nintendo", "steam", "epic",
  "audible", "kindle", "scribd", "chegg",
  "gym", "planet fitness", "la fitness", "equinox",
  "insurance", "geico", "state farm", "progressive",
  "electricity", "water", "gas bill", "internet", "att", "verizon",
  "comcast", "xfinity", "tmobile", "t-mobile", "sprint",
];

function isSubscription(merchant: string, description: string): boolean {
  const text = `${merchant} ${description}`.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw));
}

function normalizeMerchant(merchant: string, description: string): string {
  const raw = (merchant?.trim() || description?.trim() || "Unknown").toLowerCase();
  // Strip trailing numbers / location suffixes (e.g. "Starbucks #1234" → "starbucks")
  return raw.replace(/#\d+/g, "").replace(/\s{2,}/g, " ").trim();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function detectFrequency(
  dates: string[]
): { frequency: "monthly" | "weekly" | "biweekly"; avgDays: number } | null {
  if (dates.length < 2) return null;

  const sorted = [...dates].sort();
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  // Allow ±5 day variance for monthly, ±2 for weekly/biweekly
  if (avgGap >= 25 && avgGap <= 35) {
    return { frequency: "monthly", avgDays: 30 };
  }
  if (avgGap >= 12 && avgGap <= 16) {
    return { frequency: "biweekly", avgDays: 14 };
  }
  if (avgGap >= 5 && avgGap <= 9) {
    return { frequency: "weekly", avgDays: 7 };
  }

  return null;
}

function amountsConsistent(amounts: number[]): boolean {
  if (amounts.length < 2) return true;
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  // Allow up to 10% variance (price increases, tax)
  return amounts.every((a) => Math.abs(a - avg) / avg <= 0.1);
}

export function detectRecurring(transactions: Transaction[]): RecurringSummary {
  // Only look at expenses
  const expenses = transactions.filter(
    (t) => t.type === "expense" || t.type === "EXPENSE"
  );

  // Group by normalized merchant
  const groups: Record<
    string,
    { transactions: Transaction[]; merchant: string; category: string }
  > = {};

  for (const t of expenses) {
    const key = normalizeMerchant(t.merchant || "", t.description || "");
    if (!groups[key]) {
      groups[key] = {
        transactions: [],
        merchant: t.merchant || t.description || "Unknown",
        category: t.category || "Other",
      };
    }
    groups[key].transactions.push(t);
  }

  const items: RecurringTransaction[] = [];

  for (const [, group] of Object.entries(groups)) {
    const { transactions: txs, merchant, category } = group;

    // Need at least 2 occurrences to detect a pattern
    if (txs.length < 2) continue;

    const dates = txs.map((t) => t.date).filter(Boolean);
    const amounts = txs.map((t) => Math.abs(t.amount));

    const freqResult = detectFrequency(dates);
    if (!freqResult) continue;

    if (!amountsConsistent(amounts)) continue;

    const sortedDates = [...dates].sort();
    const lastDate = sortedDates[sortedDates.length - 1];
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    items.push({
      merchant,
      category,
      amount: parseFloat(avgAmount.toFixed(2)),
      frequency: freqResult.frequency,
      lastDate,
      nextExpected: addDays(lastDate, freqResult.avgDays),
      occurrences: txs.length,
      transactionIds: txs.map((t) => t.id!).filter(Boolean),
      isSubscription: isSubscription(merchant, txs[0]?.description || ""),
    });
  }

  // Sort: subscriptions first, then by amount desc
  items.sort((a, b) => {
    if (a.isSubscription !== b.isSubscription) return a.isSubscription ? -1 : 1;
    return b.amount - a.amount;
  });

  const totalMonthlyCommitment = items.reduce((sum, item) => {
    if (item.frequency === "monthly") return sum + item.amount;
    if (item.frequency === "biweekly") return sum + item.amount * 2.17;
    if (item.frequency === "weekly") return sum + item.amount * 4.33;
    return sum;
  }, 0);

  return {
    items,
    totalMonthlyCommitment: parseFloat(totalMonthlyCommitment.toFixed(2)),
    totalSubscriptions: items.filter((i) => i.isSubscription).length,
    detectedCount: items.length,
  };
}

// Helper: check if a single transaction is recurring (for badge display)
export function isTransactionRecurring(
  transaction: Transaction,
  allTransactions: Transaction[]
): boolean {
  const summary = detectRecurring(allTransactions);
  const key = normalizeMerchant(
    transaction.merchant || "",
    transaction.description || ""
  );
  return summary.items.some((item) =>
    normalizeMerchant(item.merchant, "") === key
  );
}
