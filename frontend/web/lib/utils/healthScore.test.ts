import { describe, expect, it } from "vitest";
import { calculateFinancialHealthScore, type FinancialData } from "@/lib/utils/healthScore";

const base: FinancialData = {
  monthlyIncome: 6000, monthlyExpenses: 3000, totalSavings: 10000, totalDebt: 0,
  emergencyFund: 18000, monthlyBudget: 3000, actualSpending: 3000,
  onTimePayments: 10, totalPayments: 10,
};

describe("budget adherence in the health score", () => {
  it("is not scored (and not 'poor') when no budgets are set", () => {
    const r = calculateFinancialHealthScore({ ...base, monthlyBudget: 0 });
    expect(r.components.budgetAdherence.status).toBe("none");
    expect(r.components.budgetAdherence.maxScore).toBe(0);
  });

  it("re-weights the rest instead of counting a missing budget as zero", () => {
    // Everything else excellent: the total should stay at the top, not lose 200 points
    const withBudget = calculateFinancialHealthScore(base).totalScore;
    const noBudget = calculateFinancialHealthScore({ ...base, monthlyBudget: 0 }).totalScore;
    expect(noBudget).toBe(withBudget);
  });

  it("counts spending under budget as full adherence", () => {
    const r = calculateFinancialHealthScore({ ...base, actualSpending: 1500 });
    expect(r.components.budgetAdherence.status).toBe("excellent");
  });

  it("penalises overspending", () => {
    const r = calculateFinancialHealthScore({ ...base, actualSpending: 4500 }); // 50% over
    expect(r.components.budgetAdherence.status).toBe("fair");
  });
});
