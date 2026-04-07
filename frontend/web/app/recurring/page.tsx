"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, AlertCircle, Sparkles, X, CheckCircle,
  Trash2, Plus, Calendar, TrendingDown, TrendingUp, Clock,
} from "lucide-react";
import { transactionsAPI, type Transaction as ApiTransaction } from "@/lib/api";
import { RecurringTransactionsDashboard } from "@/components/RecurringTransactionsDashboard";

// ── API helpers ────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const getToken  = () => typeof window !== "undefined"
  ? (localStorage.getItem("ft_token") || localStorage.getItem("authToken")) : null;
const getUserId = () => typeof window !== "undefined"
  ? localStorage.getItem("userId") : null;

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token  = getToken();
  const userId = getUserId();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token  && { Authorization: `Bearer ${token}` }),
      ...(userId && { "X-User-Id": userId }),
      ...options.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/register?mode=signin";
    }
    throw new Error(`HTTP ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SavedRule {
  id:             number;
  description:    string;
  amount:         number;
  merchant?:      string;
  category?:      string;
  type:           "INCOME" | "EXPENSE";
  frequency:      "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  startDate:      string;
  endDate?:       string;
  nextOccurrence: string;
  active:         boolean;
}

interface CreateRulePayload {
  description:  string;
  amount:       number;
  merchant?:    string;
  category?:    string;
  type:         string;
  frequency:    string;
  startDate:    string;
  endDate?:     string;
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: "success" | "error" | "info" }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, show, dismiss };
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const colors: Record<Toast["type"], string> = { success: "bg-emerald-600", error: "bg-red-600", info: "bg-indigo-600" };
  const icons:  Record<Toast["type"], React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4" />,
    error:   <AlertCircle className="w-4 h-4" />,
    info:    <Sparkles className="w-4 h-4" />,
  };
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white pointer-events-auto ${colors[t.type]}`}>
          {icons[t.type]}
          <span>{t.msg}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Frequency helpers ──────────────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly",
};

const FREQ_COLORS: Record<string, string> = {
  DAILY: "bg-purple-100 text-purple-700",
  WEEKLY: "bg-blue-100 text-blue-700",
  MONTHLY: "bg-indigo-100 text-indigo-700",
  YEARLY: "bg-gray-100 text-gray-700",
};

/** Map frontend auto-detection frequencies → backend enum values */
function mapFrequency(freq: string): "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" {
  const f = freq.toLowerCase();
  if (f === "daily")                   return "DAILY";
  if (f === "weekly")                  return "WEEKLY";
  if (f === "biweekly")                return "WEEKLY";  // closest
  if (f === "monthly")                 return "MONTHLY";
  if (f === "quarterly")               return "MONTHLY"; // closest
  if (f === "yearly" || f === "annual") return "YEARLY";
  return "MONTHLY";
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(dateStr);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Add Rule Form ──────────────────────────────────────────────────────────────

interface AddRuleFormProps {
  onSave:  (rule: CreateRulePayload) => Promise<void>;
  onClose: () => void;
}

const CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Entertainment",
  "Bills & Utilities", "Healthcare", "Groceries", "Education",
  "Travel", "Personal Care", "Savings", "Income", "Other",
];

function AddRuleForm({ onSave, onClose }: AddRuleFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    description: "", amount: "", type: "EXPENSE", frequency: "MONTHLY",
    category: "Bills & Utilities", startDate: today, endDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return setError("Description is required");
    if (!form.amount || +form.amount <= 0) return setError("Amount must be positive");
    setSaving(true);
    setError("");
    try {
      await onSave({
        description: form.description.trim(),
        amount:      +form.amount,
        category:    form.category,
        type:        form.type,
        frequency:   form.frequency,
        startDate:   form.startDate,
        endDate:     form.endDate || undefined,
      });
      onClose();
    } catch {
      setError("Failed to save rule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Add Recurring Rule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Netflix, Rent, Gym membership"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
              <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Saved Rules Section ────────────────────────────────────────────────────────

interface SavedRulesSectionProps {
  rules:     SavedRule[];
  onDelete:  (id: number) => void;
  onAdd:     () => void;
}

function SavedRulesSection({ rules, onDelete, onAdd }: SavedRulesSectionProps) {
  if (rules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-800">Saved Rules</h2>
          <button onClick={onAdd}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>
        <p className="text-sm text-gray-400">
          No rules saved yet. Save an auto-detected pattern below or add one manually.
        </p>
      </div>
    );
  }

  const monthlyTotal = rules
    .filter((r) => r.type === "EXPENSE" && r.active)
    .reduce((sum, r) => {
      if (r.frequency === "MONTHLY") return sum + r.amount;
      if (r.frequency === "WEEKLY")  return sum + r.amount * 4.33;
      if (r.frequency === "YEARLY")  return sum + r.amount / 12;
      if (r.frequency === "DAILY")   return sum + r.amount * 30;
      return sum;
    }, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800">Saved Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} · ~{fmt(monthlyTotal)}/month in recurring expenses
          </p>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition">
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const days      = daysUntil(rule.nextOccurrence);
          let urgency     = "";
          let urgencyClr  = "text-gray-400";
          if (days < 0)       { urgency = "Overdue";    urgencyClr = "text-red-500"; }
          else if (days === 0){ urgency = "Due today";  urgencyClr = "text-orange-500"; }
          else if (days <= 3) { urgency = `In ${days}d`; urgencyClr = "text-orange-500"; }
          else if (days <= 7) { urgency = `In ${days}d`; urgencyClr = "text-yellow-600"; }
          else                { urgency = `In ${days}d`; }

          return (
            <div key={rule.id} className={`flex items-center gap-4 p-3 rounded-xl border ${rule.active ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-50"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.type === "EXPENSE" ? "bg-red-100" : "bg-green-100"}`}>
                {rule.type === "EXPENSE"
                  ? <TrendingDown className="w-4 h-4 text-red-500" />
                  : <TrendingUp   className="w-4 h-4 text-green-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800 truncate">{rule.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FREQ_COLORS[rule.frequency] ?? "bg-gray-100 text-gray-600"}`}>
                    {FREQ_LABELS[rule.frequency]}
                  </span>
                  {rule.category && (
                    <span className="text-xs text-gray-400">{rule.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className={`text-sm font-bold ${rule.type === "EXPENSE" ? "text-red-600" : "text-green-600"}`}>
                    {rule.type === "EXPENSE" ? "-" : "+"}{fmt(rule.amount)}
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${urgencyClr}`}>
                    <Clock className="w-3 h-3" />
                    {urgency || new Date(rule.nextOccurrence).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDelete(rule.id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transform transactions ─────────────────────────────────────────────────────

function transformTransaction(apiTxn: ApiTransaction) {
  return {
    id:          apiTxn.id || `txn-${Date.now()}-${Math.random()}`,
    date:        apiTxn.date,
    amount:      Math.abs(apiTxn.amount),
    category:    apiTxn.category,
    description: apiTxn.description,
    type:        apiTxn.type.toUpperCase() as "INCOME" | "EXPENSE",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const [isLoading,    setIsLoading]    = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [savedRules,   setSavedRules]   = useState<SavedRule[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const { toasts, show: showToast, dismiss } = useToast();

  // Load transactions from backend
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await transactionsAPI.getAll();
      if (!Array.isArray(data)) throw new Error("Invalid response format");
      setTransactions(data.map(transformTransaction));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load transactions");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load saved rules from backend
  const loadSavedRules = useCallback(async () => {
    try {
      const data = await apiRequest<{ content?: SavedRule[]; } | SavedRule[]>(
        "/api/recurring-transactions?page=0&size=50"
      );
      // Response is a Spring Page object with `content` array
      const rules = Array.isArray(data)
        ? data
        : (data as any).content ?? [];
      setSavedRules(rules);
    } catch {
      // Non-fatal — just show empty saved rules
      setSavedRules([]);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
    void loadSavedRules();
  }, [loadTransactions, loadSavedRules]);

  // Create rule — POST to backend
  const handleCreateRule = useCallback(async (rule: any) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const payload: CreateRulePayload = {
        description: rule.pattern ?? rule.description ?? "Recurring transaction",
        amount:      Math.abs(rule.amount ?? 0),
        category:    rule.category,
        type:        (rule.type ?? "EXPENSE").toUpperCase(),
        frequency:   mapFrequency(rule.frequency ?? "monthly"),
        startDate:   today,
      };
      await apiRequest<SavedRule>("/api/recurring-transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await loadSavedRules();
      showToast(`Rule saved for "${payload.description}"`);
    } catch {
      showToast("Failed to save rule", "error");
    }
  }, [loadSavedRules, showToast]);

  // Manual rule add
  const handleManualAdd = useCallback(async (payload: CreateRulePayload) => {
    await apiRequest<SavedRule>("/api/recurring-transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadSavedRules();
    showToast(`Rule saved for "${payload.description}"`);
  }, [loadSavedRules, showToast]);

  // Delete rule — DELETE from backend
  const handleDeleteSavedRule = useCallback(async (id: number) => {
    if (!confirm("Delete this recurring rule?")) return;
    try {
      await apiRequest(`/api/recurring-transactions/${id}`, { method: "DELETE" });
      setSavedRules((prev) => prev.filter((r) => r.id !== id));
      showToast("Rule deleted");
    } catch {
      showToast("Failed to delete rule", "error");
    }
  }, [showToast]);

  // Dismiss auto-detected pattern (no backend needed — just UI feedback)
  const handleDeleteRecurring = useCallback((_id: string) => {
    showToast("Pattern dismissed", "info");
  }, [showToast]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadTransactions(), loadSavedRules()]);
    showToast("Refreshed");
  }, [loadTransactions, loadSavedRules, showToast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">Loading recurring transactions…</p>
        </div>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't Load Transactions</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={loadTransactions}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {showAddForm && (
        <AddRuleForm onSave={handleManualAdd} onClose={() => setShowAddForm(false)} />
      )}

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-7">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Smart Detection</span>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Recurring Transactions</h1>
              <p className="text-gray-400 text-sm mt-1">
                {savedRules.length} saved rule{savedRules.length !== 1 ? "s" : ""} · auto-detected from {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-slate-50 hover:shadow-md transition-all self-start flex-shrink-0">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          )}

          {/* Saved Rules (backend-persisted) */}
          <SavedRulesSection
            rules={savedRules}
            onDelete={handleDeleteSavedRule}
            onAdd={() => setShowAddForm(true)}
          />

          {/* Auto-detected patterns */}
          {transactions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">No Transactions Available</h3>
              <p className="text-sm text-gray-400">Add transactions to detect recurring patterns.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-gray-800">Auto-Detected Patterns</h2>
                <span className="text-xs text-gray-400">— click "Save Rule" to persist any pattern</span>
              </div>
              <RecurringTransactionsDashboard
                transactions={transactions}
                onCreateRule={handleCreateRule}
                onDeleteRecurring={handleDeleteRecurring}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
