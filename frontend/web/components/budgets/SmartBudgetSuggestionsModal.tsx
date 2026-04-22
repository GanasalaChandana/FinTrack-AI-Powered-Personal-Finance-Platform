"use client";

// SmartBudgetSuggestionsModal
// Analyses the user's last 3 months of expense transactions and proposes
// budget amounts for every category that has no budget yet.
// The user can select/deselect categories, adjust the suggested amounts,
// then click "Create Budgets" to save them all at once.

import { useState, useMemo } from "react";
import { X, Sparkles, TrendingUp, Check, Loader2, Info } from "lucide-react";

// ── Per-category visual metadata ─────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  "Food & Dining":     { icon: "🍔", color: "#f97316" },
  "Transportation":    { icon: "🚗", color: "#8b5cf6" },
  "Shopping":          { icon: "🛍️", color: "#ec4899" },
  "Entertainment":     { icon: "🎮", color: "#06b6d4" },
  "Bills & Utilities": { icon: "💡", color: "#10b981" },
  "Healthcare":        { icon: "⚕️", color: "#ef4444" },
  "Groceries":         { icon: "🛒", color: "#3b82f6" },
  "Education":         { icon: "📚", color: "#6366f1" },
  "Travel":            { icon: "✈️", color: "#f59e0b" },
  "Personal Care":     { icon: "💆", color: "#a855f7" },
  "Savings":           { icon: "🏦", color: "#14b8a6" },
  "Other":             { icon: "📦", color: "#6b7280" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Suggestion {
  category:   string;
  avgMonthly: number;
  suggested:  number;
  icon:       string;
  color:      string;
  months:     number; // number of months with data
}

export interface AppliedBudget {
  category: string;
  budget:   number;
  icon:     string;
  color:    string;
}

interface Props {
  transactions:       any[];          // raw transaction objects from the API
  existingCategories: string[];       // categories that already have budgets
  onApply:            (budgets: AppliedBudget[]) => Promise<void>;
  onClose:            () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
  }).format(v);

// ── Main component ────────────────────────────────────────────────────────────

export function SmartBudgetSuggestionsModal({
  transactions,
  existingCategories,
  onApply,
  onClose,
}: Props) {
  // ── Compute suggestions from 3-month spending history ─────────────────────
  const suggestions = useMemo<Suggestion[]>(() => {
    const now         = new Date();
    const existingSet = new Set(existingCategories.map((c) => c.toLowerCase().trim()));

    // Build month-key strings for the last 3 full months
    const monthKeys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }

    // Collect expenses per category per month
    const catMonthly: Record<string, Record<string, number>> = {};
    transactions
      .filter((t) => t.type === "expense" || t.type === "EXPENSE")
      .forEach((t) => {
        const month = (t.date ?? "").slice(0, 7);
        if (!monthKeys.includes(month)) return;
        const cat = (t.category ?? "Other").trim();
        if (!catMonthly[cat]) catMonthly[cat] = {};
        catMonthly[cat][month] =
          (catMonthly[cat][month] ?? 0) + Math.abs(t.amount ?? 0);
      });

    return Object.entries(catMonthly)
      .filter(([cat]) => !existingSet.has(cat.toLowerCase()))
      .map(([cat, monthly]): Suggestion => {
        const values     = Object.values(monthly);
        const months     = values.length;                    // months that had spend
        const total      = values.reduce((s, v) => s + v, 0);
        const avgMonthly = total / 3;                        // divide by 3 even if sparse
        // Suggest avg + 15% buffer, rounded up to nearest $10
        const suggested  = Math.max(Math.ceil((avgMonthly * 1.15) / 10) * 10, 10);
        const meta       = CATEGORY_META[cat] ?? { icon: "📦", color: "#6b7280" };
        return { category: cat, avgMonthly, suggested, ...meta, months };
      })
      .filter((s) => s.avgMonthly > 1)                      // skip trivial amounts
      .sort((a, b) => b.avgMonthly - a.avgMonthly)          // highest spend first
      .slice(0, 10);
  }, [transactions, existingCategories]);

  // ── Local state ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.map((s) => s.category))
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(
    () => Object.fromEntries(suggestions.map((s) => [s.category, s.suggested]))
  );
  const [applying, setApplying] = useState(false);

  const toggle = (cat: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const handleSelectAll = () =>
    setSelected(new Set(suggestions.map((s) => s.category)));

  const handleDeselectAll = () => setSelected(new Set());

  const handleApply = async () => {
    const toCreate: AppliedBudget[] = suggestions
      .filter((s) => selected.has(s.category))
      .map((s) => ({
        category: s.category,
        budget:   amounts[s.category] ?? s.suggested,
        icon:     s.icon,
        color:    s.color,
      }));
    if (toCreate.length === 0) { onClose(); return; }
    setApplying(true);
    try {
      await onApply(toCreate);
    } finally {
      setApplying(false);
    }
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header band ── */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Budget Suggestions</h2>
              <p className="text-xs text-indigo-200">Based on your last 3 months of spending</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Empty state ── */}
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
            <span className="text-5xl">🎉</span>
            <p className="font-bold text-gray-700 dark:text-gray-200">All categories budgeted!</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
              You already have budgets for every spending category we detected.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── Info banner ── */}
            <div className="mx-5 mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <TrendingUp className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                Suggested amounts = your average monthly spend + a 15% buffer.
                Adjust any amount, then click <strong>Create Budgets</strong>.
              </p>
            </div>

            {/* ── Select all / none ── */}
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {suggestions.length} categories detected
              </p>
              <div className="flex gap-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <button onClick={handleSelectAll} className="hover:underline">Select all</button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button onClick={handleDeselectAll} className="hover:underline">Deselect all</button>
              </div>
            </div>

            {/* ── Suggestion rows ── */}
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
              {suggestions.map((s) => {
                const isSelected = selected.has(s.category);
                return (
                  <div
                    key={s.category}
                    onClick={() => toggle(s.category)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 opacity-50"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Category icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: `${s.color}22` }}
                    >
                      {s.icon}
                    </div>

                    {/* Category info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {s.category}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Avg {fmt(s.avgMonthly)}/mo
                        {s.months < 3 && (
                          <span className="ml-1 text-amber-500">(sparse data)</span>
                        )}
                      </p>
                    </div>

                    {/* Editable amount — stop propagation so clicking doesn't toggle */}
                    <div
                      className="flex items-center gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={amounts[s.category] ?? s.suggested}
                        onChange={(e) =>
                          setAmounts((a) => ({
                            ...a,
                            [s.category]: Math.max(1, parseFloat(e.target.value) || 1),
                          }))
                        }
                        className="w-20 text-sm font-bold text-right border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-1.5 flex-1 text-xs text-gray-400 dark:text-gray-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{selected.size} of {suggestions.length} selected</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying || selected.size === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Sparkles className="w-4 h-4" />
                }
                Create {selected.size} Budget{selected.size !== 1 ? "s" : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
