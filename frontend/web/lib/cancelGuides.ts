/**
 * Help with cancelling subscriptions: where to cancel common services, a record of what
 * the user says they cancelled, and a check for charges that show up after that date.
 * FinTrack can't cancel anything itself; it points the way and then keeps watch.
 */

export interface CancelGuide { name: string; match: string[]; url: string; steps: string[] }

export const CANCEL_GUIDES: CancelGuide[] = [
  { name: "Netflix", match: ["netflix"], url: "https://www.netflix.com/cancelplan",
    steps: ["Sign in at netflix.com", "Open Account, then Cancel Membership", "Confirm with Finish Cancellation"] },
  { name: "Spotify", match: ["spotify"], url: "https://www.spotify.com/account/subscription/",
    steps: ["Sign in at spotify.com/account", "Under Your plan choose Change plan", "Scroll to Cancel Premium and confirm"] },
  { name: "Amazon Prime", match: ["amazon prime", "prime video", "amzn prime"], url: "https://www.amazon.com/mc",
    steps: ["Sign in and open Prime Membership", "Choose Manage membership, then End membership", "Follow the prompts to confirm"] },
  { name: "Hulu", match: ["hulu"], url: "https://secure.hulu.com/account",
    steps: ["Sign in at hulu.com/account", "Under Your Subscription choose Cancel", "Continue through the offers to confirm"] },
  { name: "Disney+", match: ["disney"], url: "https://www.disneyplus.com/account",
    steps: ["Sign in at disneyplus.com/account", "Select your subscription", "Choose Cancel Subscription and confirm"] },
  { name: "Max (HBO)", match: ["hbo", "max.com"], url: "https://www.max.com/subscription",
    steps: ["Sign in at max.com", "Open Settings, then Subscription", "Choose Cancel Your Subscription"] },
  { name: "YouTube Premium", match: ["youtube"], url: "https://www.youtube.com/paid_memberships",
    steps: ["Sign in and open Purchases and memberships", "Choose Manage membership", "Select Deactivate, then Continue to cancel"] },
  { name: "Apple (iCloud, Apple TV+, Music)", match: ["apple.com/bill", "apple tv", "apple music", "icloud", "itunes"], url: "https://support.apple.com/en-us/118428",
    steps: ["On iPhone: Settings, then your name, then Subscriptions", "Tap the subscription", "Tap Cancel Subscription"] },
  { name: "Google (One, Play)", match: ["google one", "google storage", "google play", "google *"], url: "https://play.google.com/store/account/subscriptions",
    steps: ["Sign in to Google Play subscriptions", "Select the subscription", "Choose Cancel subscription"] },
  { name: "Adobe", match: ["adobe"], url: "https://account.adobe.com/plans",
    steps: ["Sign in at account.adobe.com/plans", "Choose Manage plan, then Cancel your plan", "Check for an early-cancellation fee before confirming"] },
  { name: "Microsoft 365", match: ["microsoft", "msft"], url: "https://account.microsoft.com/services",
    steps: ["Sign in at account.microsoft.com/services", "Find the subscription and choose Manage", "Choose Cancel subscription (or turn off recurring billing)"] },
  { name: "Dropbox", match: ["dropbox"], url: "https://www.dropbox.com/account/plan",
    steps: ["Sign in at dropbox.com/account/plan", "Choose Cancel plan", "Confirm the downgrade to Basic"] },
  { name: "ChatGPT (OpenAI)", match: ["openai", "chatgpt"], url: "https://chatgpt.com/#settings/Subscription",
    steps: ["Sign in at chatgpt.com", "Open Settings, then Subscription", "Choose Manage, then Cancel subscription"] },
  { name: "Claude (Anthropic)", match: ["anthropic", "claude"], url: "https://claude.ai/settings/billing",
    steps: ["Sign in at claude.ai", "Open Settings, then Billing", "Choose Cancel plan"] },
  { name: "Audible", match: ["audible"], url: "https://www.audible.com/account/overview",
    steps: ["Sign in on the Audible website (not the app)", "Open Account Details", "Choose Cancel membership"] },
  { name: "Planet Fitness", match: ["planet fitness", "planet fit"], url: "https://www.planetfitness.com/my-account",
    steps: ["Many clubs need you to cancel in person or by letter", "Check My Account online first: some memberships can be cancelled there", "Ask for written confirmation of the cancellation"] },
  { name: "LA Fitness", match: ["la fitness"], url: "https://www.lafitness.com",
    steps: ["Sign in and print the cancellation form from My LA Fitness", "Mail it to the address on the form, or hand it to the club's operations manager", "Keep proof of postage or a signed copy"] },
  { name: "Peloton", match: ["peloton"], url: "https://members.onepeloton.com/preferences/subscriptions",
    steps: ["Sign in at onepeloton.com", "Open Preferences, then Subscriptions", "Choose Cancel subscription"] },
  { name: "Paramount+", match: ["paramount"], url: "https://www.paramountplus.com/account/",
    steps: ["Sign in at paramountplus.com/account", "Scroll to Cancel subscription", "Confirm"] },
  { name: "Peacock", match: ["peacock"], url: "https://www.peacocktv.com/account/plans",
    steps: ["Sign in at peacocktv.com/account", "Choose Change or cancel plan", "Select Cancel plan and confirm"] },
  { name: "LinkedIn Premium", match: ["linkedin"], url: "https://www.linkedin.com/premium/manage/",
    steps: ["Sign in and open Premium subscription settings", "Choose Cancel subscription", "Continue to confirm"] },
  { name: "The New York Times", match: ["nytimes", "new york times", "ny times"], url: "https://myaccount.nytimes.com/seg/subscription",
    steps: ["Sign in at myaccount.nytimes.com", "Open Subscription overview", "Choose Cancel your subscription"] },
  { name: "DoorDash (DashPass)", match: ["dashpass"], url: "https://www.doordash.com/consumer/membership/",
    steps: ["Sign in and open Manage DashPass", "Choose End subscription", "Confirm"] },
  { name: "Uber One", match: ["uber one"], url: "https://account.uber.com",
    steps: ["Open the Uber app, then Account, then Uber One", "Choose Manage membership", "Choose End membership (at least 48 hours before renewal)"] },
];

const GENERIC_STEPS = [
  "Sign in on the provider's website and look under Account, Billing or Subscription",
  "If you signed up through Apple or Google, cancel in your phone's Subscriptions settings instead",
  "No cancel option? Contact their support, and keep the confirmation email",
];

/** The guide for a merchant as it appears on a statement, or generic steps. */
export function cancelGuideFor(merchant: string): { name: string; url: string | null; steps: string[]; known: boolean } {
  const m = merchant.toLowerCase();
  const g = CANCEL_GUIDES.find((x) => x.match.some((k) => m.includes(k)));
  return g ? { name: g.name, url: g.url, steps: g.steps, known: true } : { name: merchant, url: null, steps: GENERIC_STEPS, known: false };
}

// ── What the user says they cancelled ────────────────────────────────────────

export const CANCELLED_KEY = "fintrack:cancelled-subscriptions";

export interface CancelledSub { merchant: string; monthly: number; cancelledOn: string } // YYYY-MM-DD

export function loadCancelled(): CancelledSub[] {
  try {
    const v = JSON.parse(localStorage.getItem(CANCELLED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.merchant === "string" && typeof x.cancelledOn === "string") : [];
  } catch {
    return [];
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function isCancelled(list: CancelledSub[], merchant: string): CancelledSub | undefined {
  return list.find((c) => same(c.merchant, merchant));
}

interface Txn { merchant?: string | null; date?: string | null; amount?: number | null; type?: string | null }

/**
 * Charges from a cancelled service dated after the day it was cancelled, newest first.
 * A charge on the cancellation day itself is the last bill, not a problem.
 */
export function chargedAfterCancel(c: CancelledSub, transactions: Txn[]): { date: string; amount: number }[] {
  return transactions
    .filter((t) => String(t.type ?? "").toLowerCase() === "expense" && t.merchant && same(t.merchant, c.merchant)
      && typeof t.date === "string" && t.date.slice(0, 10) > c.cancelledOn)
    .map((t) => ({ date: String(t.date).slice(0, 10), amount: Math.abs(Number(t.amount) || 0) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Monthly amount no longer being paid: cancelled services that haven't charged since. */
export function monthlySaved(list: CancelledSub[], transactions: Txn[]): { count: number; monthly: number } {
  const quiet = list.filter((c) => chargedAfterCancel(c, transactions).length === 0);
  return { count: quiet.length, monthly: Math.round(quiet.reduce((s, c) => s + (Number(c.monthly) || 0), 0) * 100) / 100 };
}
