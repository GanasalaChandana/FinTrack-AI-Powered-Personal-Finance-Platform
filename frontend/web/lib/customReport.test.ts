import { describe, expect, it } from "vitest";
import { buildCustomReport, type CustomReportInput } from "@/lib/customReport";

// Fixed "today" so the date windows are deterministic (local date: Wed 2026-03-11).
const TODAY = new Date(2026, 2, 11, 12, 0, 0);

const tx = (
  date: string,
  amount: number,
  type: string,
  category?: string,
): CustomReportInput => ({ date, amount, type, category });

describe("buildCustomReport", () => {
  it("covers exactly the requested window and ignores everything outside it", () => {
    const report = buildCustomReport(
      [
        tx("2026-03-11", 100, "expense"), // today: in range
        tx("2026-03-05", 50, "expense"), // 7-day window starts 2026-03-05: in range
        tx("2026-03-04", 999, "expense"), // one day too old
        tx("2026-03-12", 999, "expense"), // in the future
      ],
      "last-7-days",
      "day",
      TODAY,
    );

    expect(report.from).toBe("2026-03-05");
    expect(report.to).toBe("2026-03-11");
    expect(report.transactionCount).toBe(2);
    expect(report.totals.expenses).toBe(150);
  });

  it("treats the type case-insensitively and always uses absolute amounts", () => {
    const report = buildCustomReport(
      [
        tx("2026-03-10", 2000, "INCOME"),
        tx("2026-03-10", 300, "Expense"),
        tx("2026-03-10", -200, "expense"), // negative expense still counts as 200 spent
      ],
      "last-30-days",
      "month",
      TODAY,
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].income).toBe(2000);
    expect(report.rows[0].expenses).toBe(500);
    expect(report.rows[0].savings).toBe(1500);
  });

  it("groups by day in order and keeps a running net-worth balance", () => {
    const report = buildCustomReport(
      [
        tx("2026-03-09", 100, "income"),
        tx("2026-03-09", 40, "expense"),
        tx("2026-03-10", 10, "expense"),
        tx("2026-03-11", 200, "income"),
      ],
      "last-7-days",
      "day",
      TODAY,
    );

    expect(report.rows.map((r) => r.key)).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
    expect(report.rows.map((r) => r.savings)).toEqual([60, -10, 200]);
    expect(report.rows.map((r) => r["net-worth"])).toEqual([60, 50, 250]);
    expect(report.totals).toEqual({ income: 300, expenses: 50, savings: 250, "net-worth": 250 });
  });

  it("groups weeks by their Monday", () => {
    // 2026-03-09 is a Monday; 03-08 is the Sunday before it.
    const report = buildCustomReport(
      [
        tx("2026-03-08", 10, "expense"),
        tx("2026-03-09", 20, "expense"),
        tx("2026-03-11", 30, "expense"),
      ],
      "last-30-days",
      "week",
      TODAY,
    );

    expect(report.rows.map((r) => r.key)).toEqual(["2026-03-02", "2026-03-09"]);
    expect(report.rows.map((r) => r.expenses)).toEqual([10, 50]);
  });

  it("groups by category, biggest first, with a fallback for missing categories", () => {
    const report = buildCustomReport(
      [
        tx("2026-03-10", 20, "expense", "Dining"),
        tx("2026-03-10", 300, "expense", "Rent"),
        tx("2026-03-11", 15, "expense"), // no category
        tx("2026-03-11", 25, "expense", "Dining"),
      ],
      "last-30-days",
      "category",
      TODAY,
    );

    expect(report.rows.map((r) => r.key)).toEqual(["Rent", "Dining", "Uncategorized"]);
    expect(report.rows.find((r) => r.key === "Dining")?.expenses).toBe(45);
  });

  it("skips rows with a non-numeric amount or a missing date instead of throwing", () => {
    const report = buildCustomReport(
      [
        tx("2026-03-10", Number.NaN, "expense"),
        { date: undefined as unknown as string, amount: 10, type: "expense" },
        tx("2026-03-10", 12.5, "expense"),
      ],
      "last-7-days",
      "day",
      TODAY,
    );

    expect(report.transactionCount).toBe(1);
    expect(report.totals.expenses).toBe(12.5);
  });

  it("rounds to cents so floating point noise never reaches the UI", () => {
    const report = buildCustomReport(
      [tx("2026-03-10", 0.1, "expense"), tx("2026-03-10", 0.2, "expense")],
      "last-7-days",
      "day",
      TODAY,
    );

    expect(report.totals.expenses).toBe(0.3); // not 0.30000000000000004
  });

  it("returns an empty, well-formed report when nothing matches", () => {
    const report = buildCustomReport([], "last-year", "month", TODAY);

    expect(report.rows).toEqual([]);
    expect(report.transactionCount).toBe(0);
    expect(report.totals).toEqual({ income: 0, expenses: 0, savings: 0, "net-worth": 0 });
  });
});
