import { describe, it, expect } from "vitest";
import { categoryTrends } from "./categoryTrends";

const today = new Date(2026, 10, 10); // 10 Nov 2026
const tx = (date: string, amount: number, category: string, type = "EXPENSE") => ({ date, amount, category, type });

describe("categoryTrends", () => {
  const data = [
    tx("2026-09-05", 100, "Food"), tx("2026-10-05", 150, "Food"),       // +50%
    tx("2026-09-10", 200, "Shopping"), tx("2026-10-12", 100, "Shopping"), // -50%
    tx("2026-09-01", 1500, "Housing"), tx("2026-10-01", 1500, "Housing"), // flat
    tx("2026-11-02", 20, "Food"),                                          // current month, ignored for trends
    tx("2026-10-01", 5000, "Salary", "INCOME"),
  ];

  it("compares the last two complete months, per category", () => {
    const r = categoryTrends(data, 3, today);
    expect(r.increasing).toEqual([{ name: "Food", pct: "+50.0%" }]);
    expect(r.decreasing).toEqual([{ name: "Shopping", pct: "-50.0%" }]);
  });

  it("charts real monthly amounts for the top categories", () => {
    const r = categoryTrends(data, 3, today);
    expect(r.top[0]).toBe("Housing");
    expect(r.rows).toEqual([
      { month: "Sep", Housing: 1500, Shopping: 200, Food: 100 },
      { month: "Oct", Housing: 1500, Shopping: 100, Food: 150 },
      { month: "Nov", Housing: 0, Shopping: 0, Food: 20 },
    ]);
  });
});
