import { describe, it, expect } from "vitest";
import { isEssential } from "./recurringDetector";

describe("isEssential", () => {
  it("treats rent, utilities and insurance as not cancellable", () => {
    expect(isEssential("Housing", "Rent")).toBe(true);
    expect(isEssential("Bills & Utilities", "Electric bill")).toBe(true);
    expect(isEssential("Other", "Greystar Apartments")).toBe(true);
    expect(isEssential("Other", "State Farm Insurance")).toBe(true);
  });
  it("leaves optional spending as a possible saving", () => {
    expect(isEssential("Entertainment", "Netflix")).toBe(false);
    expect(isEssential("Food & Dining", "Dinner delivery")).toBe(false);
    expect(isEssential("Health & Fitness", "Planet Fitness")).toBe(false);
    expect(isEssential("Healthcare", "CVS Pharmacy")).toBe(true);
  });
});
