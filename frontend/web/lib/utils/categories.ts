// Shared category utilities — single source of truth for preset + custom categories

const CATS_KEY = "fintrack:settings-categories";

export const PRESET_EXPENSE_CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Entertainment",
  "Bills & Utilities", "Healthcare", "Housing", "Health & Fitness",
  "Insurance", "Personal Care", "Education", "Travel", "Savings", "Other",
];

export const PRESET_INCOME_CATEGORIES = [
  "Salary", "Freelance", "Investment", "Business", "Gift", "Other",
];

export interface CustomCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
}

/** Read custom categories saved in Settings → Categories tab */
export function getCustomCategories(): CustomCategory[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CATS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** All expense category names including custom ones */
export function getExpenseCategories(): string[] {
  const custom = getCustomCategories().map(c => c.name);
  return [...PRESET_EXPENSE_CATEGORIES, ...custom.filter(n => !PRESET_EXPENSE_CATEGORIES.includes(n))];
}

/** All income category names */
export function getIncomeCategories(): string[] {
  return PRESET_INCOME_CATEGORIES;
}

/** All category names (both types) including custom ones */
export function getAllCategories(): string[] {
  const combined = new Set([...PRESET_EXPENSE_CATEGORIES, ...PRESET_INCOME_CATEGORIES, ...getCustomCategories().map(c => c.name)]);
  return Array.from(combined);
}
