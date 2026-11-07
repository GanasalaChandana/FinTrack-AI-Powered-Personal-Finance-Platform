"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Home, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";

function JoinHousehold() {
  const token = useSearchParams()?.get("token") ?? "";
  const [state, setState] = useState<{ status: "joining" | "joined" | "error"; text?: string }>({ status: "joining" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) { setState({ status: "error", text: "This invitation link is incomplete." }); return; }
    apiRequest<{ name: string }>("/api/households/join", { method: "POST", body: JSON.stringify({ token }) })
      .then((h) => setState({ status: "joined", text: h.name }))
      .catch((e) => setState({ status: "error", text: errorMessage(e) ?? "Couldn't join the household." }));
  }, [token]);

  return (
    <div className="max-w-md mx-auto mt-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
      <Home className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
      {state.status === "joining" && (
        <p className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300"><Loader2 className="w-4 h-4 animate-spin" /> Joining household…</p>
      )}
      {state.status === "joined" && (
        <>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> You joined {state.text}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Shared budgets now appear on your Budgets page. Your transactions stay private.</p>
          <Link href="/goals-budgets?tab=budgets" className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">See budgets</Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Couldn&apos;t join
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{state.text}</p>
          <Link href="/settings?tab=household" className="inline-block rounded-xl border border-gray-200 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200">Household settings</Link>
        </>
      )}
    </div>
  );
}

export default function JoinHouseholdPage() {
  return <Suspense fallback={null}><JoinHousehold /></Suspense>;
}
