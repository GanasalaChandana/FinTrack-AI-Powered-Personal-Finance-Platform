"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, ListChecks } from "lucide-react";
import SubscriptionsView from "@/components/recurring/SubscriptionsView";
import RecurringRulesView from "@/components/recurring/RecurringRulesView";

/**
 * One page for repeating payments: what you pay every month (Subscriptions) and the
 * auto-detected patterns you can save as rules that post themselves (Rules).
 */
function RecurringTabs() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "rules" ? "rules" : "subscriptions";
  const tabs = [
    { id: "subscriptions", label: "Subscriptions", icon: RefreshCw },
    { id: "rules", label: "Rules", icon: ListChecks },
  ] as const;

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div role="tablist" className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/recurring?tab=${t.id}`, { scroll: false })}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "rules" ? <RecurringRulesView /> : <SubscriptionsView />}
    </div>
  );
}

export default function RecurringPage() {
  return (
    <Suspense fallback={null}>
      <RecurringTabs />
    </Suspense>
  );
}
