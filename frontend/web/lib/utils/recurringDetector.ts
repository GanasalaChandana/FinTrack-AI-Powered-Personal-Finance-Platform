// lib/utils/recurringDetector.ts

// ── Known subscription keywords ───────────────────────────────────────────────
const SUBSCRIPTION_KEYWORDS = [
  "netflix", "spotify", "hulu", "disney", "amazon prime", "apple",
  "youtube", "google one", "microsoft", "adobe", "dropbox", "slack",
  "zoom", "github", "openai", "chatgpt", "notion", "figma",
  "canva", "grammarly", "duolingo", "headspace", "calm",
  "nytimes", "wsj", "medium", "patreon", "icloud", "onedrive",
  "prime video", "peacock", "paramount", "hbo", "max", "crunchyroll",
  "twitch", "playstation", "xbox", "nintendo", "steam", "epic games",
  "audible", "kindle", "scribd", "chegg",
  "gym", "planet fitness", "la fitness", "equinox",
  "insurance", "geico", "state farm", "progressive",
  "att", "verizon", "comcast", "xfinity", "tmobile", "t-mobile",
];

function checkIsSubscription(description: string): boolean {
  const text = description.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw));
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface RecurringPattern {
  description: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  category: string;
  type: 'INCOME' | 'EXPENSE';
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface RecurringTransaction {
  id: string;
  pattern: RecurringPattern;
  transactions: Transaction[];
  confidence: number;
  nextExpectedDate: string;
  savings?: number;       // annual savings if cancelled
  isSubscription: boolean;
}

// Helper function to normalize descriptions for matching
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate days between two dates
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

// Determine frequency based on average interval
function determineFrequency(avgInterval: number): RecurringPattern['frequency'] | null {
  if (avgInterval >= 6 && avgInterval <= 8) return 'weekly';
  if (avgInterval >= 13 && avgInterval <= 15) return 'biweekly';
  if (avgInterval >= 28 && avgInterval <= 32) return 'monthly';
  if (avgInterval >= 88 && avgInterval <= 95) return 'quarterly';
  if (avgInterval >= 360 && avgInterval <= 370) return 'yearly';
  return null;
}

// Group similar transactions
function groupSimilarTransactions(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    const normalized = normalizeDescription(txn.description);
    
    // Try to find existing group with similar description
    let foundGroup = false;
    for (const [key, group] of groups.entries()) {
      const similarity = calculateSimilarity(normalized, key);
      if (similarity > 0.8) {
        group.push(txn);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(normalized, [txn]);
    }
  }

  return groups;
}

// Simple similarity calculation (Jaccard similarity)
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Calculate confidence score
function calculateConfidence(
  transactions: Transaction[],
  avgInterval: number,
  frequency: string
): number {
  if (transactions.length < 2) return 0;
  
  // More transactions = higher confidence
  const countScore = Math.min(transactions.length / 6, 1) * 0.4;
  
  // Check interval consistency
  const intervals: number[] = [];
  for (let i = 1; i < transactions.length; i++) {
    intervals.push(daysBetween(transactions[i - 1].date, transactions[i].date));
  }
  
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.abs(interval - avgInterval);
  }, 0) / intervals.length;
  
  const consistencyScore = Math.max(0, 1 - (variance / avgInterval)) * 0.4;
  
  // Check amount consistency
  const amounts = transactions.map(t => t.amount);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariance = amounts.reduce((sum, amt) => {
    return sum + Math.abs(amt - avgAmount);
  }, 0) / amounts.length;
  
  const amountScore = Math.max(0, 1 - (amountVariance / avgAmount)) * 0.2;
  
  return Math.min(countScore + consistencyScore + amountScore, 1);
}

// Calculate next expected date
function calculateNextDate(
  lastDate: string,
  frequency: RecurringPattern['frequency']
): string {
  const date = new Date(lastDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString();
}

// Main detection function
export function detectRecurringTransactions(
  transactions: Transaction[],
  minOccurrences: number = 3,
  minConfidence: number = 0.6
): RecurringTransaction[] {
  const recurring: RecurringTransaction[] = [];
  
  // Sort by date
  const sorted = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Group similar transactions
  const groups = groupSimilarTransactions(sorted);
  
  // Analyze each group
  for (const [key, group] of groups.entries()) {
    if (group.length < minOccurrences) continue;
    
    // Sort group by date
    group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate intervals
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      intervals.push(daysBetween(group[i - 1].date, group[i].date));
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const frequency = determineFrequency(avgInterval);
    
    if (!frequency) continue;
    
    // Calculate confidence
    const confidence = calculateConfidence(group, avgInterval, frequency);
    
    if (confidence < minConfidence) continue;
    
    // Calculate average amount
    const avgAmount = group.reduce((sum, txn) => sum + txn.amount, 0) / group.length;
    
    // Get most recent transaction
    const lastTxn = group[group.length - 1];
    
    // Determine day of week/month
    const lastDate = new Date(lastTxn.date);
    const dayOfWeek = frequency === 'weekly' ? lastDate.getDay() : undefined;
    const dayOfMonth = frequency === 'monthly' ? lastDate.getDate() : undefined;
    
    // Subscription detection
    const subscription = checkIsSubscription(lastTxn.description);

    // Potential savings = full annual cost if cancelled (only for expenses)
    const annualCost = lastTxn.type === 'EXPENSE'
      ? (() => {
          switch (frequency) {
            case 'weekly':    return avgAmount * 52;
            case 'biweekly':  return avgAmount * 26;
            case 'monthly':   return avgAmount * 12;
            case 'quarterly': return avgAmount * 4;
            case 'yearly':    return avgAmount;
            default:          return avgAmount * 12;
          }
        })()
      : 0;
    const savings = lastTxn.type === 'EXPENSE' ? annualCost : undefined;

    recurring.push({
      id: `recurring-${Date.now()}-${Math.random()}`,
      pattern: {
        description: lastTxn.description,
        amount: avgAmount,
        frequency,
        category: lastTxn.category,
        type: lastTxn.type,
        dayOfWeek,
        dayOfMonth,
      },
      transactions: group,
      confidence,
      nextExpectedDate: calculateNextDate(lastTxn.date, frequency),
      savings,
      isSubscription: subscription,
    });
  }
  
  // Sort by confidence (highest first)
  return recurring.sort((a, b) => b.confidence - a.confidence);
}

// Create a recurring rule from detected pattern
export function createRecurringRule(recurring: RecurringTransaction) {
  return {
    pattern: recurring.pattern.description,
    amount: recurring.pattern.amount,
    frequency: recurring.pattern.frequency,
    category: recurring.pattern.category,
    type: recurring.pattern.type,
    dayOfWeek: recurring.pattern.dayOfWeek,
    dayOfMonth: recurring.pattern.dayOfMonth,
    confidence: recurring.confidence,
  };
}