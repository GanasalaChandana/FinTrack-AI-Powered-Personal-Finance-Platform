// Builds the "Custom Reports" table/chart data from the user's transactions.

export type CustomMetric = "income" | "expenses" | "savings" | "net-worth";
export type CustomGroupBy = "day" | "week" | "month" | "category";
export type CustomRange = "last-7-days" | "last-30-days" | "last-3-months" | "last-6-months" | "last-year";

export interface CustomReportInput {
  date: string;     // YYYY-MM-DD (or ISO)
  amount: number;
  type: string;     // income / expense, any case
  category?: string;
}

export interface CustomReportRow {
  key: string;      // sort key
  label: string;    // shown on the axis / table
  income: number;
  expenses: number;
  savings: number;
  "net-worth": number; // running balance (cumulative savings) at the end of the period
}

export interface CustomReport {
  rows: CustomReportRow[];
  totals: { income: number; expenses: number; savings: number; "net-worth": number };
  from: string;
  to: string;
  transactionCount: number;
}

const DAYS: Record<CustomRange, number> = {
  "last-7-days": 7, "last-30-days": 30, "last-3-months": 91, "last-6-months": 182, "last-year": 365,
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Date-only strings as local dates (avoids the UTC "one day early" shift)
const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);

const round2 = (n: number) => Math.round(n * 100) / 100;

function bucket(dateStr: string, category: string, groupBy: CustomGroupBy): { key: string; label: string } {
  const d = parse(dateStr);
  switch (groupBy) {
    case "day":
      return { key: iso(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    case "week": {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return { key: iso(monday), label: `Wk of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` };
    }
    case "month":
      return { key: iso(d).slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) };
    case "category":
      return { key: category, label: category };
  }
}

export function buildCustomReport(
  transactions: CustomReportInput[],
  range: CustomRange,
  groupBy: CustomGroupBy,
  today: Date = new Date(),
): CustomReport {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - (DAYS[range] - 1));
  const from = iso(start), to = iso(end);

  const inRange = transactions.filter((t) => {
    const day = (t.date ?? "").slice(0, 10);
    return day >= from && day <= to && Number.isFinite(t.amount);
  });

  const map = new Map<string, CustomReportRow>();
  for (const t of inRange) {
    const isIncome = (t.type ?? "").toLowerCase() === "income";
    const { key, label } = bucket(t.date, t.category || "Uncategorized", groupBy);
    const row = map.get(key) ?? { key, label, income: 0, expenses: 0, savings: 0, "net-worth": 0 };
    if (isIncome) row.income += Math.abs(t.amount);
    else row.expenses += Math.abs(t.amount);
    map.set(key, row);
  }

  const rows = [...map.values()];
  if (groupBy === "category") rows.sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));
  else rows.sort((a, b) => a.key.localeCompare(b.key));

  let running = 0;
  for (const r of rows) {
    r.income = round2(r.income);
    r.expenses = round2(r.expenses);
    r.savings = round2(r.income - r.expenses);
    running = round2(running + r.savings);
    r["net-worth"] = running; // cumulative over time (by category it's just the running sum)
  }

  const income = round2(rows.reduce((s, r) => s + r.income, 0));
  const expenses = round2(rows.reduce((s, r) => s + r.expenses, 0));
  return {
    rows,
    totals: { income, expenses, savings: round2(income - expenses), "net-worth": running },
    from, to,
    transactionCount: inRange.length,
  };
}
