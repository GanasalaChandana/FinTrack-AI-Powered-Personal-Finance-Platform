// The display preferences chosen in Settings → Preferences (stored in this browser).

export const PREFS_KEY = "fintrack:settings-preferences";

export const CURRENCIES = ["USD", "EUR", "INR", "GBP", "CAD", "AUD", "JPY"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

function readPrefs(): { currency?: string } {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); } catch { return {}; }
}

/** The currency the user picked in Settings (USD until they pick one). */
export function userCurrency(): CurrencyCode {
  const c = readPrefs().currency;
  return (CURRENCIES as readonly string[]).includes(c ?? "") ? (c as CurrencyCode) : "USD";
}

/** Just the symbol, for places that build text like "$120/month". */
export function currencySymbol(): string {
  const part = new Intl.NumberFormat("en-US", { style: "currency", currency: userCurrency() })
    .formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? "$";
}

export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

function readDateFormat(): DateFormat {
  if (typeof window === "undefined") return "MM/DD/YYYY";
  try {
    const f = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}").dateFormat;
    return f === "DD/MM/YYYY" || f === "YYYY-MM-DD" ? f : "MM/DD/YYYY";
  } catch { return "MM/DD/YYYY"; }
}

/**
 * Locale for formatting dates in the user's chosen order: numeric dates come out as
 * 10/4/2026 (US), 04/10/2026 (day first) or 2026-10-04, and short ones as
 * "Oct 4" or "4 Oct".
 */
export function dateLocale(): string {
  switch (readDateFormat()) {
    case "DD/MM/YYYY": return "en-GB";
    case "YYYY-MM-DD": return "en-CA";
    default: return "en-US";
  }
}
