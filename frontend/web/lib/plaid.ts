/**
 * Plaid Link in the browser: loading Link, finishing a connection, and resuming
 * after a bank's own sign-in page (OAuth: Chase, Bank of America, ...) sends the
 * user back to /plaid/oauth.
 */
import { apiRequest } from "@/lib/api";

export interface SyncResult { added: number; modified: number; removed: number }

export type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidLink = {
  create: (o: {
    token: string;
    receivedRedirectUri?: string;
    onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void;
    onExit?: (err: { error_message?: string; display_message?: string } | null) => void;
  }) => PlaidHandler;
};
declare global { interface Window { Plaid?: PlaidLink } }

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

/** Marks the page while Link is open, so overlays like the install banner can step aside. */
function tracked(Plaid: PlaidLink): PlaidLink {
  const setOpen = (open: boolean) => {
    if (open) document.documentElement.dataset.plaidOpen = "1";
    else delete document.documentElement.dataset.plaidOpen;
  };
  return {
    create: (o) => {
      const handler = Plaid.create({
        ...o,
        onSuccess: (t, m) => { setOpen(false); o.onSuccess(t, m); },
        onExit: (e) => { setOpen(false); o.onExit?.(e); },
      });
      return {
        open: () => { setOpen(true); handler.open(); },
        destroy: () => { setOpen(false); handler.destroy(); },
      };
    },
  };
}

export function loadPlaid(): Promise<PlaidLink> {
  return loadScript().then(tracked);
}

function loadScript(): Promise<PlaidLink> {
  if (window.Plaid) return Promise.resolve(window.Plaid);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PLAID_SCRIPT;
    s.async = true;
    s.onload = () => (window.Plaid ? resolve(window.Plaid) : reject(new Error("Plaid didn't load")));
    s.onerror = () => reject(new Error("Couldn't load Plaid. Check your connection or ad blocker."));
    document.head.appendChild(s);
  });
}

/** Exchanges Link's public token: the server stores the connection and imports transactions. */
export function finishConnection(publicToken: string, institutionName?: string | null): Promise<SyncResult> {
  return apiRequest<SyncResult>("/api/plaid/connect", {
    method: "POST",
    body: JSON.stringify({ publicToken, institutionName }),
  });
}

export const syncSummary = (r: SyncResult) => `${r.added} new, ${r.modified} updated, ${r.removed} removed`;

// The same link token is needed again after the bank's sign-in page, possibly in a new tab
const PENDING_KEY = "fintrack:plaid-link-token";
const PENDING_MAX_AGE_MS = 30 * 60 * 1000; // link tokens expire after 30 minutes

export function rememberLinkToken(token: string): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ token, at: Date.now() })); } catch { /* ignore */ }
}

/** The link token saved before the bank's sign-in page, if recent; it's removed once read. */
export function takeLinkToken(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token: string; at: number };
    return token && Date.now() - at < PENDING_MAX_AGE_MS ? token : null;
  } catch {
    return null;
  }
}
