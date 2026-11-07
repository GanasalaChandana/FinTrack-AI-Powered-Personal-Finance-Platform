import { currencySymbol } from "@/lib/userPrefs";

// lib/utils/healthScore.ts

export interface FinancialData {
  monthlyIncome: number;
  monthlyExpenses: number;
  totalSavings: number;
  totalDebt: number;
  emergencyFund: number;
  monthlyBudget: number;
  actualSpending: number;
  creditScore?: number;
  onTimePayments: number;
  totalPayments: number;
}

export interface HealthScoreResult {
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    savingsRate: ComponentScore;
    debtToIncome: ComponentScore;
    emergencyFund: ComponentScore;
    budgetAdherence: ComponentScore;
    paymentHistory: ComponentScore;
  };
  recommendations: string[];
  strengths: string[];
  improvements: string[];
}

export interface ComponentScore {
  score: number;
  maxScore: number;
  percentage: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'none'; // none = not scored yet
  description: string;
}

export const calculateFinancialHealthScore = (data: FinancialData): HealthScoreResult => {
  // Component 1: Savings Rate (25% weight)
  const savingsRate = calculateSavingsRate(data);

  // Component 2: Debt-to-Income Ratio (25% weight)
  const debtToIncome = calculateDebtToIncome(data);

  // Component 3: Emergency Fund (20% weight)
  const emergencyFund = calculateEmergencyFund(data);

  // Component 4: Budget Adherence (20% weight)
  const budgetAdherence = calculateBudgetAdherence(data);

  // Component 5: Payment History (10% weight)
  const paymentHistory = calculatePaymentHistory(data);

  // Calculate total score (out of 1000)
  // A component that can't be scored yet (maxScore 0, e.g. no budgets) is left out
  // and the others re-weighted, instead of counting as poor.
  const weights: [ComponentScore, number][] = [
    [savingsRate, 2.5], [debtToIncome, 2.5], [emergencyFund, 2.0], [budgetAdherence, 2.0], [paymentHistory, 1.0],
  ];
  const scored = weights.filter(([c]) => c.maxScore > 0);
  const totalScore = Math.round(
    (scored.reduce((s, [c, w]) => s + c.score * w, 0) / scored.reduce((s, [, w]) => s + 100 * w, 0)) * 1000
  );

  // Determine grade
  const grade = getGrade(totalScore);

  // Generate recommendations
  const recommendations = generateRecommendations(data, {
    savingsRate,
    debtToIncome,
    emergencyFund,
    budgetAdherence,
    paymentHistory,
  });

  // Identify strengths
  const strengths = identifyStrengths({
    savingsRate,
    debtToIncome,
    emergencyFund,
    budgetAdherence,
    paymentHistory,
  });

  // Identify areas for improvement
  const improvements = identifyImprovements({
    savingsRate,
    debtToIncome,
    emergencyFund,
    budgetAdherence,
    paymentHistory,
  });

  return {
    totalScore,
    grade,
    components: {
      savingsRate,
      debtToIncome,
      emergencyFund,
      budgetAdherence,
      paymentHistory,
    },
    recommendations,
    strengths,
    improvements,
  };
};

function calculateSavingsRate(data: FinancialData): ComponentScore {
  const savingsAmount = data.monthlyIncome - data.monthlyExpenses;
  const savingsRate = data.monthlyIncome > 0 ? (savingsAmount / data.monthlyIncome) * 100 : 0;

  let score = 0;
  let status: ComponentScore['status'] = 'poor';
  let description = '';

  if (savingsRate >= 20) {
    score = 100;
    status = 'excellent';
    description = 'Excellent! You\'re saving 20%+ of your income.';
  } else if (savingsRate >= 15) {
    score = 85;
    status = 'good';
    description = 'Good savings rate. Aim for 20% for optimal financial health.';
  } else if (savingsRate >= 10) {
    score = 70;
    status = 'fair';
    description = 'Fair savings rate. Try to increase to 15-20%.';
  } else if (savingsRate >= 5) {
    score = 50;
    status = 'fair';
    description = 'Low savings rate. Focus on increasing to at least 10%.';
  } else {
    score = 25;
    status = 'poor';
    description = 'Critical: Very low or negative savings. Review expenses.';
  }

  return {
    score,
    maxScore: 100,
    percentage: savingsRate,
    status,
    description,
  };
}

function calculateDebtToIncome(data: FinancialData): ComponentScore {
  const dti = data.monthlyIncome > 0 ? (data.totalDebt / (data.monthlyIncome * 12)) * 100 : 0;

  let score = 0;
  let status: ComponentScore['status'] = 'poor';
  let description = '';

  if (dti === 0) {
    score = 100;
    status = 'excellent';
    description = 'Debt-free! Excellent financial position.';
  } else if (dti <= 36) {
    score = 90;
    status = 'excellent';
    description = 'Excellent debt-to-income ratio below 36%.';
  } else if (dti <= 43) {
    score = 75;
    status = 'good';
    description = 'Manageable debt level. Keep monitoring.';
  } else if (dti <= 50) {
    score = 50;
    status = 'fair';
    description = 'High debt level. Consider debt reduction strategies.';
  } else {
    score = 25;
    status = 'poor';
    description = 'Critical debt level. Seek debt reduction plan.';
  }

  return {
    score,
    maxScore: 100,
    percentage: dti,
    status,
    description,
  };
}

function calculateEmergencyFund(data: FinancialData): ComponentScore {
  const monthsCovered = data.monthlyExpenses > 0 ? data.emergencyFund / data.monthlyExpenses : 0;

  let score = 0;
  let status: ComponentScore['status'] = 'poor';
  let description = '';

  if (monthsCovered >= 6) {
    score = 100;
    status = 'excellent';
    description = 'Excellent! You have 6+ months of expenses saved.';
  } else if (monthsCovered >= 3) {
    score = 80;
    status = 'good';
    description = 'Good emergency fund. Aim for 6 months coverage.';
  } else if (monthsCovered >= 1) {
    score = 60;
    status = 'fair';
    description = 'Build your emergency fund to 3-6 months expenses.';
  } else if (monthsCovered > 0) {
    score = 30;
    status = 'poor';
    description = 'Critical: Emergency fund too low. Start building it.';
  } else {
    score = 0;
    status = 'poor';
    description = 'No emergency fund. This should be your top priority.';
  }

  return {
    score,
    maxScore: 100,
    percentage: monthsCovered * 100 / 6, // Percentage toward 6 months
    status,
    description,
  };
}

function calculateBudgetAdherence(data: FinancialData): ComponentScore {
  // No budgets → nothing to adhere to; it's left out of the total rather than scored as poor
  if (!(data.monthlyBudget > 0)) {
    return { score: 0, maxScore: 0, percentage: 0, status: 'none',
             description: 'No budgets set yet. Add budgets in Goals & Budget to score this.' };
  }
  // Only overspending counts against you; coming in under budget is 100%
  const over = Math.max(0, data.actualSpending - data.monthlyBudget);
  const adherence = Math.max(0, 1 - over / data.monthlyBudget) * 100;

  let score = 0;
  let status: ComponentScore['status'] = 'poor';
  let description = '';

  if (adherence >= 95) {
    score = 100;
    status = 'excellent';
    description = 'Excellent budget adherence!';
  } else if (adherence >= 85) {
    score = 85;
    status = 'good';
    description = 'Good budget management. Minor adjustments needed.';
  } else if (adherence >= 70) {
    score = 70;
    status = 'fair';
    description = 'Fair budget adherence. Review spending categories.';
  } else if (adherence >= 50) {
    score = 50;
    status = 'fair';
    description = 'Budget needs attention. Track spending more closely.';
  } else {
    score = 25;
    status = 'poor';
    description = 'Poor budget adherence. Revise budget or spending habits.';
  }

  return {
    score,
    maxScore: 100,
    percentage: adherence,
    status,
    description,
  };
}

function calculatePaymentHistory(data: FinancialData): ComponentScore {
  const onTimeRate = data.totalPayments > 0 
    ? (data.onTimePayments / data.totalPayments) * 100
    : 100;

  let score = 0;
  let status: ComponentScore['status'] = 'poor';
  let description = '';

  if (onTimeRate === 100) {
    score = 100;
    status = 'excellent';
    description = 'Perfect payment history!';
  } else if (onTimeRate >= 95) {
    score = 90;
    status = 'excellent';
    description = 'Excellent payment history.';
  } else if (onTimeRate >= 85) {
    score = 75;
    status = 'good';
    description = 'Good payment history. Stay consistent.';
  } else if (onTimeRate >= 70) {
    score = 50;
    status = 'fair';
    description = 'Fair payment history. Avoid late payments.';
  } else {
    score = 25;
    status = 'poor';
    description = 'Poor payment history. Set up auto-pay.';
  }

  return {
    score,
    maxScore: 100,
    percentage: onTimeRate,
    status,
    description,
  };
}

// Out of 1000. Percentage-style grading: the old 900/800/700/600 scale turned a
// 650 (65%) into a D.
//   A ≥ 850 · B ≥ 700 · C ≥ 550 · D ≥ 400 · F below
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 850) return 'A';
  if (score >= 700) return 'B';
  if (score >= 550) return 'C';
  if (score >= 400) return 'D';
  return 'F';
}

function generateRecommendations(
  data: FinancialData,
  components: HealthScoreResult['components']
): string[] {
  const recommendations: string[] = [];

  // Savings recommendations
  if (components.savingsRate.status === 'poor' || components.savingsRate.status === 'fair') {
    recommendations.push('Increase your savings rate to at least 15% of income');
    recommendations.push('Set up automatic transfers to savings on payday');
  }

  // Debt recommendations
  if (components.debtToIncome.status === 'poor' || components.debtToIncome.status === 'fair') {
    recommendations.push('Focus on paying down high-interest debt first');
    recommendations.push('Consider debt consolidation or balance transfer');
  }

  // Emergency fund recommendations
  if (components.emergencyFund.status === 'poor' || components.emergencyFund.status === 'fair') {
    recommendations.push('Build emergency fund to cover 3-6 months of expenses');
    recommendations.push(`Start with a goal of ${currencySymbol()}1,000 for immediate emergencies`);
  }

  // Budget recommendations
  if (components.budgetAdherence.status === 'poor' || components.budgetAdherence.status === 'fair') {
    recommendations.push('Review and adjust your budget to match spending patterns');
    recommendations.push('Use the envelope method for discretionary spending');
  }

  // Payment history recommendations
  if (components.paymentHistory.status === 'poor' || components.paymentHistory.status === 'fair') {
    recommendations.push('Set up automatic payments to avoid late fees');
    recommendations.push('Use calendar reminders for bill due dates');
  }

  return recommendations.slice(0, 5); // Top 5 recommendations
}

function identifyStrengths(components: HealthScoreResult['components']): string[] {
  const strengths: string[] = [];

  Object.entries(components).forEach(([key, component]) => {
    if (component.status === 'excellent' || component.status === 'good') {
      const labels: Record<string, string> = {
        savingsRate: 'Strong savings habits',
        debtToIncome: 'Manageable debt levels',
        emergencyFund: 'Well-funded emergency savings',
        budgetAdherence: 'Excellent budget discipline',
        paymentHistory: 'Consistent payment history',
      };
      strengths.push(labels[key]);
    }
  });

  return strengths;
}

function identifyImprovements(components: HealthScoreResult['components']): string[] {
  const improvements: string[] = [];

  Object.entries(components).forEach(([key, component]) => {
    if (component.status === 'poor' || component.status === 'fair') {
      const labels: Record<string, string> = {
        savingsRate: 'Increase savings rate',
        debtToIncome: 'Reduce debt burden',
        emergencyFund: 'Build emergency fund',
        budgetAdherence: 'Improve budget adherence',
        paymentHistory: 'Maintain on-time payments',
      };
      improvements.push(labels[key]);
    }
  });

  return improvements;
}