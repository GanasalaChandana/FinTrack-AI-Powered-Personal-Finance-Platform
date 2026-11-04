"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

/** GET /api/transactions/category-model (5-fold cross-validation on the user's own data) */
interface ModelStats {
  trained: boolean;
  examples: number;
  categories: number;
  accuracy: number | null;
  baselineAccuracy: number | null;
  confidentAccuracy: number | null;
  coverage: number | null;
  minConfidence: number;
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** How well category suggestions work for this user, measured on their own history. */
export function CategoryModelCard() {
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiRequest<ModelStats>("/api/transactions/category-model")
      .then(setStats)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Smart categories</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        New transactions are categorised from your own history: first any category you set for that
        merchant, then a model (Naive Bayes) trained on your categorised transactions, then generic keywords.
      </p>

      {!stats && !failed && (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Measuring…</div>
      )}
      {failed && <p className="text-sm text-gray-500">Couldn&apos;t load the model&apos;s stats right now.</p>}

      {stats && !stats.trained && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          The model starts once you have at least 15 categorised transactions in 2 or more categories
          (you have {stats.examples} in {stats.categories}). Until then, keyword rules suggest categories.
        </p>
      )}

      {stats?.trained && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Accuracy", value: pct(stats.accuracy), hint: "on transactions it wasn't trained on (5-fold cross-validation)" },
            { label: "Always guessing the top category", value: pct(stats.baselineAccuracy), hint: "the baseline to beat" },
            { label: `When ≥${Math.round(stats.minConfidence * 100)}% sure`, value: pct(stats.confidentAccuracy), hint: "only these suggestions are used" },
            { label: "Learned from", value: `${stats.examples}`, hint: `transactions in ${stats.categories} categories` },
          ].map(({ label, value, hint }) => (
            <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3" title={hint}>
              <p className="text-xl font-extrabold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
