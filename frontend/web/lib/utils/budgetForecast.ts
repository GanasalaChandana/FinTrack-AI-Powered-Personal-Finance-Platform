// lib/utils/budgetForecast.ts
// Pure JS budget forecasting — no API calls needed

import { Transaction, Budget } from "@/lib/api";

export interface CategoryForecast {
  category: string;
  spent: number;
  budget: number;
  projected: number;
  percentageUsed: number;
  atRisk: boolean;
  daysRemaining: number;
}

export interface MonthForecast {
  projectedTotal: number;
  budgetTotal: number;
  dailyBurnRate: number;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  onTrack: boolean;
  surplus: number; // positive = under budget, negative = over budget
  categories: CategoryForecast[];
  categoriesAtRisk: CategoryForecast[];
}

export function forecastCurrentMonth(
  transactions: Transaction[],
  budgets: Budget[]
): MonthForecast {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.max(today - 1, 1); // avoid division by zero
  const daysRemaining = daysInMonth - today + 1;

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Filter to current month expenses only
  const currentExpenses = transactions.filter((t) => {
    const isExpense =
      t.type === "expense" || t.type === "EXPENSE";
    return isExpense && t.date?.startsWith(currentMonthPrefix);
  });

  // Total spent this month
  const totalSpent = currentExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Daily burn rate & projected total
  const dailyBurnRate = totalSpent / daysElapsed;
  const projectedTotal = dailyBurnRate * daysInMonth;

  // Budget total
  const budgetTotal = budgets.reduce((sum, b) => sum + (b.budget || 0), 0);

  // Per-category forecast
  const spentByCategory: Record<string, number> = {};
  for (const t of currentExpenses) {
    const cat = t.category || "Uncategorized";
    spentByCategory[cat] = (spentByCategory[cat] || 0) + Math.abs(t.amount);
  }

  const categories: CategoryForecast[] = budgets
    .filter((b) => b.budget > 0)
    .map((b) => {
      const cat = b.category;
      const spent = spentByCategory[cat] || 0;
      const dailyCatBurn = spent / daysElapsed;
      const projected = dailyCatBurn * daysInMonth;
      const budget = b.budget;
      const percentageUsed = budget > 0 ? (projected / budget) * 100 : 0;

      return {
        category: cat,
        spent,
        budget,
        projected,
        percentageUsed,
        atRisk: projected > budget,
        daysRemaining,
      };
    })
    .sort((a, b) => b.percentageUsed - a.percentageUsed);

  const categoriesAtRisk = categories.filter((c) => c.atRisk);
  const surplus = budgetTotal - projectedTotal;

  return {
    projectedTotal,
    budgetTotal,
    dailyBurnRate,
    daysElapsed,
    daysInMonth,
    daysRemaining,
    onTrack: projectedTotal <= budgetTotal,
    surplus,
    categories,
    categoriesAtRisk,
  };
}
