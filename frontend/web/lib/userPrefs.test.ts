import { describe, it, expect } from "vitest";
import { withCurrency } from "@/lib/userPrefs";

describe("withCurrency", () => {
  it("adds the symbol only to bare amounts", () => {
    expect(withCurrency("Landlord is your #1 expense (1,400.00, 1 transactions).")).toBe("Landlord is your #1 expense ($1,400.00, 1 transactions).");
    expect(withCurrency("5,500.00 received. Total income: 8,075.00.")).toBe("$5,500.00 received. Total income: $8,075.00.");
    expect(withCurrency("Spent $12.50 at 3.5% over")).toBe("Spent $12.50 at 3.5% over");
  });
});
