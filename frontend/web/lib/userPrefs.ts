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
