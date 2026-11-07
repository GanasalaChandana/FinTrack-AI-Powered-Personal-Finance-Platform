"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, RefreshCw, Unlink, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";
import { dateLocale } from "@/lib/userPrefs";

interface BankItem {
  id: string;
  institutionName: string;
  status: "OK" | "LOGIN_REQUIRED" | "ERROR";
  lastError: string | null;
  lastSyncedAt: string | null;
}
interface SyncResult { added: number; modified: number; removed: number }

// Plaid Link (https://plaid.com/docs/link/web/), loaded only when connecting a bank
type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidLink = {
  create: (o: {
    token: string;
    onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void;
    onExit?: (err: { error_message?: string } | null) => void;
  }) => PlaidHandler;
};
declare global { interface Window { Plaid?: PlaidLink } }

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
function loadPlaid(): Promise<PlaidLink> {
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

/** Settings → Bank accounts: connect banks through Plaid and keep their transactions in sync. */
export function BankConnections({ notify }: { notify: (msg: string, type?: "success" | "error") => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<BankItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // "connect" or an item id

  const load = useCallback(async () => {
    try {
      const s = await apiRequest<{ enabled: boolean }>("/api/plaid/status");
      setEnabled(s.enabled);
      if (s.enabled) setItems(await apiRequest<BankItem[]>("/api/plaid/items"));
    } catch { setEnabled(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const summary = (r: SyncResult) => `${r.added} new, ${r.modified} updated, ${r.removed} removed`;

  const connect = async () => {
    setBusy("connect");
    try {
      const [{ linkToken }, Plaid] = await Promise.all([
        apiRequest<{ linkToken: string }>("/api/plaid/link-token", { method: "POST" }),
        loadPlaid(),
      ]);
      const handler = Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          try {
            const r = await apiRequest<SyncResult>("/api/plaid/connect", {
              method: "POST",
              body: JSON.stringify({ publicToken, institutionName: metadata?.institution?.name }),
            });
            notify(`Bank connected: ${summary(r)}`);
            await load();
          } catch (e) { notify(errorMessage(e) ?? "Couldn't connect the bank", "error"); }
          finally { setBusy(null); handler.destroy(); }
        },
        onExit: (err) => {
          if (err?.error_message) notify(err.error_message, "error");
          setBusy(null);
        },
      });
      handler.open();
    } catch (e) {
      notify(errorMessage(e) ?? "Couldn't start the bank connection", "error");
      setBusy(null);
    }
  };

  const sync = async (item: BankItem) => {
    setBusy(item.id);
    try {
      const r = await apiRequest<SyncResult>(`/api/plaid/items/${item.id}/sync`, { method: "POST" });
      notify(`${item.institutionName}: ${summary(r)}`);
      await load();
    } catch (e) { notify(errorMessage(e) ?? "Sync failed", "error"); }
    finally { setBusy(null); }
  };

  const disconnect = async (item: BankItem) => {
    if (!confirm(`Disconnect ${item.institutionName}? Transactions already imported stay.`)) return;
    setBusy(item.id);
    try {
      await apiRequest(`/api/plaid/items/${item.id}`, { method: "DELETE" });
      notify(`${item.institutionName} disconnected`);
      await load();
    } catch (e) { notify(errorMessage(e) ?? "Couldn't disconnect", "error"); }
    finally { setBusy(null); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bank accounts</h2>
        </div>
        {enabled && (
          <button onClick={() => void connect()} disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
            {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect a bank
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Connect through Plaid to import transactions automatically (checked every 6 hours). FinTrack never sees your bank
        password; new transactions are categorised from your own history.
      </p>

      {enabled === null && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
      {enabled === false && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Bank connections aren&apos;t set up on this server yet. You can still import a CSV export from your bank on the Transactions page.
        </p>
      )}
      {enabled && items.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No banks connected yet.</p>}
      {enabled && items.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.institutionName}</p>
                {item.status === "OK" ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {item.lastSyncedAt ? `Synced ${new Date(item.lastSyncedAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })}` : "Not synced yet"}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {item.lastError ?? "Sync problem"}
                  </p>
                )}
              </div>
              <button onClick={() => void sync(item)} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                {busy === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
              </button>
              <button onClick={() => void disconnect(item)} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
