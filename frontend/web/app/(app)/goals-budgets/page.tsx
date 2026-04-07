"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, Plus, Trash2, Pencil, Target, TrendingUp,
  CheckCircle2, Circle, CalendarDays, X, ChevronRight,
} from "lucide-react";
import { BudgetManager, type Budget } from "@/components/budgets/BudgetManager";

// ── API helpers ────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ft_token") || localStorage.getItem("authToken");
};

const getUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("userId");
};

const apiRequest = async <T,>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token  = getToken();
  const userId = getUserId();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token  && { Authorization: `Bearer ${token}` }),
      ...(userId && { "X-User-Id": userId }),
      ...options.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("ft_token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("userId");
      window.location.href = "/register?mode=signin";
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
};

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
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {initial?.id ? "Edit Goal" : "Create New Goal"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          {/* Icon & Color row */}
          <div className="flex gap-4">
            {/* Icon picker */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
              <div className="grid grid-cols-8 gap-1">
                {GOAL_ICONS.map((ic) => (
                  <button
                    key={ic} type="button"
                    onClick={() => set("icon", ic)}
                    className={`text-xl p-1 rounded-lg border-2 transition-all ${
                      form.icon === ic ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Goal Name *</label>
            <input
              type="text" value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Emergency Fund, Dream Vacation…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Target & Current amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Amount ($) *</label>
              <input
                type="number" min="1" step="0.01" value={form.target}
                onChange={(e) => set("target", e.target.value)}
                placeholder="10000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Already Saved ($)</label>
              <input
                type="number" min="0" step="0.01" value={form.current}
                onChange={(e) => set("current", e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Monthly contribution & Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Contribution ($)</label>
              <input
                type="number" min="0" step="0.01" value={form.monthlyContribution}
                onChange={(e) => set("monthlyContribution", e.target.value)}
                placeholder="500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Date</label>
              <input
                type="date" value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
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
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Add Contribution</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Goal info */}
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-4">
          <span className="text-2xl">{goal.icon}</span>
          <div>
            <p className="font-medium text-gray-800 text-sm">{goal.name}</p>
            <p className="text-xs text-gray-500">{fmt(goal.current)} saved · {fmt(remaining)} remaining</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
            <input
              type="number" min="0.01" step="0.01" value={amount} autoFocus
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`e.g. ${Math.min(500, remaining).toFixed(0)}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[100, 250, 500].filter((v) => v <= remaining + 1).map((v) => (
              <button
                key={v} type="button"
                onClick={() => setAmount(String(v))}
                className="flex-1 border border-indigo-200 text-indigo-600 rounded-lg py-1.5 text-xs hover:bg-indigo-50 transition"
              >
                +${v}
              </button>
            ))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setAmount(remaining.toFixed(2))}
                className="flex-1 border border-green-200 text-green-600 rounded-lg py-1.5 text-xs hover:bg-green-50 transition"
              >
                Finish!
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
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

// ── Goal Card ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal:        Goal;
  onEdit:      (goal: Goal) => void;
  onDelete:    (id: string) => void;
  onContribute:(goal: Goal) => void;
}

function GoalCard({ goal, onEdit, onDelete, onContribute }: GoalCardProps) {
  const progress  = Math.min(100, goal.progress ?? (goal.target > 0 ? (goal.current / goal.target) * 100 : 0));
  const achieved  = goal.achieved || progress >= 100;
  const remaining = Math.max(0, goal.target - goal.current);

  let deadlineLabel = "";
  let deadlineColor = "text-gray-500";
  if (goal.deadline) {
    const days = daysUntil(goal.deadline);
    if (days < 0)       { deadlineLabel = "Overdue"; deadlineColor = "text-red-500"; }
    else if (days === 0){ deadlineLabel = "Due today"; deadlineColor = "text-orange-500"; }
    else if (days <= 30){ deadlineLabel = `${days}d left`; deadlineColor = "text-orange-500"; }
    else if (days <= 90){ deadlineLabel = `${days}d left`; deadlineColor = "text-yellow-600"; }
    else                { deadlineLabel = new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-5 ${achieved ? "border-green-200 bg-green-50/30" : "border-gray-100"}`}>
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
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800 text-sm">{goal.name}</h3>
              {achieved && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>
            <p className="text-xs text-gray-400">{goal.category}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{fmt(goal.current)} saved</span>
          <span className="font-medium" style={{ color: goal.color }}>{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: goal.color }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Target: {fmt(goal.target)}</span>
          {!achieved && <span>{fmt(remaining)} to go</span>}
          {achieved  && <span className="text-green-600 font-medium">🎉 Achieved!</span>}
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {goal.deadline && (
            <div className={`flex items-center gap-1 text-xs ${deadlineColor}`}>
              <CalendarDays className="w-3 h-3" />
              <span>{deadlineLabel}</span>
            </div>
          )}
          {goal.monthlyContribution && goal.monthlyContribution > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUp className="w-3 h-3" />
              <span>{fmt(goal.monthlyContribution)}/mo</span>
            </div>
          )}
        </div>

        {!achieved && (
          <button
            onClick={() => onContribute(goal)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition"
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
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.icon}</span>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
              <p className="text-xl font-bold text-gray-800">
                {s.raw ? s.value : s.value}{s.suffix}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
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
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}

      {/* Empty state */}
      {totalGoals === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Target className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No savings goals yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs">
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

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);
  const [isFetching,      setIsFetching]      = useState(false);
  const [budgets,         setBudgets]         = useState<Budget[]>([]);
  const [activeTab,       setActiveTab]       = useState<Tab>(
    tabParam === "budgets" ? "budgets" : "goals"
  );

  // Auth check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token  = getToken();
      const userId = getUserId();
      if (!token || !userId) {
        router.replace("/register?mode=signin");
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

  const fetchBudgets = useCallback(async (options: { silent?: boolean } = {}): Promise<void> => {
    if (!options.silent) setIsLoading(true);
    else setIsFetching(true);

    try {
      const [rawBudgets, transactions] = await Promise.all([
        apiRequest<any[]>("/api/budgets", { method: "GET" }),
        apiRequest<any[]>("/api/transactions", { method: "GET" }).catch(() => [] as any[]),
      ]);

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

  if (isLoading && activeTab === "budgets") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "goals",   label: "Savings Goals", icon: "🎯" },
    { id: "budgets", label: "Budgets",        icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {isFetching && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-indigo-100 overflow-hidden">
          <div className="h-full bg-indigo-500 animate-pulse w-full" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Goals & Budgets</h1>
          <p className="text-sm text-gray-500 mt-1">Track your savings goals and monthly spending limits</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-8 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "goals" && <GoalsSection />}

        {activeTab === "budgets" && (
          <BudgetManager
            budgets={budgets}
            onAddBudget={handleAddBudget}
            onUpdateBudget={handleUpdateBudget}
            onDeleteBudget={handleDeleteBudget}
          />
        )}
      </div>
    </div>
  );
}
