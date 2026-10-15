import { describe, expect, it } from "vitest";
import { generateAIInsights, type Transaction } from "@/lib/utils/aiInsights";

let nextId = 0;
const expense = (date: string, amount: number, category: string, description = "Purchase"): Transaction => ({
  id: String(nextId++),
  date,
  amount,
  category,
  description,
  type: "EXPENSE",
});

// Spread across March so no single weekday dominates.
const day = (n: number) => `2026-03-${String(n).padStart(2, "0")}`;

const anomalies = (txns: Transaction[]) =>
  generateAIInsights(txns).filter((i) => i.id.startsWith("anomaly-"));

describe("anomaly detection (mean + 2 standard deviations, per category)", () => {
  it("flags one extreme transaction in an otherwise steady category", () => {
    const steady = [20, 22, 19, 21, 20, 23, 18].map((a, i) => expense(day(i + 1), a, "Dining"));
    const found = anomalies([...steady, expense(day(10), 200, "Dining", "Fancy dinner")]);

    expect(found).toHaveLength(1);
    expect(found[0].type).toBe("warning");
    expect(found[0].category).toBe("Dining");
    expect(found[0].amount).toBe(200);
    expect(found[0].message).toContain("Fancy dinner");
    expect(found[0].impact).toBe("medium"); // between 2 and 3 standard deviations
  });

  it("rates an outlier more than 3 standard deviations out as high impact", () => {
    const steady = Array.from({ length: 10 }, (_, i) => expense(day(i + 1), 20, "Dining"));
    const found = anomalies([...steady, expense(day(12), 500, "Dining")]);

    expect(found).toHaveLength(1);
    expect(found[0].impact).toBe("high");
    expect(found[0].priority).toBe(1);
  });

  it("never flags a category with fewer than 3 transactions", () => {
    const found = anomalies([expense(day(1), 10, "Travel"), expense(day(2), 5000, "Travel")]);

    expect(found).toEqual([]);
  });

  it("does not flag perfectly uniform spending", () => {
    const uniform = Array.from({ length: 8 }, (_, i) => expense(day(i + 1), 40, "Groceries"));

    expect(anomalies(uniform)).toEqual([]);
  });

  it("judges each category against its own history", () => {
    // 900 is normal for Rent but would be wild for Dining; only Dining's outlier should be flagged.
    const rent = [900, 900, 900, 900, 900, 900, 900].map((a, i) => expense(day(i + 1), a, "Rent"));
    const dining = [20, 22, 19, 21, 20, 23, 18].map((a, i) => expense(day(i + 1), a, "Dining"));
    const found = anomalies([...rent, ...dining, expense(day(15), 300, "Dining")]);

    expect(found.map((i) => i.category)).toEqual(["Dining"]);
  });

  it("is mathematically impossible with fewer than 6 transactions (documented limit)", () => {
    // With a population standard deviation, one outlier among n values can reach at most
    // sqrt(n - 1) standard deviations, so it needs n >= 6 to exceed 2.
    const five = [10, 10, 10, 10, 1000].map((a, i) => expense(day(i + 1), a, "Dining"));

    expect(anomalies(five)).toEqual([]);
  });
});

describe("generateAIInsights", () => {
  it("returns nothing for an empty list", () => {
    expect(generateAIInsights([])).toEqual([]);
  });

  it("returns insights sorted by priority, most important first", () => {
    const steady = [20, 22, 19, 21, 20, 23, 18].map((a, i) => expense(day(i + 1), a, "Dining"));
    const insights = generateAIInsights([...steady, expense(day(10), 200, "Dining")]);

    const priorities = insights.map((i) => i.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});
