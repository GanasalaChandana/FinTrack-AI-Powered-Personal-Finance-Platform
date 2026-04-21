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
  dateFrom?:   string;         // YYYY-MM-DD
  dateTo?:     string;         // YYYY-MM-DD
  rawTerms:    string[];       // original query words used as fallback search
  description: string;         // human-readable summary
}

// ── Category keyword map ──────────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string[]> = {
  "Food & Dining":     ["food","dining","restaurant","coffee","cafe","eat","lunch","dinner","breakfast","groceries","grocery","starbucks","chipotle","mcdonalds","taco","pizza","sushi","burger","doordash","ubereats","grubhub"],
  "Transportation":    ["transport","transportation","gas","fuel","uber","lyft","taxi","car","bus","transit","parking","commute"],
  "Entertainment":     ["entertainment","movie","netflix","spotify","hulu","disney","gaming","game","concert","music","streaming"],
  "Shopping":          ["shopping","amazon","shop","store","retail","clothes","clothing","fashion","mall"],
  "Bills & Utilities": ["bills","utilities","bill","electric","electricity","internet","phone","water","utility","comcast","verizon"],
  "Health & Fitness":  ["health","fitness","gym","doctor","medical","pharmacy","medicine","workout","yoga"],
  "Travel":            ["travel","hotel","airbnb","flight","airline","vacation","trip","booking","airfare"],
  "Education":         ["education","school","college","tuition","course","udemy","coursera","book","library"],
  "Personal Care":     ["personal care","haircut","salon","beauty","spa","ulta","sephora"],
  "Housing":           ["housing","rent","mortgage","home","house","apartment","lease"],
  "Insurance":         ["insurance","premium","policy","coverage"],
};

// ── Timezone-safe date helpers ────────────────────────────────────────────────

/** Display a YYYY-MM-DD string without timezone shifting (avoids UTC→local offset) */
function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

/** Get today's date as YYYY-MM-DD in local timezone */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

// ── Time expressions ──────────────────────────────────────────────────────────

function parseDateRange(query: string): { dateFrom?: string; dateTo?: string } {
  const now   = new Date();
  const today = localToday();
  const year  = now.getFullYear();
  const month = now.getMonth();   // 0-indexed
  const q     = query.toLowerCase();

  // pad helper
  const pad = (n: number) => String(n).padStart(2, "0");

  // "this week"
  if (/this\s+week/.test(q)) {
    const d = now.getDay();
    const from = new Date(now); from.setDate(now.getDate() - d);
    const fY = from.getFullYear(), fM = from.getMonth()+1, fD = from.getDate();
    return { dateFrom: `${fY}-${pad(fM)}-${pad(fD)}`, dateTo: today };
  }

  // "last week"
  if (/last\s+week/.test(q)) {
    const d  = now.getDay();
    const fr = new Date(now); fr.setDate(now.getDate() - d - 7);
    const to = new Date(now); to.setDate(now.getDate() - d - 1);
    return {
      dateFrom: `${fr.getFullYear()}-${pad(fr.getMonth()+1)}-${pad(fr.getDate())}`,
      dateTo:   `${to.getFullYear()}-${pad(to.getMonth()+1)}-${pad(to.getDate())}`,
    };
  }

  // "this month"
  if (/this\s+month/.test(q)) {
    return { dateFrom: `${year}-${pad(month+1)}-01`, dateTo: today };
  }

  // "last month"
  if (/last\s+month/.test(q)) {
    const lm = month === 0 ? 11 : month - 1;
    const ly = month === 0 ? year - 1 : year;
    const lastDay = new Date(ly, lm + 1, 0).getDate();
    return {
      dateFrom: `${ly}-${pad(lm + 1)}-01`,
      dateTo:   `${ly}-${pad(lm + 1)}-${pad(lastDay)}`,
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

  // "last 7 days" / "past 30 days"
  const daysMatch = q.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const fr = new Date(now); fr.setDate(now.getDate() - days);
    return {
      dateFrom: `${fr.getFullYear()}-${pad(fr.getMonth()+1)}-${pad(fr.getDate())}`,
      dateTo: today,
    };
  }

  // "last 3 months"
  const mthsMatch = q.match(/(?:last|past)\s+(\d+)\s+months?/);
  if (mthsMatch) {
    const mths = parseInt(mthsMatch[1]);
    const fr = new Date(now); fr.setMonth(fr.getMonth() - mths);
    return {
      dateFrom: `${fr.getFullYear()}-${pad(fr.getMonth()+1)}-${pad(fr.getDate())}`,
      dateTo: today,
    };
  }

  // Named month: "in March", "april 2025"
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const reg = new RegExp(`\\b${MONTHS[mi]}\\b(?:\\s+(\\d{4}))?`);
    const match = q.match(reg);
    if (match) {
      const y = match[1] ? parseInt(match[1]) : (mi <= month ? year : year - 1);
      const lastDay = new Date(y, mi + 1, 0).getDate();
      return {
        dateFrom: `${y}-${pad(mi + 1)}-01`,
        dateTo:   `${y}-${pad(mi + 1)}-${pad(lastDay)}`,
      };
    }
  }

  return {};
}

// ── Amount expressions ────────────────────────────────────────────────────────

function parseAmount(query: string): { minAmount?: number; maxAmount?: number } {
  const q = query.toLowerCase();

  const overMatch = q.match(/(?:over|above|more than|greater than|>)\s*\$?(\d+(?:\.\d+)?)/);
  if (overMatch) return { minAmount: parseFloat(overMatch[1]) };

  const underMatch = q.match(/(?:under|below|less than|<)\s*\$?(\d+(?:\.\d+)?)/);
  if (underMatch) return { maxAmount: parseFloat(underMatch[1]) };

  const betweenMatch = q.match(/between\s*\$?(\d+(?:\.\d+)?)\s+and\s+\$?(\d+(?:\.\d+)?)/);
  if (betweenMatch) return { minAmount: parseFloat(betweenMatch[1]), maxAmount: parseFloat(betweenMatch[2]) };

  if (/\bexpensive\b/.test(q)) return { minAmount: 100 };
  if (/\b(cheap|small|tiny|low)\b/.test(q)) return { maxAmount: 20 };

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
      matched.push(cat);
    }
  }
  return [...new Set(matched)];
}

// ── Merchant detection ────────────────────────────────────────────────────────

const KNOWN_MERCHANTS = [
  "starbucks","amazon","walmart","target","costco","netflix","spotify","apple","google",
  "uber","lyft","doordash","grubhub","chipotle","mcdonalds","subway",
  "whole foods","trader joe","trader joes","kroger","safeway","cvs","walgreens","home depot",
  "best buy","nike","adidas","shell","bp","chevron","comcast","verizon","att",
  "planet fitness","airbnb","booking","delta","united","american airlines",
  "duke energy","chase","paypal","venmo","zelle",
];

function parseMerchants(query: string): string[] {
  const q = query.toLowerCase();
  return KNOWN_MERCHANTS.filter((m) => q.includes(m));
}

// ── Build description ─────────────────────────────────────────────────────────

function buildDescription(filter: NLFilter): string {
  const parts: string[] = [];
  if (filter.type)               parts.push(filter.type === "income" ? "income" : "expenses");
  if (filter.categories.length)  parts.push(`in ${filter.categories.join(", ")}`);
  if (filter.merchants.length)   parts.push(`from ${filter.merchants.join(", ")}`);
  if (filter.minAmount != null && filter.maxAmount != null)
    parts.push(`between $${filter.minAmount.toFixed(0)}–$${filter.maxAmount.toFixed(0)}`);
  else if (filter.minAmount != null) parts.push(`over $${filter.minAmount.toFixed(0)}`);
  else if (filter.maxAmount != null) parts.push(`under $${filter.maxAmount.toFixed(0)}`);
  if (filter.dateFrom && filter.dateTo) {
    // Use timezone-safe display (no new Date() conversion)
    parts.push(`· ${displayDate(filter.dateFrom)} – ${displayDate(filter.dateTo)}`);
  }
  if (filter.rawTerms.length && !filter.categories.length && !filter.merchants.length)
    parts.push(`matching "${filter.rawTerms.join(" ")}"`);
  return parts.length ? `Showing ${parts.join(" ")}` : "Showing all transactions";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseNLQuery(query: string): NLFilter {
  const q = query.trim();
  if (!q) return { keywords: [], rawTerms: [], categories: [], merchants: [], description: "Showing all transactions" };

  const dateRange   = parseDateRange(q);
  const amountRange = parseAmount(q);
  const type        = parseType(q);
  const categories  = parseCategories(q);
  const merchants   = parseMerchants(q);

  // Keyword fallback — words that aren't obvious stop words
  const stopWords = new Set([
    "show","me","all","my","the","a","an","and","or","in","from","to","last","this","past","with",
    "that","are","is","was","were","have","of","on","at","for","by","over","under","between","more",
    "than","less","about","around","month","week","year","days","expenses","spending","transactions",
    "expensive","cheap","ago",
  ]);
  const rawTerms = q
    .toLowerCase()
    .replace(/[$<>]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w))
    .slice(0, 5);

  // keywords = rawTerms not already covered by category/merchant detection
  const coveredByCategory = categories.flatMap(c =>
    CATEGORY_ALIASES[c]?.filter(a => q.toLowerCase().includes(a)) ?? []
  );
  const keywords = rawTerms.filter(w => !coveredByCategory.includes(w));

  const filter: NLFilter = {
    keywords,
    rawTerms,
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
    // Normalize date — strip time component if present (e.g. "2026-03-05T00:00:00" → "2026-03-05")
    const txDate = (t.date ?? "").slice(0, 10);

    // Type
    if (filter.type) {
      const tType = (t.type ?? "").toLowerCase();
      const isIncome = tType === "income" || tType === "credit";
      if (filter.type === "income"  && !isIncome) return false;
      if (filter.type === "expense" &&  isIncome) return false;
    }

    // Category — case-insensitive, bidirectional includes, word-level fallback
    if (filter.categories.length) {
      const catLower = (t.category ?? "").toLowerCase().trim();
      const match = filter.categories.some((fc) => {
        const fcLower = fc.toLowerCase();
        // Direct includes check (both directions)
        if (catLower.includes(fcLower) || fcLower.includes(catLower)) return true;
        // Word overlap — e.g. "dining" in "Food & Dining"
        const fcWords  = fcLower.split(/[\s&,]+/).filter(w => w.length > 2);
        const catWords = catLower.split(/[\s&,]+/).filter(w => w.length > 2);
        return fcWords.some(w => catWords.includes(w));
      });

      // Fallback: check rawTerms against category name + merchant + description
      if (!match) {
        const haystack = `${t.merchant ?? ""} ${t.description ?? ""} ${t.category ?? ""}`.toLowerCase();
        const rawMatch = filter.rawTerms.some(w => w.length > 2 && haystack.includes(w));
        if (!rawMatch) return false;
      }
    }

    // Merchant
    if (filter.merchants.length) {
      const mer = `${t.merchant ?? ""} ${t.description ?? ""}`.toLowerCase();
      if (!filter.merchants.some((m) => mer.includes(m))) return false;
    }

    // Amount
    const amt = Math.abs(t.amount);
    if (filter.minAmount != null && amt < filter.minAmount) return false;
    if (filter.maxAmount != null && amt > filter.maxAmount) return false;

    // Date — use normalized YYYY-MM-DD string comparison
    if (filter.dateFrom && txDate < filter.dateFrom) return false;
    if (filter.dateTo   && txDate > filter.dateTo)   return false;

    // Keywords — free text against all fields
    if (filter.keywords.length) {
      const haystack = `${t.merchant ?? ""} ${t.description ?? ""} ${t.category ?? ""}`.toLowerCase();
      if (!filter.keywords.some((kw) => haystack.includes(kw))) return false;
    }

    return true;
  });
}
