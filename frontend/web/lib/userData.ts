/**
 * Keeps small per-user app data (debts, net worth, custom categories, budget rollover,
 * goal contribution history, insight check-offs, preferences) on the server so it follows
 * the user across devices. Pages keep reading localStorage synchronously; this module
 * fills it from the server after sign-in and sends every change back.
 */
import { apiRequest, getUser } from "@/lib/api";

const SYNCED_KEYS = new Set([
  "fintrack-debts",
  "fintrack-net-worth",
  "fintrack-nw-target",
  "fintrack-budget-rollover",
  "fintrack:action-plan-done",
  "fintrack:dismissed-insights",
  "fintrack:settings-categories",
  "fintrack:settings-preferences",
  "fintrack:alert-rules",
]);
const SYNCED_PREFIXES = ["fintrack-goal-contributions-"];
/** Whose data the synced keys in this browser belong to. */
const OWNER_KEY = "fintrack:data-owner";

export function isSyncedKey(key: string): boolean {
  return SYNCED_KEYS.has(key) || SYNCED_PREFIXES.some((p) => key.startsWith(p));
}

function isDemo(): boolean {
  try { return localStorage.getItem("isDemo") === "true"; } catch { return false; }
}

function localSyncedKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSyncedKey(k)) keys.push(k);
  }
  return keys;
}

/** localStorage holds strings; the server holds JSON. */
function toJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}
function toRaw(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function put(key: string, raw: string): Promise<unknown> {
  return apiRequest(`/api/user-data/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(toJson(raw)) });
}

// Writes are debounced per key so typing doesn't send a request per keystroke
const pending = new Map<string, ReturnType<typeof setTimeout>>();
function schedule(key: string, send: () => Promise<unknown>) {
  if (isDemo()) return; // the demo account is shared; keep visitors' edits in their own browser
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    send().catch((e) => console.warn(`Couldn't save ${key} to your account`, e));
  }, 600));
}

/** Use instead of localStorage.setItem for synced keys. */
export function setSynced(key: string, raw: string): void {
  try { localStorage.setItem(key, raw); } catch { /* storage full or blocked */ }
  if (isSyncedKey(key)) schedule(key, () => put(key, raw));
}

/** Use instead of localStorage.removeItem for synced keys. */
export function removeSynced(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  if (isSyncedKey(key)) schedule(key, () => apiRequest(`/api/user-data/${encodeURIComponent(key)}`, { method: "DELETE" }));
}

/** Removes this browser's copy (on sign-out, so the next person doesn't see it). */
export function clearLocalUserData(): void {
  try {
    pending.forEach((t) => clearTimeout(t));
    pending.clear();
    localSyncedKeys().forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(OWNER_KEY);
  } catch { /* ignore */ }
}

let pulled: Promise<void> | null = null;

/**
 * Loads the user's data from the server into localStorage (once per page load).
 * Data saved only in this browser before it was stored on the server is uploaded
 * the first time, so nothing is lost.
 */
export function pullUserData(): Promise<void> {
  if (pulled) return pulled;
  pulled = (async () => {
    const me = getUser()?.id;
    if (!me || isDemo()) return;
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== String(me)) clearLocalUserData(); // someone else's leftovers

    const server = await apiRequest<Record<string, unknown>>("/api/user-data");
    const remote = server && typeof server === "object" ? server : {};
    for (const [k, v] of Object.entries(remote)) {
      if (isSyncedKey(k)) localStorage.setItem(k, toRaw(v));
    }
    // First sign-in since data moved to the server: upload what only this browser has
    const uploads = localSyncedKeys().filter((k) => !(k in remote));
    await Promise.all(uploads.map((k) => put(k, localStorage.getItem(k) ?? "null").catch(() => undefined)));
    localStorage.setItem(OWNER_KEY, String(me));
    window.dispatchEvent(new Event("fintrack-user-data-loaded"));
  })().catch((e) => {
    console.warn("Couldn't load your saved data; using this browser's copy", e);
    pulled = null; // try again on the next navigation
  });
  return pulled;
}
