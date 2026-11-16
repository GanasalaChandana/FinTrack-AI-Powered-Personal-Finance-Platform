import { describe, it, expect } from "vitest";
import { cancelGuideFor, chargedAfterCancel, monthlySaved, isCancelled, type CancelledSub } from "./cancelGuides";

describe("cancel guides", () => {
  it("finds the guide from the name on a statement", () => {
    expect(cancelGuideFor("NETFLIX.COM").name).toBe("Netflix");
    expect(cancelGuideFor("Amazon Prime*1K20O4HP3").known).toBe(true);
    expect(cancelGuideFor("ANTHROPIC* CLAUDE SUB").url).toContain("claude.ai");
  });
  it("gives general steps for a service it doesn't know", () => {
    const g = cancelGuideFor("Joe's Magazine Club");
    expect(g.known).toBe(false);
    expect(g.url).toBeNull();
    expect(g.steps.length).toBeGreaterThan(1);
  });
});

describe("cancelled subscriptions", () => {
  const netflix: CancelledSub = { merchant: "Netflix", monthly: 15.49, cancelledOn: "2026-10-10" };
  const gym: CancelledSub = { merchant: "Planet Fitness", monthly: 24.99, cancelledOn: "2026-10-01" };
  const tx = (merchant: string, date: string, amount: number, type = "EXPENSE") => ({ merchant, date, amount, type });
  const txns = [
    tx("Netflix", "2026-09-10", 15.49), tx("Netflix", "2026-10-10", 15.49), // last bill, on the cancel day
    tx("netflix", "2026-11-10", 15.49),                                       // charged again
    tx("Planet Fitness", "2026-09-28", 24.99),
    tx("Netflix", "2026-11-12", 15.49, "INCOME"),                             // a refund isn't a charge
  ];

  it("spots a charge after the cancellation date, ignoring the last bill and refunds", () => {
    expect(chargedAfterCancel(netflix, txns)).toEqual([{ date: "2026-11-10", amount: 15.49 }]);
    expect(chargedAfterCancel(gym, txns)).toEqual([]);
  });
  it("counts savings only for services that stayed cancelled", () => {
    expect(monthlySaved([netflix, gym], txns)).toEqual({ count: 1, monthly: 24.99 });
    expect(monthlySaved([], txns)).toEqual({ count: 0, monthly: 0 });
  });
  it("matches merchants regardless of case", () => {
    expect(isCancelled([netflix], "NETFLIX")?.cancelledOn).toBe("2026-10-10");
    expect(isCancelled([netflix], "Hulu")).toBeUndefined();
  });
});
