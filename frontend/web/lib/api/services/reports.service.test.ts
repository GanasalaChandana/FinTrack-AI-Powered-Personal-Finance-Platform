import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { computeReportsData } from "./reports.service";

const tx = (date: string, amount: number, type: string, category = "Other", merchant = "Shop") =>
  ({ date, amount, type, category, merchant, description: merchant }) as any;

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T12:00:00Z")); });
afterAll(() => vi.useRealTimers());

describe("computeReportsData", () => {
  it("totals income, expenses, savings and savings rate for the selected period", () => {
    const r = computeReportsData([
      tx("2026-10-20", 4000, "income"),
      tx("2026-10-21", -1000, "expense"),   // sign is ignored: amounts are counted as absolute
      tx("2026-10-22", 500, "EXPENSE"),
      tx("2026-01-01", 9999, "expense"),    // outside last 30 days
    ], "last-30-days");
    expect(r.summary.netIncome).toBe(4000);
    expect(r.summary.totalExpenses).toBe(1500);
    expect(r.summary.netSavings).toBe(2500);
    expect(r.summary.savingsRate).toBe(62.5);
  });

  it("shows no period-over-period change when history doesn't reach back to the previous period", () => {
    const r = computeReportsData([
      tx("2026-10-10", 1000, "income"),
      tx("2026-10-25", 6000, "income"),
    ], "last-30-days");
    expect(r.summary.incomeChange).toBe(0);
    expect(r.summary.savingsRateChange).toBe(0);
  });

  it("compares with the previous period when there is enough history", () => {
    const r = computeReportsData([
      tx("2026-08-15", 1, "expense"),        // history reaches before the previous period
      tx("2026-09-20", 2000, "income"),      // previous 30 days
      tx("2026-10-20", 3000, "income"),      // current 30 days
    ], "last-30-days");
    expect(r.summary.incomeChange).toBe(50);
  });

  it("breaks expenses down by category with percentages, case-insensitively", () => {
    const r = computeReportsData([
      tx("2026-10-20", 300, "expense", "Bills & Utilities"),
      tx("2026-10-21", 100, "expense", "bills & utilities"),
      tx("2026-10-22", 100, "expense", "Shopping"),
      tx("2026-10-22", 5000, "income", "Salary"),
    ], "last-30-days");
    expect(r.categoryBreakdown.map((c) => [c.name, c.amount, c.percentage])).toEqual([
      ["Bills & Utilities", 400, 80],
      ["Shopping", 100, 20],
    ]);
  });

  it("lists top expenses by merchant", () => {
    const r = computeReportsData([
      tx("2026-10-20", 50, "expense", "Food", "Cafe"),
      tx("2026-10-21", 70, "expense", "Food", "Cafe"),
      tx("2026-10-21", 90, "expense", "Shopping", "Store"),
    ], "last-30-days");
    expect(r.topExpenses[0]).toMatchObject({ vendor: "Cafe", amount: 120 });
    expect(r.topExpenses[1]).toMatchObject({ vendor: "Store", amount: 90 });
  });

  it("falls back to all data (and no changes) when nothing is in the range", () => {
    const r = computeReportsData([tx("2025-01-10", 800, "income"), tx("2025-02-10", 200, "expense")], "last-7-days");
    expect(r.summary.netIncome).toBe(800);
    expect(r.summary.incomeChange).toBe(0);
    expect(r.monthlyData.map((m) => m.month)).toEqual(expect.arrayContaining([expect.stringMatching(/Jan/), expect.stringMatching(/Feb/)]));
  });
});
