import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateInsights, generateActionPlan, detectedSubscriptions, monthsCovered } from "./insightsEngine";

const tx = (date: string, amount: number, type: string, category: string, merchant = category) =>
  ({ date, amount, type, category, merchant, description: merchant }) as any;
const months = ["2026-08-05", "2026-09-05", "2026-10-05"];

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-28T12:00:00Z")); });
afterAll(() => vi.useRealTimers());

describe("detectedSubscriptions", () => {
  it("counts services, not payments, and costs them per month", () => {
    const txns = [...months.map((d) => tx(d, 15, "expense", "Entertainment", "Netflix")),
                  ...months.map((d) => tx(d, 10, "expense", "Entertainment", "Spotify"))];
    const s = detectedSubscriptions(txns);
    expect(s.count).toBe(2);
    expect(s.monthly).toBeCloseTo(25, 2);
  });
});

describe("monthsCovered", () => {
  it("counts distinct months, at least 1", () => {
    expect(monthsCovered(months.map((d) => tx(d, 1, "expense", "X")))).toBe(3);
    expect(monthsCovered([])).toBe(1);
  });
});

describe("generateInsights", () => {
  it("gives fixed costs like rent no 'cut it' savings estimate", () => {
    const txns = [...months.map((d) => tx(d, 2000, "expense", "Housing", "Landlord")),
                  ...months.map((d) => tx(d, 100, "expense", "Shopping"))];
    const top = generateInsights(txns).find((i) => i.id === "top-category");
    expect(top?.category).toBe("Housing");
    expect(top?.savingsEstimate).toBe(0);
  });

  it("estimates flexible-category savings from the monthly average, not the total", () => {
    const txns = [...months.map((d) => tx(d, 600, "expense", "Shopping")),
                  ...months.map((d) => tx(d, 100, "expense", "Food"))];
    const top = generateInsights(txns).find((i) => i.id === "top-category");
    expect(top?.savingsEstimate).toBeCloseTo(600 * 0.1 * 12, 2); // 10% of $600/month, per year
  });

  it("reports the savings rate for upper-case types too", () => {
    const txns = [tx("2026-10-01", 5000, "INCOME", "Salary"), tx("2026-10-02", 1000, "EXPENSE", "Food")];
    expect(generateInsights(txns).some((i) => i.id === "good-savings")).toBe(true);
  });

  it("warns about a low savings rate", () => {
    const txns = [tx("2026-10-01", 1000, "income", "Salary"), tx("2026-10-02", 950, "expense", "Food")];
    expect(generateInsights(txns).some((i) => i.id === "savings-rate")).toBe(true);
  });
});

describe("generateActionPlan", () => {
  it("never suggests trimming a fixed cost", () => {
    const txns = [...months.map((d) => tx(d, 2000, "expense", "Housing")),
                  ...months.map((d) => tx(d, 300, "expense", "Dining"))];
    const trim = generateActionPlan(txns).find((t) => t.id === "top-cat-cut");
    expect(trim?.category).toBe("Dining");
    expect(trim?.annualSavings).toBe(Math.round(300 * 0.15 * 12));
  });

  it("lists tips biggest saving first", () => {
    const txns = [...months.map((d) => tx(d, 400, "expense", "Dining")),
                  ...months.map((d) => tx(d, 200, "expense", "Shopping"))];
    const s = generateActionPlan(txns).map((t) => t.annualSavings);
    expect(s).toEqual([...s].sort((a, b) => b - a));
  });
});
