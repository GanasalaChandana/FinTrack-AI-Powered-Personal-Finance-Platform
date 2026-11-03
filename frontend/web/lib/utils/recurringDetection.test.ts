import { describe, it, expect } from "vitest";
import { detectRecurring } from "./recurringDetection";

let id = 0;
const tx = (merchant: string, date: string, amount: number, type = "expense", description = merchant) =>
  ({ id: String(++id), merchant, description, date, amount, type, category: "Other" }) as any;

const monthly = (merchant: string, amount: number, months = ["2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"]) =>
  months.map((d) => tx(merchant, d, amount));

describe("detectRecurring", () => {
  it("counts one subscription per service, not per payment", () => {
    const r = detectRecurring([...monthly("Netflix", 15.49), ...monthly("Spotify", 10.99)]);
    expect(r.totalSubscriptions).toBe(2);
    expect(r.detectedCount).toBe(2);
    expect(r.items.find((i) => i.merchant === "Netflix")?.occurrences).toBe(4);
  });

  it("monthly commitment is per month, with weekly and biweekly scaled up", () => {
    const weekly = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"].map((d) => tx("Gym", d, 10));
    const r = detectRecurring([...monthly("Netflix", 15), ...weekly]);
    expect(r.items.find((i) => i.merchant === "Gym")?.frequency).toBe("weekly");
    expect(r.totalMonthlyCommitment).toBeCloseTo(15 + 10 * 4.33, 2);
  });

  it("ignores income, one-off payments, irregular dates and changing amounts", () => {
    const r = detectRecurring([
      ...monthly("Employer", 3000).map((t) => ({ ...t, type: "income" })),
      tx("Furniture Store", "2026-09-01", 900),
      tx("Cafe", "2026-09-01", 5), tx("Cafe", "2026-09-03", 5), tx("Cafe", "2026-10-20", 5),
      ...monthly("Grocer", 0).map((t, i) => ({ ...t, amount: [40, 120, 65, 200][i] })),
    ]);
    expect(r.detectedCount).toBe(0);
  });

  it("groups store numbers together", () => {
    const r = detectRecurring(["2026-08-01", "2026-09-01", "2026-10-01"].map((d, i) => tx(`Starbucks #${100 + i}`, d, 6)));
    expect(r.detectedCount).toBe(1);
  });

  it("keywords match whole words only (no subscription for 'Seattle', 'Maxwell', 'Waterstones')", () => {
    const r = detectRecurring([...monthly("Seattle Coffee", 30), ...monthly("Maxwell Deli", 25), ...monthly("Waterstones", 20)]);
    expect(r.detectedCount).toBe(3);
    expect(r.totalSubscriptions).toBe(0);
  });

  it("still tags real services and bills", () => {
    const r = detectRecurring([...monthly("HBO Max", 16), ...monthly("AT&T", 70), ...monthly("Comcast Internet", 60)]);
    expect(r.totalSubscriptions).toBe(3);
  });
});
