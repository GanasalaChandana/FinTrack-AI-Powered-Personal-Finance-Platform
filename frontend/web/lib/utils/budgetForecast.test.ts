import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Budget, Transaction } from "@/lib/api";
import { forecastCurrentMonth } from "@/lib/utils/budgetForecast";

// Only the fields the forecast reads; cast so the tests don't depend on the whole API type.
const tx = (date: string, amount: number, type: string, category?: string) =>
  ({ date, amount, type, category }) as unknown as Transaction;
const budget = (category: string, amount: number) =>
  ({ category, budget: amount }) as unknown as Budget;

describe("forecastCurrentMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wed 11 Mar 2026 (local): 31-day month, 10 full days elapsed, 21 days left including today.
    vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects the month from the daily burn rate", () => {
    const result = forecastCurrentMonth(
      [tx("2026-03-02", 300, "expense", "Dining"), tx("2026-03-05", 100, "expense", "Groceries")],
      [budget("Dining", 1000), budget("Groceries", 200)],
    );

    expect(result.daysInMonth).toBe(31);
    expect(result.daysElapsed).toBe(10);
    expect(result.daysRemaining).toBe(21);
    expect(result.dailyBurnRate).toBe(40); // 400 spent over 10 days
    expect(result.projectedTotal).toBe(1240); // 40 * 31
    expect(result.budgetTotal).toBe(1200);
    expect(result.surplus).toBe(-40);
    expect(result.onTrack).toBe(false);
  });

  it("flags only the categories whose projection exceeds their budget, worst first", () => {
    const result = forecastCurrentMonth(
      [tx("2026-03-02", 300, "expense", "Dining"), tx("2026-03-05", 100, "expense", "Groceries")],
      [budget("Dining", 1000), budget("Groceries", 200)],
    );

    // Dining: 30/day * 31 = 930 of 1000 (not at risk). Groceries: 10/day * 31 = 310 of 200 (at risk).
    expect(result.categories.map((c) => c.category)).toEqual(["Groceries", "Dining"]);
    expect(result.categoriesAtRisk.map((c) => c.category)).toEqual(["Groceries"]);
    expect(result.categories[0].projected).toBe(310);
    expect(Math.round(result.categories[0].percentageUsed)).toBe(155);
  });

  it("counts only this month's expenses, accepting either case for the type", () => {
    const result = forecastCurrentMonth(
      [
        tx("2026-03-03", 100, "expense", "Dining"),
        tx("2026-03-04", 100, "EXPENSE", "Dining"),
        tx("2026-03-04", 5000, "income", "Salary"), // income is not spending
        tx("2026-02-27", 900, "expense", "Dining"), // last month
      ],
      [budget("Dining", 1000)],
    );

    expect(result.dailyBurnRate).toBe(20); // 200 / 10 days
    expect(result.categories[0].spent).toBe(200);
  });

  it("includes uncategorised spending in the total but not in any budget line", () => {
    const result = forecastCurrentMonth(
      [tx("2026-03-03", 100, "expense"), tx("2026-03-04", 100, "expense", "Dining")],
      [budget("Dining", 1000)],
    );

    expect(result.dailyBurnRate).toBe(20);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].spent).toBe(100);
  });

  it("ignores budgets with no amount", () => {
    const result = forecastCurrentMonth([], [budget("Dining", 0), budget("Rent", 800)]);

    expect(result.categories.map((c) => c.category)).toEqual(["Rent"]);
    expect(result.budgetTotal).toBe(800);
  });

  it("does not divide by zero on the first day of the month", () => {
    vi.setSystemTime(new Date(2026, 2, 1, 9, 0, 0));
    const result = forecastCurrentMonth([tx("2026-03-01", 50, "expense", "Dining")], [budget("Dining", 500)]);

    expect(result.daysElapsed).toBe(1); // clamped
    expect(Number.isFinite(result.projectedTotal)).toBe(true);
    expect(result.projectedTotal).toBe(50 * 31);
  });
});
