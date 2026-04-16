// lib/utils/aiInsights.ts

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface SpendingInsight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'tip';
  title: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  category?: string;
  amount?: number;
  actionable: boolean;
  actions?: string[];
  priority: number;
}

export interface SpendingPattern {
  category: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
  averageAmount: number;
  frequency: number;
}

export interface AnomalyDetection {
  transaction: Transaction;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  expectedAmount: number;
}

export const generateAIInsights = (
  transactions: Transaction[],
  previousPeriodTransactions?: Transaction[]
): SpendingInsight[] => {
  const insights: SpendingInsight[] = [];

  // 1. Detect spending anomalies
  const anomalies = detectAnomalies(transactions);
  anomalies.forEach((anomaly, index) => {
    const pct = Math.round((anomaly.transaction.amount / (anomaly.expectedAmount || 1) - 1) * 100);
    const tip = getCategoryTip(anomaly.transaction.category);
    insights.push({
      id: `anomaly-${index}`,
      type: 'warning',
      title: `Unusual ${anomaly.transaction.category} Spending`,
      message: `${anomaly.transaction.description} ($${anomaly.transaction.amount.toFixed(2)}) is ${pct}% above your $${anomaly.expectedAmount.toFixed(0)} average for this category.${tip ? ` ${tip}` : ''}`,
      impact: anomaly.severity,
      category: anomaly.transaction.category,
      amount: anomaly.transaction.amount,
      actionable: true,
      actions: ['Review transaction', 'Update budget', 'Set alert'],
      priority: anomaly.severity === 'high' ? 1 : 2,
    });
  });

  // 2. Identify spending trends
  const trends = analyzeTrends(transactions, previousPeriodTransactions);
  trends.forEach((trend, index) => {
    if (trend.trend === 'increasing' && trend.percentageChange > 20) {
      const tip = getCategoryTip(trend.category);
      insights.push({
        id: `trend-${index}`,
        type: 'warning',
        title: `${trend.category} Up ${Math.round(trend.percentageChange)}% vs Last Period`,
        message: `Your ${trend.category} spending increased by ${Math.round(trend.percentageChange)}% compared to last period (avg $${trend.averageAmount.toFixed(2)}/transaction).${tip ? ` ${tip}` : ''}`,
        impact: trend.percentageChange > 50 ? 'high' : 'medium',
        category: trend.category,
        amount: trend.averageAmount,
        actionable: true,
        actions: ['Review spending', 'Adjust budget', 'Find alternatives'],
        priority: 2,
      });
    } else if (trend.trend === 'decreasing' && trend.percentageChange < -10) {
      insights.push({
        id: `trend-success-${index}`,
        type: 'success',
        title: `${trend.category} Down ${Math.abs(Math.round(trend.percentageChange))}% — Nice Work`,
        message: `You reduced ${trend.category} spending by ${Math.abs(Math.round(trend.percentageChange))}% compared to last period. That's a positive trend — keep it up.`,
        impact: 'medium',
        category: trend.category,
        actionable: false,
        priority: 3,
      });
    }
  });

  // 3. Find recurring patterns
  const recurring = findRecurringTransactions(transactions);
  if (recurring.length > 0) {
    const recurringTotal = recurring.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: 'recurring-found',
      type: 'info',
      title: `${recurring.length} Recurring Transactions Detected`,
      message: `Found ${recurring.length} likely subscription or recurring payments totalling $${recurringTotal.toFixed(2)}/month. Review for any unused services.`,
      impact: 'low',
      actionable: true,
      actions: ['Review recurring', 'Cancel unused subscriptions'],
      priority: 4,
    });
  }

  // 4. Weekend vs Weekday spending
  const weekendSpending = analyzeWeekendSpending(transactions);
  if (weekendSpending.weekendPercentage > 60) {
    insights.push({
      id: 'weekend-spending',
      type: 'tip',
      title: 'Weekend Spending Pattern',
      message: `${weekendSpending.weekendPercentage.toFixed(0)}% of your spending happens on weekends. Consider meal prepping or planning activities.`,
      impact: 'low',
      actionable: true,
      actions: ['Plan weekend budget', 'Try free activities'],
      priority: 5,
    });
  }

  // 5. Top spending categories
  const topCategories = getTopSpendingCategories(transactions, 3);
  topCategories.forEach((cat, index) => {
    if (cat.percentage > 30 && index === 0) {
      const tip = getCategoryTip(cat.category);
      insights.push({
        id: `top-category-${index}`,
        type: 'info',
        title: `${cat.category} Is ${cat.percentage.toFixed(0)}% of Your Spending`,
        message: `${cat.category} accounts for ${cat.percentage.toFixed(0)}% of all expenses ($${cat.amount.toFixed(2)}) across ${cat.count} transactions.${tip ? ` ${tip}` : ''}`,
        impact: 'medium',
        category: cat.category,
        amount: cat.amount,
        actionable: true,
        actions: ['Review category', 'Set a budget limit', 'Find alternatives'],
        priority: 3,
      });
    }
  });

  // 6. Impulse buying detection
  const impulseTransactions = detectImpulseBuying(transactions);
  if (impulseTransactions.length > 5) {
    const totalImpulse = impulseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgImpulse = totalImpulse / impulseTransactions.length;
    insights.push({
      id: 'impulse-buying',
      type: 'warning',
      title: `${impulseTransactions.length} Small Purchases Totalling $${totalImpulse.toFixed(2)}`,
      message: `${impulseTransactions.length} transactions under $50 average $${avgImpulse.toFixed(2)} each — they add up to $${totalImpulse.toFixed(2)} total. Apply the 24-hour rule before small purchases.`,
      impact: 'medium',
      amount: totalImpulse,
      actionable: true,
      actions: ['Review small purchases', 'Set a daily cash limit', 'Use 24-hour rule'],
      priority: 2,
    });
  }

  // 7. Best spending day
  const bestDay = findBestSpendingDay(transactions);
  if (bestDay) {
    insights.push({
      id: 'best-day',
      type: 'success',
      title: 'Your Best Spending Day',
      message: `${bestDay.day} is your most controlled spending day with average of $${bestDay.average.toFixed(2)}.`,
      impact: 'low',
      actionable: false,
      priority: 5,
    });
  }

  // 8. Subscription audit reminder
  const subscriptionCategories = transactions.filter(
    t => t.description.toLowerCase().includes('subscription') || 
         t.description.toLowerCase().includes('monthly')
  );
  if (subscriptionCategories.length > 0) {
    const total = subscriptionCategories.reduce((sum, t) => sum + t.amount, 0);
    insights.push({
      id: 'subscription-audit',
      type: 'tip',
      title: 'Time for Subscription Audit',
      message: `You have ${subscriptionCategories.length} subscriptions costing $${total.toFixed(2)}/month. Review for unused services.`,
      impact: 'medium',
      amount: total,
      actionable: true,
      actions: ['List all subscriptions', 'Cancel unused', 'Negotiate rates'],
      priority: 2,
    });
  }

  // Sort by priority (lower number = higher priority)
  return insights.sort((a, b) => a.priority - b.priority);
};

function detectAnomalies(transactions: Transaction[]): AnomalyDetection[] {
  const anomalies: AnomalyDetection[] = [];
  
  // Group by category
  const byCategory = transactions.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  // Check each category for anomalies
  Object.entries(byCategory).forEach(([category, txns]) => {
    if (txns.length < 3) return; // Need at least 3 transactions

    const amounts = txns.map(t => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / amounts.length
    );

    txns.forEach(txn => {
      const deviation = Math.abs(txn.amount - avg) / (stdDev || 1);
      
      if (deviation > 2) { // 2 standard deviations
        anomalies.push({
          transaction: txn,
          reason: `${(deviation * 100).toFixed(0)}% higher than usual for ${category}`,
          severity: deviation > 3 ? 'high' : 'medium',
          expectedAmount: avg,
        });
      }
    });
  });

  return anomalies;
}

function analyzeTrends(
  current: Transaction[],
  previous?: Transaction[]
): SpendingPattern[] {
  if (!previous || previous.length === 0) return [];

  const patterns: SpendingPattern[] = [];
  
  // Group by category
  const currentByCategory = groupByCategory(current);
  const previousByCategory = groupByCategory(previous);

  Object.keys(currentByCategory).forEach(category => {
    const currentTotal = currentByCategory[category].reduce((sum, t) => sum + t.amount, 0);
    const previousTotal = previousByCategory[category]?.reduce((sum, t) => sum + t.amount, 0) || 0;
    
    const percentageChange = previousTotal > 0 
      ? ((currentTotal - previousTotal) / previousTotal) * 100 
      : 100;

    patterns.push({
      category,
      trend: percentageChange > 10 ? 'increasing' : percentageChange < -10 ? 'decreasing' : 'stable',
      percentageChange,
      averageAmount: currentTotal / currentByCategory[category].length,
      frequency: currentByCategory[category].length,
    });
  });

  return patterns;
}

function findRecurringTransactions(transactions: Transaction[]): Transaction[] {
  const recurring: Transaction[] = [];
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Look for transactions with similar amounts and descriptions
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const t1 = sorted[i];
      const t2 = sorted[j];
      
      // Check if amounts are similar (within 5%)
      const amountDiff = Math.abs(t1.amount - t2.amount) / t1.amount;
      
      // Check if descriptions are similar
      const desc1 = t1.description.toLowerCase();
      const desc2 = t2.description.toLowerCase();
      const similarity = calculateStringSimilarity(desc1, desc2);
      
      // Check day difference
      const daysDiff = Math.abs(
        (new Date(t2.date).getTime() - new Date(t1.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (amountDiff < 0.05 && similarity > 0.7 && (daysDiff >= 28 && daysDiff <= 32)) {
        if (!recurring.find(r => r.id === t1.id)) recurring.push(t1);
        if (!recurring.find(r => r.id === t2.id)) recurring.push(t2);
      }
    }
  }

  return recurring;
}

function analyzeWeekendSpending(transactions: Transaction[]): {
  weekendPercentage: number;
  weekendTotal: number;
  weekdayTotal: number;
} {
  let weekendTotal = 0;
  let weekdayTotal = 0;

  transactions.forEach(t => {
    const day = new Date(t.date).getDay();
    if (day === 0 || day === 6) {
      weekendTotal += t.amount;
    } else {
      weekdayTotal += t.amount;
    }
  });

  const total = weekendTotal + weekdayTotal;
  
  return {
    weekendPercentage: total > 0 ? (weekendTotal / total) * 100 : 0,
    weekendTotal,
    weekdayTotal,
  };
}

function getTopSpendingCategories(transactions: Transaction[], limit: number = 3) {
  const byCategory = groupByCategory(transactions);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  return Object.entries(byCategory)
    .map(([category, txns]) => ({
      category,
      amount: txns.reduce((sum, t) => sum + t.amount, 0),
      count: txns.length,
      percentage: (txns.reduce((sum, t) => sum + t.amount, 0) / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function detectImpulseBuying(transactions: Transaction[]): Transaction[] {
  // Small transactions under $50 that happen frequently
  return transactions.filter(t => {
    return t.amount < 50 && 
           !['Bills & Utilities', 'Healthcare', 'Transportation'].includes(t.category);
  });
}

function findBestSpendingDay(transactions: Transaction[]): { day: string; average: number } | null {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay: Record<number, number[]> = {};

  transactions.forEach(t => {
    const day = new Date(t.date).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t.amount);
  });

  let bestDay: { day: string; average: number } | null = null;
  let lowestAvg = Infinity;

  Object.entries(byDay).forEach(([dayNum, amounts]) => {
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      bestDay = { day: days[parseInt(dayNum)], average: avg };
    }
  });

  return bestDay;
}

function groupByCategory(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/** Returns a short, actionable tip for a given spending category. */
function getCategoryTip(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant'))
    return 'Consider meal prepping on weekends to reduce dining-out frequency.';
  if (cat.includes('housing') || cat.includes('rent'))
    return 'This is often your largest fixed cost — review for any negotiable line items.';
  if (cat.includes('transport') || cat.includes('car') || cat.includes('fuel'))
    return 'Combining errands and using public transit can reduce transport costs significantly.';
  if (cat.includes('entertainment') || cat.includes('streaming'))
    return 'Audit your subscriptions — unused services are the easiest savings to find.';
  if (cat.includes('shopping') || cat.includes('clothing'))
    return 'Try a 48-hour waiting period before non-essential purchases.';
  if (cat.includes('health') || cat.includes('medical'))
    return 'Check if your insurance covers any of these expenses.';
  if (cat.includes('coffee') || cat.includes('cafe'))
    return 'Brewing at home 3 days a week can save $50–100/month.';
  return '';
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}