"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, Plus, Trash2, Pencil, Target, TrendingUp,
  CheckCircle2, Circle, CalendarDays, X, ChevronRight, Sparkles, Wand2,
} from "lucide-react";
import { BudgetManager, type Budget } from "@/components/budgets/BudgetManager";
import { SmartBudgetSuggestionsModal, type AppliedBudget } from "@/components/budgets/SmartBudgetSuggestionsModal";
import { apiRequest, getUser } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, Section, Grid, PageContent } from "@/components/layouts/PageHeader";
import { BudgetProgressCard } from "@/components/budget/BudgetProgressCard";
import { GoalProgressCard } from "@/components/goals/GoalProgressCard";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Goal {
  id:                  string;
  name:                string;
  target:              number;  // maps to targetAmount via @JsonProperty
  current:             number;  // maps to currentAmount via @JsonProperty
  deadline?:           string;
  category:            string;
  icon?:               string;
  color?:              string;
  monthlyContribution?: number;
  progress?:           number;
  achieved?:           boolean;
}

type Tab = "goals" | "budgets";

// ── Category options ───────────────────────────────────────────────────────────

const GOAL_CATEGORIES = [
  "Emergency Fund", "Vacation", "Home Purchase", "Car",
  "Education", "Retirement", "Wedding", "Medical",
  "Electronics", "Investment", "Business", "Other",
];

const GOAL_ICONS = [
  "🎯", "🏠", "✈️", "🚗", "🎓", "💍", "🏥", "💻",
  "📱", "💰", "📈", "🏋️", "🌴", "🎸", "🐾", "⭐",
];

const GOAL_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

// ── Budget category map ────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string[]> = {
  "Food & Dining":     ["food & dining", "food", "dining", "restaurant", "eating out"],
  Transportation:      ["transportation", "transport", "uber", "lyft", "taxi", "gas", "fuel"],
  Shopping:            ["shopping", "clothes", "clothing", "retail"],
  Entertainment:       ["entertainment", "movies", "cinema", "games", "gaming", "subscriptions"],
  "Bills & Utilities": ["bills & utilities", "bills", "utilities", "electricity", "water", "internet", "phone"],
  Healthcare:          ["healthcare", "health", "medical", "doctor", "pharmacy", "dentist"],
  Groceries:           ["groceries", "grocery", "supermarket", "food & grocery"],
  Education:           ["education", "school", "tuition", "books", "course", "training"],
  Travel:              ["travel", "flights", "hotel", "vacation", "airbnb", "trip"],
  "Personal Care":     ["personal care", "beauty", "salon", "spa", "haircut", "grooming"],
  Savings:             ["savings", "saving", "investment", "401k", "ira"],
  Income:              ["income", "salary", "paycheck", "wages", "revenue"],
  Other:               ["other", "miscellaneous", "misc"],
};

const categoryMatches = (budgetCategory: string, txCategory: string): boolean => {
  const bl = budgetCategory.toLowerCase().trim();
  const tl = txCategory.toLowerCase().trim();
  if (bl === tl) return true;
  for (const aliases of Object.values(CATEGORY_MAP)) {
    const na = aliases.map((a) => a.toLowerCase());
    if (na.includes(bl) && na.includes(tl)) return true;
  }
  return false;
};

const getLocalYearMonth = (): string => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// ── Utility helpers ────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const daysUntil = (deadline: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// ── Contribution history helpers (localStorage) ───────────────────────────────

const CONTRIB_PREFIX = "fintrack-goal-contributions-";

interface ContribEntry { date: string; amount: number }

function logContribution(goalId: string, amount: number) {
  try {
    const key  = CONTRIB_PREFIX + goalId;
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as ContribEntry[];
    prev.push({ date: new Date().toISOString().slice(0, 10), amount });
    localStorage.setItem(key, JSON.stringify(prev.slice(-24))); // keep ~2 years
  } catch {}
}

function getContributionHistory(goalId: string): ContribEntry[] {
  try {
    return JSON.parse(localStorage.getItem(CONTRIB_PREFIX + goalId) ?? "[]");
  } catch { return []; }
}

// ── Budget rollover helpers (localStorage) ─────────────────────────────────────

const ROLLOVER_KEY = "fintrack-budget-rollover";

interface RolloverStore { month: string; data: Record<string, number> }

function loadRolloverStore(): RolloverStore | null {
  try { return JSON.parse(localStorage.getItem(ROLLOVER_KEY) ?? "null"); } catch { return null; }
}

function saveRolloverStore(store: RolloverStore) {
  try { localStorage.setItem(ROLLOVER_KEY, JSON.stringify(store)); } catch {}
}

// ── Goal Form Modal ────────────────────────────────────────────────────────────

interface GoalFormProps {
  initial?: Partial<Goal>;
  onSave:  (data: Partial<Goal>) => Promise<void>;
  onClose: () => void;
}

function GoalForm({ initial, onSave, onClose }: GoalFormProps) {
  const [form, setForm] = useState({
    name:                initial?.name                || "",
    target:              initial?.target              ?? "",
    current:             initial?.current             ?? 0,
    category:            initial?.category            || GOAL_CATEGORIES[0],
    deadline:            initial?.deadline            || "",
    monthlyContribution: initial?.monthlyContribution ?? "",
    icon:                initial?.icon               || "🎯",
    color:               initial?.color              || "#10b981",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())       return setError("Goal name is required");
    if (!form.target || +form.target <= 0) return setError("Target amount must be positive");
    if (!form.category.trim())   return setError("Category is required");

    setSaving(true);
    setError("");
    try {
      await onSave({
        name:                form.name.trim(),
        target:              +form.target,
        current:             +form.current || 0,
        category:            form.category,
        deadline:            form.deadline || undefined,
        monthlyContribution: form.monthlyContribution !== "" ? +form.monthlyContribution : undefined,
        icon:                form.icon,
        color:               form.color,
      });
      onClose();
    } catch {
      setError("Failed to save goal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {initial?.id ? "Edit Goal" : "Create New Goal"}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          {/* Icon & Color row */}
          <div className="flex gap-4">
            {/* Icon picker */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Icon</label>
              <div className="grid grid-cols-8 gap-1">
                {GOAL_ICONS.map((ic) => (
                  <button
                    key={ic} type="button"
                    onClick={() => set("icon", ic)}
                    className={`text-xl p-1 rounded-lg border-2 transition-all ${
                      form.icon === ic ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Color</label>
              <div className="grid grid-cols-2 gap-1">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => set("color", c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === c ? "border-gray-800 scale-110" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Goal Name *</label>
            <input
              type="text" value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Emergency Fund, Dream Vacation…"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Target & Current amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Target Amount ($) *</label>
              <input
                type="number" min="1" step="0.01" value={form.target}
                onChange={(e) => set("target", e.target.value)}
                placeholder="10000"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Already Saved ($)</label>
              <input
                type="number" min="0" step="0.01" value={form.current}
                onChange={(e) => set("current", e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Monthly contribution & Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Monthly Contribution ($)</label>
              <input
                type="number" min="0" step="0.01" value={form.monthlyContribution}
                onChange={(e) => set("monthlyContribution", e.target.value)}
                placeholder="500"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Target Date</label>
              <input
                type="date" value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {initial?.id ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Contribute Modal ───────────────────────────────────────────────────────────

interface ContributeModalProps {
  goal:    Goal;
  onSave:  (amount: number) => Promise<void>;
  onClose: () => void;
}

function ContributeModal({ goal, onSave, onClose }: ContributeModalProps) {
  const [amount,  setAmount]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const remaining = Math.max(0, goal.target - goal.current);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return setError("Enter a valid amount");
    setSaving(true);
    setError("");
    try {
      await onSave(n);
      onClose();
    } catch {
      setError("Failed to contribute. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Add Contribution</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>

        {/* Goal info */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4">
          <span className="text-2xl">{goal.icon}</span>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{goal.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(goal.current)} saved · {fmt(remaining)} remaining</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Amount ($)</label>
            <input
              type="number" min="0.01" step="0.01" value={amount} autoFocus
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`e.g. ${Math.min(500, remaining).toFixed(0)}`}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[100, 250, 500].filter((v) => v <= remaining + 1).map((v) => (
              <button
                key={v} type="button"
                onClick={() => setAmount(String(v))}
                className="flex-1 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 rounded-lg py-1.5 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
              >
                +${v}
              </button>
            ))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setAmount(remaining.toFixed(2))}
                className="flex-1 border border-green-200 dark:border-green-800/40 text-green-600 dark:text-emerald-400 rounded-lg py-1.5 text-xs hover:bg-green-50 dark:hover:bg-emerald-900/20 transition"
              >
                Finish!
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Contribution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Goal smart calculations ────────────────────────────────────────────────────

function projectedCompletion(goal: Goal): { date: string; months: number } | null {
  const remaining = Math.max(0, goal.target - goal.current);
  if (remaining === 0) return null;
  const monthly = goal.monthlyContribution;
  if (!monthly || monthly <= 0) return null;
  const months = Math.ceil(remaining / monthly);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    months,
  };
}

function requiredMonthly(goal: Goal): number | null {
  if (!goal.deadline) return null;
  const remaining = Math.max(0, goal.target - goal.current);
  if (remaining === 0) return null;
  const days = daysUntil(goal.deadline);
  if (days <= 0) return null;
  const months = Math.max(1, days / 30);
  return Math.ceil(remaining / months);
}

type TrackStatus = "achieved" | "on-track" | "behind" | "at-risk" | "no-deadline";

function getTrackStatus(goal: Goal): TrackStatus {
  const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
  if (progress >= 100) return "achieved";
  if (!goal.deadline) return "no-deadline";

  const proj = projectedCompletion(goal);
  if (!proj) return "no-deadline";

  const deadlineDays = daysUntil(goal.deadline);
  const projDays = proj.months * 30;

  if (deadlineDays < 0) return "at-risk";
  if (projDays <= deadlineDays) return "on-track";
  if (projDays <= deadlineDays * 1.2) return "behind";
  return "at-risk";
}

const TRACK_CONFIG = {
  "achieved":    { label: "🎉 Achieved",  cls: "bg-green-100 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400"  },
  "on-track":    { label: "✅ On Track",  cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" },
  "behind":      { label: "⚠️ Behind",   cls: "bg-yellow-100 dark:bg-amber-900/20 text-yellow-700 dark:text-amber-400" },
  "at-risk":     { label: "🔴 At Risk",  cls: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"      },
  "no-deadline": { label: "",            cls: ""                              },
};

// ── Goal Card ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal:        Goal;
  onEdit:      (goal: Goal) => void;
  onDelete:    (id: string) => void;
  onContribute:(goal: Goal) => void;
}

function GoalCard({ goal, onEdit, onDelete, onContribute }: GoalCardProps) {
  // Contribution history from localStorage
  const [contribHistory, setContribHistory] = useState<ContribEntry[]>([]);
  useEffect(() => {
    setContribHistory(getContributionHistory(goal.id));
  }, [goal.id, goal.current]); // refresh whenever current amount changes

  // Group by month for mini chart
  const contribByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    contribHistory.forEach(({ date, amount }) => {
      const mo = date.slice(0, 7);
      map[mo] = (map[mo] || 0) + amount;
    });
    const months = Object.keys(map).sort().slice(-6);
    const maxVal = Math.max(1, ...months.map(m => map[m]));
    return { months, map, maxVal };
  }, [contribHistory]);

  const progress  = Math.min(100, goal.progress ?? (goal.target > 0 ? (goal.current / goal.target) * 100 : 0));
  const achieved  = goal.achieved || progress >= 100;
  const remaining = Math.max(0, goal.target - goal.current);
  const status    = getTrackStatus(goal);
  const trackCfg  = TRACK_CONFIG[status];
  const proj      = projectedCompletion(goal);
  const reqMo     = requiredMonthly(goal);

  // Milestone markers: 25, 50, 75
  const milestones = [25, 50, 75].filter(m => progress >= m);

  let deadlineLabel = "";
  let deadlineColor = "text-gray-500";
  if (goal.deadline) {
    const days = daysUntil(goal.deadline);
    if (days < 0)       { deadlineLabel = "Overdue";        deadlineColor = "text-red-500"; }
    else if (days === 0){ deadlineLabel = "Due today";       deadlineColor = "text-orange-500"; }
    else if (days <= 30){ deadlineLabel = `${days}d left`;   deadlineColor = "text-orange-500"; }
    else if (days <= 90){ deadlineLabel = `${days}d left`;   deadlineColor = "text-yellow-600"; }
    else                { deadlineLabel = new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-5 ${achieved ? "border-green-200 dark:border-green-800/40 bg-green-50/30 dark:bg-emerald-900/10" : "border-gray-100 dark:border-gray-700"}`}>
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm"
            style={{ backgroundColor: `${goal.color}20`, border: `2px solid ${goal.color}40` }}
          >
            {goal.icon || "🎯"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{goal.name}</h3>
              {trackCfg.label && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trackCfg.cls}`}>
                  {trackCfg.label}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{goal.category}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(goal)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar with milestones */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{fmt(goal.current)} saved</span>
          <span className="font-bold" style={{ color: goal.color }}>{Math.round(progress)}%</span>
        </div>
        <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundColor: goal.color }}
          />
          {/* Milestone tick marks */}
          {[25, 50, 75].map(m => (
            <div
              key={m}
              className="absolute top-0 h-full w-px bg-white/60"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
        {/* Milestone badges */}
        {milestones.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {milestones.map(m => (
              <span key={m} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                {m}% ✓
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>Target: {fmt(goal.target)}</span>
          {!achieved && <span>{fmt(remaining)} to go</span>}
          {achieved  && <span className="text-green-600 font-medium">🎉 Goal reached!</span>}
        </div>
      </div>

      {/* Smart projection row */}
      {!achieved && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 mb-3 space-y-1">
          {proj && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">📅 Projected completion</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">{proj.date}</span>
            </div>
          )}
          {reqMo && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">💡 Needed to meet deadline</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{fmt(reqMo)}/mo</span>
            </div>
          )}
          {goal.monthlyContribution && goal.monthlyContribution > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">📈 Current contribution</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(goal.monthlyContribution)}/mo</span>
            </div>
          )}
        </div>
      )}

      {/* Contribution history mini chart */}
      {contribByMonth.months.length >= 2 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Contribution history
          </p>
          <div className="flex items-end gap-1 h-10">
            {contribByMonth.months.map(mo => {
              const h = Math.max(4, Math.round((contribByMonth.map[mo] / contribByMonth.maxVal) * 36));
              return (
                <div key={mo} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{ height: h, backgroundColor: `${goal.color}99` }}
                  />
                  {/* tooltip */}
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] bg-gray-800 text-white rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                    {mo.slice(5)}/{mo.slice(0,4).slice(2)}: {fmt(contribByMonth.map[mo])}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-600 mt-0.5">
            <span>{contribByMonth.months[0]?.slice(5)}/{contribByMonth.months[0]?.slice(2,4)}</span>
            <span>{contribByMonth.months[contribByMonth.months.length - 1]?.slice(5)}/{contribByMonth.months[contribByMonth.months.length - 1]?.slice(2,4)}</span>
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {goal.deadline && (
            <div className={`flex items-center gap-1 text-xs ${deadlineColor}`}>
              <CalendarDays className="w-3 h-3" />
              <span>{deadlineLabel}</span>
            </div>
          )}
        </div>

        {!achieved && (
          <button
            onClick={() => onContribute(goal)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            style={{ backgroundColor: `${goal.color}15`, color: goal.color }}
          >
            <Plus className="w-3 h-3" />
            Contribute
          </button>
        )}
      </div>
    </div>
  );
}

// ── 50/30/20 Wizard ───────────────────────────────────────────────────────────

const WIZARD_NEEDS    = ["Housing / Rent", "Groceries", "Transportation", "Utilities", "Insurance", "Healthcare"];
const WIZARD_WANTS    = ["Dining Out", "Entertainment", "Shopping", "Travel", "Subscriptions", "Personal Care"];
const WIZARD_SAVINGS  = ["Emergency Fund", "Retirement / 401k", "Investments", "Other Savings"];

// Suggested weight distribution within each bucket
const NEEDS_WEIGHTS   = [0.35, 0.20, 0.15, 0.12, 0.10, 0.08];
const WANTS_WEIGHTS   = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
const SAVINGS_WEIGHTS = [0.40, 0.35, 0.20, 0.05];

function WizardModal5030({ onApply, onClose }: { onApply: (b: AppliedBudget[]) => Promise<void>; onClose: () => void }) {
  const [income, setIncome]           = useState("");
  const [alloc,  setAlloc]            = useState<Record<string, number>>({});
  const [saving, setSaving]           = useState(false);

  const monthly = parseFloat(income) || 0;
  const needs50  = monthly * 0.5;
  const wants30  = monthly * 0.3;
  const save20   = monthly * 0.2;

  // Auto-distribute when income changes
  useEffect(() => {
    if (monthly <= 0) { setAlloc({}); return; }
    const next: Record<string, number> = {};
    WIZARD_NEEDS.forEach((c, i)   => { next[c] = Math.round((needs50 * NEEDS_WEIGHTS[i])   / 5) * 5; });
    WIZARD_WANTS.forEach((c, i)   => { next[c] = Math.round((wants30 * WANTS_WEIGHTS[i])   / 5) * 5; });
    WIZARD_SAVINGS.forEach((c, i) => { next[c] = Math.round((save20  * SAVINGS_WEIGHTS[i]) / 5) * 5; });
    setAlloc(next);
  }, [monthly, needs50, wants30, save20]);

  const handleApply = async () => {
    setSaving(true);
    try {
      const budgets: AppliedBudget[] = Object.entries(alloc)
        .filter(([, amt]) => amt > 0)
        .map(([category, budget]) => ({
          category,
          budget,
          icon:  category.includes("Fund") || category.includes("Saving") || category.includes("Invest") || category.includes("401") ? "💰" :
                 category.includes("Hous") || category.includes("Rent") ? "🏠" :
                 category.includes("Groc") ? "🛒" :
                 category.includes("Trans") ? "🚗" :
                 category.includes("Util") ? "💡" :
                 category.includes("Health") || category.includes("Insur") ? "🏥" :
                 category.includes("Dining") ? "🍽️" :
                 category.includes("Entertain") ? "🎬" :
                 category.includes("Shop") ? "🛍️" :
                 category.includes("Travel") ? "✈️" :
                 category.includes("Sub") ? "📱" : "💳",
          color: category.includes("Fund") || category.includes("Saving") || category.includes("Invest") || category.includes("401") ? "#10b981" :
                 category.includes("Hous") || category.includes("Rent") || category.includes("Util") ? "#3b82f6" :
                 category.includes("Health") || category.includes("Insur") ? "#ef4444" :
                 category.includes("Shop") || category.includes("Entertain") || category.includes("Travel") ? "#f59e0b" :
                 "#6366f1",
        }));
      await onApply(budgets);
    } finally {
      setSaving(false);
    }
    onClose();
  };

  const buckets = [
    { title: "🏠 Needs",   pct: 50, amount: needs50, cats: WIZARD_NEEDS,   tagCls: "bg-blue-50   dark:bg-blue-900/20   border-blue-100   dark:border-blue-800/30",   textCls: "text-blue-700   dark:text-blue-300"   },
    { title: "🎉 Wants",   pct: 30, amount: wants30, cats: WIZARD_WANTS,   tagCls: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30", textCls: "text-purple-700 dark:text-purple-300" },
    { title: "💰 Savings", pct: 20, amount: save20,  cats: WIZARD_SAVINGS, tagCls: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30", textCls: "text-emerald-700 dark:text-emerald-300" },
  ];

  const totalApply = Object.values(alloc).filter(v => v > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">50 / 30 / 20 Budget Wizard</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">50% Needs · 30% Wants · 20% Savings</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Income input */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Monthly Take-Home Income</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
              <input
                type="number" min="0" value={income}
                onChange={e => setIncome(e.target.value)}
                placeholder="5 000"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              />
            </div>
          </div>

          {monthly > 0 && (
            <>
              {/* Bucket summary */}
              <div className="grid grid-cols-3 gap-3">
                {buckets.map(b => (
                  <div key={b.title} className={`${b.tagCls} border rounded-xl p-3 text-center`}>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{b.title.split(" ").slice(1).join(" ")}</p>
                    <p className={`text-xl font-black ${b.textCls}`}>{b.pct}%</p>
                    <p className={`text-xs font-semibold ${b.textCls}`}>{fmt(b.amount)}/mo</p>
                  </div>
                ))}
              </div>

              {/* Category allocations per bucket */}
              {buckets.map(({ title, amount: bucketAmt, cats, textCls }) => {
                const allocated = cats.reduce((s, c) => s + (alloc[c] || 0), 0);
                return (
                  <div key={title}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-sm font-bold ${textCls}`}>{title}</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(allocated)} / {fmt(bucketAmt)}</span>
                    </div>
                    <div className="space-y-2">
                      {cats.map(cat => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-36 shrink-0 truncate">{cat}</span>
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <input
                              type="number" min="0" step="5"
                              value={alloc[cat] ?? ""}
                              onChange={e => setAlloc(p => ({ ...p, [cat]: parseFloat(e.target.value) || 0 }))}
                              className="w-full pl-6 pr-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-gray-700 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!monthly || totalApply === 0 || saving}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply {totalApply} Budget{totalApply !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goals Section ──────────────────────────────────────────────────────────────

function GoalsSection() {
  const [goals,        setGoals]        = useState<Goal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editGoal,     setEditGoal]     = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [error,        setError]        = useState("");

  const fetchGoals = useCallback(async () => {
    try {
      const data = await apiRequest<Goal[]>("/api/goals", { method: "GET" });
      setGoals(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchGoals(); }, [fetchGoals]);

  const handleCreate = async (data: Partial<Goal>) => {
    await apiRequest<Goal>("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await fetchGoals();
  };

  const handleUpdate = async (data: Partial<Goal>) => {
    if (!editGoal) return;
    await apiRequest<Goal>(`/api/goals/${editGoal.id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    await fetchGoals();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this goal? This cannot be undone.")) return;
    await apiRequest(`/api/goals/${id}`, { method: "DELETE" });
    setGoals((g) => g.filter((x) => x.id !== id));
  };

  const handleContribute = async (amount: number) => {
    if (!contributeGoal) return;
    await apiRequest<Goal>(`/api/goals/${contributeGoal.id}/contribute`, {
      method: "PATCH",
      body: JSON.stringify({ amount }),
    });
    logContribution(contributeGoal.id, amount); // persist to localStorage for history chart
    await fetchGoals();
  };

  // Summary stats
  const totalGoals    = goals.length;
  const achievedGoals = goals.filter((g) => g.achieved || (g.target > 0 && g.current >= g.target)).length;
  const totalTarget   = goals.reduce((s, g) => s + (g.target  || 0), 0);
  const totalSaved    = goals.reduce((s, g) => s + (g.current || 0), 0);
  const overallPct    = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      {totalGoals > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Goals",    value: totalGoals,    suffix: "",    icon: "🎯", color: "#6366f1" },
            { label: "Achieved",       value: achievedGoals, suffix: "",    icon: "✅", color: "#10b981" },
            { label: "Total Target",   value: fmt(totalTarget), suffix: "", icon: "📊", color: "#f59e0b", raw: true },
            { label: "Total Saved",    value: fmt(totalSaved),  suffix: ` (${overallPct}%)`, icon: "💰", color: "#3b82f6", raw: true },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-200">
                {s.raw ? s.value : s.value}{s.suffix}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {totalGoals > 0 ? `${totalGoals} Savings Goal${totalGoals !== 1 ? "s" : ""}` : "Savings Goals"}
        </h2>
        <button
          onClick={() => { setEditGoal(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}

      {/* Empty state */}
      {totalGoals === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
            <Target className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No savings goals yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs">
            Set a goal for your dream vacation, emergency fund, new car, or anything you're saving toward.
          </p>
          <button
            onClick={() => { setEditGoal(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Create Your First Goal
          </button>
        </div>
      )}

      {/* Goal cards grid */}
      {totalGoals > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
              onDelete={handleDelete}
              onContribute={(g) => setContributeGoal(g)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <GoalForm
          initial={editGoal ?? undefined}
          onSave={editGoal ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditGoal(null); }}
        />
      )}
      {contributeGoal && (
        <ContributeModal
          goal={contributeGoal}
          onSave={handleContribute}
          onClose={() => setContributeGoal(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GoalsBudgetsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tabParam     = searchParams?.get("tab");
  const { toast }    = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);
  const [isFetching,      setIsFetching]      = useState(false);
  const [budgets,         setBudgets]         = useState<Budget[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showWizard5030,  setShowWizard5030]  = useState(false);
  const [rolloverCredits, setRolloverCredits] = useState<Record<string, number>>({});
  const [activeTab,       setActiveTab]       = useState<Tab>(
    tabParam === "budgets" ? "budgets" : "goals"
  );

  // Auth check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = getUser();
      if (!user?.id) {
        router.replace("/login");
      } else {
        setIsAuthenticated(true);
      }
    }
  }, [router]);

  // Sync tab from URL
  useEffect(() => {
    if (tabParam === "budgets" || tabParam === "goals") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Rollover: detect when a new month starts and surface last month's surplus/deficit
  useEffect(() => {
    const currentMonth = getLocalYearMonth();
    const stored = loadRolloverStore();
    if (stored && stored.month !== currentMonth) {
      // We have data from a previous month → these become rollover credits
      setRolloverCredits(stored.data);
    }
  }, []);

  // Persist current month's budget/spent data so next month can compute rollover
  useEffect(() => {
    if (budgets.length === 0) return;
    const currentMonth = getLocalYearMonth();
    const data: Record<string, number> = {};
    budgets.forEach(b => {
      const surplus = Math.round((b.budget - (b.spent || 0)) * 100) / 100;
      data[b.category] = surplus;
    });
    saveRolloverStore({ month: currentMonth, data });
  }, [budgets]);

  const fetchBudgets = useCallback(async (options: { silent?: boolean } = {}): Promise<void> => {
    if (!options.silent) setIsLoading(true);
    else setIsFetching(true);

    try {
      const [rawBudgets, transactions] = await Promise.all([
        apiRequest<any[]>("/api/budgets", { method: "GET" }),
        apiRequest<any[]>("/api/transactions", { method: "GET" }).catch(() => [] as any[]),
      ]);

      // Store all transactions so the AI suggestion modal can analyse them
      setAllTransactions(Array.isArray(transactions) ? transactions : []);

      const allExpenses  = Array.isArray(transactions)
        ? transactions.filter((t: any) => t.type === "expense" || t.type === "EXPENSE")
        : [];
      const activeMonth  = getLocalYearMonth();
      const validBudgets = rawBudgets.filter(
        (b: any) => b.category && typeof b.category === "string" && b.category.trim().length > 0
          && Number(b.budget ?? b.limit ?? b.amount ?? 0) > 0
      );
      const normalized = validBudgets.map((b: any) => {
        const budgetAmount = Number(b.budget ?? b.limit ?? b.amount ?? 0);
        const spent = allExpenses
          .filter((t: any) => (t.date ?? "").slice(0, 7) === activeMonth && categoryMatches(b.category, t.category ?? ""))
          .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount ?? 0)), 0);
        return { id: String(b.id), category: b.category, budget: budgetAmount, spent: Math.round(spent * 100) / 100, icon: b.icon || "💰", color: b.color || "#3b82f6" } as Budget;
      });
      setBudgets(normalized);
    } catch {
      setBudgets([]);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void fetchBudgets();
  }, [isAuthenticated, fetchBudgets]);

  const handleAddBudget = async (budgetData: Omit<Budget, "id" | "spent">) => {
    await apiRequest("/api/budgets", {
      method: "POST",
      body: JSON.stringify({ category: budgetData.category, budget: budgetData.budget, icon: budgetData.icon || "💰", color: budgetData.color || "#3b82f6", spent: 0, month: getLocalYearMonth() }),
    });
    await fetchBudgets({ silent: true });
  };

  const handleUpdateBudget = async (id: Budget["id"], updates: Partial<Budget>) => {
    const existing = budgets.find((b) => b.id === id);
    await apiRequest(`/api/budgets/${id}`, {
      method: "PUT",
      body: JSON.stringify({ category: updates.category ?? existing?.category, budget: updates.budget ?? existing?.budget, icon: updates.icon ?? existing?.icon ?? "💰", color: updates.color ?? existing?.color ?? "#3b82f6" }),
    });
    await fetchBudgets({ silent: true });
  };

  const handleDeleteBudget = async (id: Budget["id"]) => {
    await apiRequest(`/api/budgets/${id}`, { method: "DELETE" });
    await fetchBudgets({ silent: true });
  };

  // Apply AI-suggested budgets — create each one sequentially
  const handleApplySuggestions = async (suggestions: AppliedBudget[]) => {
    for (const s of suggestions) {
      await apiRequest("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          category: s.category,
          budget:   s.budget,
          icon:     s.icon,
          color:    s.color,
          spent:    0,
          month:    getLocalYearMonth(),
        }),
      });
    }
    await fetchBudgets({ silent: true });
  };

  if (isLoading && activeTab === "budgets") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "goals",   label: "Savings Goals", icon: "🎯" },
    { id: "budgets", label: "Budgets",        icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {isFetching && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary-100 overflow-hidden">
          <div className="h-full bg-primary-500 animate-pulse w-full" />
        </div>
      )}

      <PageContent>
        <PageHeader
          title="Goals & Budgets"
          description="Track your savings goals and monthly spending limits"
          actions={
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </Button>
              ))}
            </div>
          }
        />

        <Section>
          {/* Tab content */}
          {activeTab === "goals" && <GoalsSection />}

          {activeTab === "budgets" && (
            <>
              {/* ── Action buttons row ── */}
              <div className="flex flex-wrap gap-2 justify-end mb-4">
                <button
                  onClick={() => setShowWizard5030(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                >
                  <Wand2 className="w-4 h-4" />
                  50/30/20 Wizard
                </button>
                <button
                  onClick={() => setShowSuggestions(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Suggest Budgets with AI
                </button>
              </div>

              {/* ── Rollover credits from last month ── */}
              {Object.keys(rolloverCredits).length > 0 && (
                <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔄</span>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Budget Rollover from Last Month</h3>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500">Unspent amounts you can carry forward · overspend shown in red</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRolloverCredits({})}
                      className="text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition"
                      title="Dismiss rollover panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(rolloverCredits)
                      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                      .map(([cat, amount]) => (
                        <div
                          key={cat}
                          className={`rounded-xl px-3 py-2 text-xs border ${
                            amount >= 0
                              ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/30"
                              : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
                          }`}
                        >
                          <p className="text-gray-600 dark:text-gray-400 truncate">{cat}</p>
                          <p className={`font-bold ${amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {amount >= 0 ? "+" : ""}{fmt(amount)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <BudgetManager
                budgets={budgets}
                onAddBudget={handleAddBudget}
                onUpdateBudget={handleUpdateBudget}
                onDeleteBudget={handleDeleteBudget}
              />
            </>
          )}
        </Section>

        {/* ── AI Budget Suggestions Modal ── */}
        {showSuggestions && (
          <SmartBudgetSuggestionsModal
            transactions={allTransactions}
            existingCategories={budgets.map((b) => b.category)}
            onApply={handleApplySuggestions}
            onClose={() => setShowSuggestions(false)}
          />
        )}

        {/* ── 50/30/20 Wizard Modal ── */}
        {showWizard5030 && (
          <WizardModal5030
            onApply={handleApplySuggestions}
            onClose={() => setShowWizard5030(false)}
          />
        )}
      </PageContent>
    </div>
  );
}
