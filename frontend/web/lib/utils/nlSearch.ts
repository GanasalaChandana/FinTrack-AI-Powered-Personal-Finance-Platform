// lib/utils/nlSearch.ts
// Natural-language query parser for transaction search.
// Runs 100% client-side — no API needed.
//
// Understands queries like:
//   "food spending last month"
//   "transactions over $100 in March"
//   "Starbucks coffee this week"
//   "income from salary"
//   "expensive purchases last 30 days"

export interface NLFilter {
  keywords:    string[];       // free-text search terms
  type?:       "income" | "expense";
  categories:  string[];       // matched categories
  merchants:   string[];       // matched merchant names
  minAmount?:  number;
  maxAmount?:  number;
  dateFrom?:   string;         // ISO date YYYY-MM-DD
  dateTo?:     string;
  description: string;         // human-readable summary of what was parsed
}

// ── Category keyword map ──────────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string[]> = {
  "Food & Dining":    ["food","dining","restaurant","coffee","cafe","eat","lunch","dinner","breakfast","groceries","grocery","starbucks","chipotle","mcdonalds","taco","pizza","sushi"],
  "Transportation":   ["transport","transportation","gas","fuel","uber","lyft","taxi","car","bus","transit","parking","commute","travel"],
  "Entertainment":    ["entertainment","movie","netflix","spotify","hulu","disney","gaming","game","concert","music","streaming"],
  "Shopping":         ["shopping","amazon","shop","store","retail","clothes","clothing","fashion","mall"],
  "Bills & Utilities":["bills","utilities","bill","electric","electricity","internet","phone","water","rent","utility","comcast","verizon","at&t"],
  "Health & Fitness": ["health","fitness","gym","doctor","medical","pharmacy","medicine","workout","yoga","planet fitness"],
  "Travel":           ["travel","hotel","airbnb","flight","airline","vacation","trip","booking","airfare"],
  "Education":        ["education","school","college","tuition","course","udemy","coursera","book","books","library"],
  "Personal Care":    ["personal","care","haircut","salon","beauty","spa","ulta","sephora"],
  "Housing":          ["housing","rent","mortgage","home","house","apartment","lease"],
  "Insurance":        ["insurance","premium","policy","coverage"],
  "Income":           ["income","salary","paycheck","payroll","freelance","wage","deposit","bonus"],
};

// ── Time expressions ──────────────────────────────────────────────────────────

function parseDateRange(query: string): { dateFrom?: string; dateTo?: string } {
  const now    = new Date();
  const today  = now.toISOString().split("T")[0];
  const year   = now.getFullYear();
  const month  = now.getMonth();   // 0-indexed
  const q      = query.toLowerCase();

  // "this week"
  if (/this\s+week/.test(q)) {
    const day  = now.getDay(); // 0=Sun
    const from = new Date(now); from.setDate(now.getDate() - day);
    return { dateFrom: from.toISOString().split("T")[0], dateTo: today };
  }

  // "last week"
  if (/last\s+week/.test(q)) {
    const day  = now.getDay();
    const from = new Date(now); from.setDate(now.getDate() - day - 7);
    const to   = new Date(now); to.setDate(now.getDate() - day - 1);
    return { dateFrom: from.toISOString().split("T")[0], dateTo: to.toISOString().split("T")[0] };
  }

  // "this month"
  if (/this\s+month/.test(q)) {
    return {
      dateFrom: `${year}-${String(month + 1).padStart(2,"0")}-01`,
      dateTo: today,
    };
  }

  // "last month"
  if (/last\s+month/.test(q)) {
    const lm = month === 0 ? 11 : month - 1;
    const ly = month === 0 ? year - 1 : year;
    const last = new Date(ly, lm + 1, 0).getDate();
    return {
      dateFrom: `${ly}-${String(lm + 1).padStart(2,"0")}-01`,
      dateTo:   `${ly}-${String(lm + 1).padStart(2,"0")}-${last}`,
    };
  }

  // "this year"
  if (/this\s+year/.test(q)) {
    return { dateFrom: `${year}-01-01`, dateTo: today };
  }

  // "last year"
  if (/last\s+year/.test(q)) {
    return { dateFrom: `${year - 1}-01-01`, dateTo: `${year - 1}-12-31` };
  }

  // "last 7 days" / "last 30 days" / "past 3 months"
  const daysMatch = q.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (daysMatch) {
    const d = parseInt(daysMatch[1]);
    const from = new Date(now); from.setDate(now.getDate() - d);
    return { dateFrom: from.toISOString().split("T")[0], dateTo: today };
  }
  const monthsMatch = q.match(/(?:last|past)\s+(\d+)\s+months?/);
  if (monthsMatch) {
    const m = parseInt(monthsMatch[1]);
    const from = new Date(now); from.setMonth(from.getMonth() - m);
    return { dateFrom: from.toISOString().split("T")[0], dateTo: today };
  }

  // Named month: "in January", "march", "april 2025"
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const mo = MONTHS[mi];
    const reg = new RegExp(`\\b${mo}\\b(?:\\s+(\\d{4}))?`);
    const m = q.match(reg);
    if (m) {
      const y = m[1] ? parseInt(m[1]) : (mi <= month ? year : year - 1);
      const last = new Date(y, mi + 1, 0).getDate();
      return {
        dateFrom: `${y}-${String(mi + 1).padStart(2,"0")}-01`,
        dateTo:   `${y}-${String(mi + 1).padStart(2,"0")}-${last}`,
      };
    }
  }

  return {};
}

// ── Amount expressions ────────────────────────────────────────────────────────

function parseAmount(query: string): { minAmount?: number; maxAmount?: number } {
  const q = query.toLowerCase();

  // "over $100" / "more than 50" / "> 200"
  const overMatch = q.match(/(?:over|above|more than|greater than|>)\s*\$?(\d+(?:\.\d+)?)/);
  if (overMatch) return { minAmount: parseFloat(overMatch[1]) };

  // "under $50" / "less than 100" / "< 30"
  const underMatch = q.match(/(?:under|below|less than|<)\s*\$?(\d+(?:\.\d+)?)/);
  if (underMatch) return { maxAmount: parseFloat(underMatch[1]) };

  // "between $20 and $100"
  const betweenMatch = q.match(/between\s*\$?(\d+(?:\.\d+)?)\s+and\s+\$?(\d+(?:\.\d+)?)/);
  if (betweenMatch) return { minAmount: parseFloat(betweenMatch[1]), maxAmount: parseFloat(betweenMatch[2]) };

  // "expensive" → over $100
  if (/\bexpensive\b/.test(q)) return { minAmount: 100 };

  // "cheap" / "small" → under $20
  if (/\b(cheap|small|tiny|low)\b/.test(q)) return { maxAmount: 20 };

  // bare "$50" treated as "around $50" → ±30%
  const bareMatch = q.match(/\$(\d+(?:\.\d+)?)/);
  if (bareMatch) {
    const v = parseFloat(bareMatch[1]);
    return { minAmount: v * 0.7, maxAmount: v * 1.3 };
  }

  return {};
}

// ── Type detection ─────────────────────────────────────────────────────────────

function parseType(query: string): "income" | "expense" | undefined {
  const q = query.toLowerCase();
  if (/\b(income|salary|earned|revenue|deposit|credit|paycheck|freelance)\b/.test(q)) return "income";
  if (/\b(expense|spent|spending|paid|bought|purchase|charge|debit)\b/.test(q)) return "expense";
  return undefined;
}

// ── Category detection ────────────────────────────────────────────────────────

function parseCategories(query: string): string[] {
  const q = query.toLowerCase();
  const matched: string[] = [];
  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) {
      if (cat !== "Income" || parseType(q) === "income") {
        matched.push(cat);
      }
    }
  }
  return [...new Set(matched)];
}

// ── Merchant detection ────────────────────────────────────────────────────────

const KNOWN_MERCHANTS = [
  "starbucks","amazon","walmart","target","costco","netflix","spotify","apple","google",
  "uber","lyft","doordash","grubhub","chipotle","mcdonalds","subway","starbucks",
  "whole foods","trader joes","kroger","safeway","cvs","walgreens","home depot",
  "best buy","nike","adidas","shell","bp","chevron","comcast","verizon","att",
  "planet fitness","airbnb","booking","delta","united","american airlines",
  "duke energy","chase","paypal","venmo","zelle",
];

function parseMerchants(query: string): string[] {
  const q = query.toLowerCase();
  return KNOWN_MERCHANTS.filter((m) => q.includes(m));
}

// ── Build human-readable description ─────────────────────────────────────────

function buildDescription(filter: NLFilter): string {
  const parts: string[] = [];
  if (filter.type)               parts.push(filter.type === "income" ? "income" : "expenses");
  if (filter.categories.length)  parts.push(`in ${filter.categories.join(", ")}`);
  if (filter.merchants.length)   parts.push(`from ${filter.merchants.join(", ")}`);
  if (filter.minAmount != null && filter.maxAmount != null)
    parts.push(`between $${filter.minAmount.toFixed(0)} and $${filter.maxAmount.toFixed(0)}`);
  else if (filter.minAmount != null) parts.push(`over $${filter.minAmount.toFixed(0)}`);
  else if (filter.maxAmount != null) parts.push(`under $${filter.maxAmount.toFixed(0)}`);
  if (filter.dateFrom && filter.dateTo) {
    const from = new Date(filter.dateFrom).toLocaleDateString("en-US", { month:"short", day:"numeric" });
    const to   = new Date(filter.dateTo).toLocaleDateString("en-US",   { month:"short", day:"numeric" });
    parts.push(`from ${from} to ${to}`);
  }
  if (filter.keywords.length) parts.push(`matching "${filter.keywords.join(", ")}"`);
  return parts.length ? `Showing ${parts.join(" ")}` : "Showing all transactions";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseNLQuery(query: string): NLFilter {
  const q = query.trim();
  if (!q) return { keywords: [], categories: [], merchants: [], description: "Showing all transactions" };

  const dateRange  = parseDateRange(q);
  const amountRange = parseAmount(q);
  const type       = parseType(q);
  const categories = parseCategories(q);
  const merchants  = parseMerchants(q);

  // Remaining words as keyword fallback (strip known parsed tokens)
  const stopWords = new Set([
    "show","me","all","my","the","a","an","and","or","in","from","to","last","this","past","with",
    "that","are","is","was","were","have","of","on","at","for","by","over","under","between","more",
    "than","less","about","around","month","week","year","days","expenses","spending","transactions",
    "income","salary","food","dining","expensive","cheap",
  ]);
  const keywords = q
    .toLowerCase()
    .replace(/[$<>]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w))
    .slice(0, 4);

  const filter: NLFilter = {
    keywords,
    type,
    categories,
    merchants,
    ...dateRange,
    ...amountRange,
    description: "",
  };
  filter.description = buildDescription(filter);

  return filter;
}

// ── Apply filter to transaction array ────────────────────────────────────────

export interface SearchableTransaction {
  id?: string;
  date: string;
  description?: string;
  merchant?: string;
  category?: string;
  type: string;
  amount: number;
}

export function applyNLFilter<T extends SearchableTransaction>(
  transactions: T[],
  filter: NLFilter
): T[] {
  return transactions.filter((t) => {
    // Type
    if (filter.type) {
      const isIncome = ["income","INCOME","credit"].includes(t.type ?? "");
      if (filter.type === "income"  && !isIncome)  return false;
      if (filter.type === "expense" && isIncome)   return false;
    }

    // Category
    if (filter.categories.length) {
      const cat = (t.category ?? "").toLowerCase();
      const match = filter.categories.some((c) => cat.includes(c.toLowerCase()));
      if (!match) return false;
    }

    // Merchant
    if (filter.merchants.length) {
      const mer = (t.merchant ?? t.description ?? "").toLowerCase();
      const match = filter.merchants.some((m) => mer.includes(m));
      if (!match) return false;
    }

    // Amount
    const amt = Math.abs(t.amount);
    if (filter.minAmount != null && amt < filter.minAmount) return false;
    if (filter.maxAmount != null && amt > filter.maxAmount) return false;

    // Date
    if (filter.dateFrom && t.date < filter.dateFrom) return false;
    if (filter.dateTo   && t.date > filter.dateTo)   return false;

    // Keywords — match against merchant + description
    if (filter.keywords.length) {
      const haystack = `${t.merchant ?? ""} ${t.description ?? ""} ${t.category ?? ""}`.toLowerCase();
      const match = filter.keywords.some((kw) => haystack.includes(kw));
      if (!match) return false;
    }

    return true;
  });
}
