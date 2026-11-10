"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Landmark, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { errorMessage } from "@/lib/utils/errors";
import { finishConnection, loadPlaid, syncSummary, takeLinkToken } from "@/lib/plaid";

/**
 * Where a bank's own sign-in page (OAuth: Chase, Bank of America, ...) sends the user
 * back to. Re-opens Plaid Link with the same link token to finish the connection.
 * Must match PLAID_REDIRECT_URI and the redirect URI listed in the Plaid dashboard.
 */
export default function PlaidOAuthReturn() {
  const [state, setState] = useState<{ status: "working" | "done" | "error"; text?: string }>({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = takeLinkToken();
    if (!token) {
      setState({ status: "error", text: "This bank connection expired or was started on another device. Start it again from Settings." });
      return;
    }
    loadPlaid()
      .then((Plaid) => {
        const handler = Plaid.create({
          token,
          receivedRedirectUri: window.location.href,
          onSuccess: async (publicToken, metadata) => {
            try {
              const r = await finishConnection(publicToken, metadata?.institution?.name);
              setState({ status: "done", text: `${metadata?.institution?.name ?? "Your bank"} is connected: ${syncSummary(r)}.` });
            } catch (e) {
              setState({ status: "error", text: errorMessage(e) ?? "Couldn't connect the bank." });
            } finally {
              handler.destroy();
            }
          },
          onExit: (err) => {
            setState({ status: "error", text: err?.display_message || err?.error_message || "The bank connection was cancelled." });
          },
        });
        handler.open();
      })
      .catch((e) => setState({ status: "error", text: errorMessage(e) ?? "Couldn't load Plaid." }));
  }, []);

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
        <Landmark className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
        {state.status === "working" && (
          <p className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" /> Finishing your bank connection…
          </p>
        )}
        {state.status !== "working" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center gap-2">
              {state.status === "done"
                ? <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Bank connected</>
                : <><AlertTriangle className="w-5 h-5 text-amber-500" /> Not connected</>}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{state.text}</p>
            <Link href="/settings?tab=banks" className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              Back to bank accounts
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
