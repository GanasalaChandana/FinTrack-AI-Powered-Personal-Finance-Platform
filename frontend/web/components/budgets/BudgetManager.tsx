"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Plus, X, Edit2, Trash2, AlertTriangle, TrendingUp,
  Wallet, PiggyBank, Loader2, Sparkles, Calendar, Shield,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export interface Budget {
  id: string;
  category: string;
  budget: number;
  spent: number;
  icon: string;
  color: string;
}

interface BudgetManagerProps {
  budgets: Budget[];
  onAddBudget: (budget: Omit<Budget, "id" | "spent">) => Promise<void>;
  onUpdateBudget: (id: Budget["id"], budget: Partial<Budget>) => Promise<void>;
  onDeleteBudget: (id: Budget["id"]) => Promise<void>;
}

type Mode = "add" | "edit";

interface FormState {
  category: string;
  budget: string;
  icon: string;
  color: string;
}

const PRESET_CATEGORIES = [
  { name: "Food & Dining",     icon: "🍔", color: "#f97316" },
  { name: "Transportation",    icon: "🚗", color: "#8b5cf6" },
  { name: "Shopping",          icon: "🛍️", color: "#ec4899" },
  { name: "Entertainment",     icon: "🎮", color: "#06b6d4" },
  { name: "Bills & Utilities", icon: "💡", color: "#10b981" },
  { name: "Healthcare",        icon: "⚕️", color: "#ef4444" },
  { name: "Groceries",         icon: "🛒", color: "#3b82f6" },
  { name: "Education",         icon: "📚", color: "#6366f1" },
  { name: "Travel",            icon: "✈️", color: "#f59e0b" },
  { name: "Personal Care",     icon: "💆", color: "#a855f7" },
  { name: "Savings",           icon: "🏦", color: "#14b8a6" },
  { name: "Other",             icon: "📦", color: "#6b7280" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2,
});
const fmt = (v: number) => currencyFormatter.format(v);

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDaysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// ── Smart tip per card ────────────────────────────────────────────────────────

function getCardTip(
  budget: Budget,
  daysLeft: number,
  daysInMonth: number
): { text: string; color: string; emoji: string } {
  const { spent, budget: limit } = budget;
  const pct = limit === 0 ? 0 : (spent / limit) * 100;
  const daysPassed = daysInMonth - daysLeft;
  const expectedPct = (daysPassed / daysInMonth) * 100;
  const remaining = limit - spent;
  const dailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;

  if (spent === 0) {
    return { text: "No spending recorded yet", color: "#94a3b8", emoji: "💤" };
  }
  if (pct > 100) {
    return { text: `Over by ${fmt(spent - limit)} — review now`, color: "#ef4444", emoji: "🚨" };
  }
  if (pct >= 90) {
    return { text: `Only ${fmt(remaining)} left — ${daysLeft}d to go`, color: "#f97316", emoji: "⚠️" };
  }
  if (pct >= 80) {
    return { text: `${fmt(dailyBudget)}/day keeps you on track`, color: "#f59e0b", emoji: "📊" };
  }
  if (pct < expectedPct - 15) {
    return { text: `Great pace! ${fmt(remaining)} of headroom left`, color: "#10b981", emoji: "🟢" };
  }
  if (dailyBudget > 0 && daysLeft > 0) {
    return { text: `${fmt(dailyBudget)}/day to stay on track`, color: "#6366f1", emoji: "📅" };
  }
  return { text: "On track this month", color: "#10b981", emoji: "✅" };
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealthScore(budgets: Budget[], daysLeft: number, daysInMonth: number): number {
  if (budgets.length === 0) return 100;
  const daysPassed = daysInMonth - daysLeft;
  const expectedFraction = daysInMonth > 0 ? daysPassed / daysInMonth : 0;

  let total = 0;
  for (const b of budgets) {
    const pct = b.budget === 0 ? 0 : b.spent / b.budget;
    if (pct > 1) total += 0;
    else if (pct > expectedFraction + 0.15) total += 40;
    else if (pct > expectedFraction) total += 70;
    else total += 100;
  }
  return Math.round(total / budgets.length);
}

function healthLabel(score: number) {
  if (score >= 85) return { label: "Excellent", color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-900/30", ring: "ring-emerald-200 dark:ring-emerald-800" };
  if (score >= 65) return { label: "Good",      color: "#6366f1", bg: "bg-indigo-50 dark:bg-indigo-900/30",  ring: "ring-indigo-200 dark:ring-indigo-800" };
  if (score >= 45) return { label: "Fair",      color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-900/30",   ring: "ring-amber-200 dark:ring-amber-800" };
  return              { label: "At Risk",   color: "#ef4444", bg: "bg-red-50 dark:bg-red-900/30",     ring: "ring-red-200 dark:ring-red-800" };
}

// ── Radial Progress Ring ──────────────────────────────────────────────────────

function RadialProgress({
  percent, color, size = 54, strokeWidth = 5, isEmpty = false,
}: {
  percent: number; color: string; size?: number; strokeWidth?: number; isEmpty?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {isEmpty ? (
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth}
          strokeDasharray="4 4" strokeLinecap="round" />
      ) : (
        <>
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={percent >= 100 ? "#ef4444" : color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </>
      )}
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error";
interface Toast { id: number; message: string; type: ToastType; }
let toastCounter = 0;

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-semibold pointer-events-auto border ${
            t.type === "success" ? "bg-emerald-500 border-emerald-400 text-white" : "bg-red-500 border-red-400 text-white"
          }`}
          style={{ animation: "slideUp 0.3s ease" }}
        >
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  categoryName, onConfirm, onCancel, isDeleting,
}: {
  categoryName: string; onConfirm: () => void; onCancel: () => void; isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-7">
        <div className="flex flex-col items-center text-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Delete Budget?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              This will permanently remove <span className="font-semibold text-gray-700 dark:text-gray-200">"{categoryName}"</span>.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BudgetManager ─────────────────────────────────────────────────────────────

export function BudgetManager({ budgets, onAddBudget, onUpdateBudget, onDeleteBudget }: BudgetManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [editingId, setEditingId] = useState<Budget["id"] | null>(null);
  const [form, setForm] = useState<FormState>({ category: "", budget: "", icon: "💰", color: "#3b82f6" });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Budget["id"] | null>(null);
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<Budget | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const daysLeft    = useMemo(getDaysLeftInMonth, []);
  const daysInMonth = useMemo(getDaysInMonth, []);

  useEffect(() => () => { toastTimers.current.forEach(clearTimeout); }, []);

  const addToast = (message: string, type: ToastType) => {
    const id = ++toastCounter;
    setToasts((p) => [...p, { id, message, type }]);
    const t = setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
    toastTimers.current.push(t);
  };
  const dismissToast = (id: number) => setToasts((p) => p.filter((t) => t.id !== id));

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
    const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0);
    return { totalBudget, totalSpent, remaining: totalBudget - totalSpent };
  }, [budgets]);

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => {
      const pa = a.budget === 0 ? 0 : a.spent / a.budget;
      const pb = b.budget === 0 ? 0 : b.spent / b.budget;
      return pb - pa;
    }),
    [budgets]
  );

  const healthScore = useMemo(
    () => computeHealthScore(budgets, daysLeft, daysInMonth),
    [budgets, daysLeft, daysInMonth]
  );
  const health = healthLabel(healthScore);
  const overBudgetCount = budgets.filter((b) => b.spent > b.budget).length;
  const overallPct = totals.totalBudget > 0
    ? Math.min((totals.totalSpent / totals.totalBudget) * 100, 100) : 0;

  const openAddModal = () => {
    setMode("add"); setEditingId(null);
    setForm({ category: "", budget: "", icon: "💰", color: "#3b82f6" });
    setErrors({}); setIsModalOpen(true);
  };
  const openEditModal = (b: Budget) => {
    setMode("edit"); setEditingId(b.id);
    setForm({ category: b.category, budget: String(b.budget), icon: b.icon, color: b.color });
    setErrors({}); setIsModalOpen(true);
  };

  const validate = (f: FormState): Partial<FormState> => {
    const e: Partial<FormState> = {};
    if (!f.category.trim()) e.category = "Please select or enter a category";
    if (!f.budget.trim() || isNaN(Number(f.budget)) || Number(f.budget) <= 0) e.budget = "Enter a valid positive amount";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eMap = validate(form);
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) return;
    const payload = {
      category: form.category.trim(), budget: Number(form.budget),
      icon: form.icon.trim() || "💰", color: form.color,
    };
    setIsSaving(true);
    try {
      if (mode === "add") { await onAddBudget(payload); addToast(`"${payload.category}" budget added!`, "success"); }
      else if (mode === "edit" && editingId != null) { await onUpdateBudget(editingId, payload); addToast(`"${payload.category}" updated!`, "success"); }
      setIsModalOpen(false);
    } catch { addToast("Something went wrong. Please try again.", "error"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteBudget) return;
    setDeletingId(pendingDeleteBudget.id);
    try {
      await onDeleteBudget(pendingDeleteBudget.id);
      addToast(`"${pendingDeleteBudget.category}" deleted.`, "success");
    } catch { addToast("Failed to delete budget.", "error"); }
    finally { setDeletingId(null); setPendingDeleteBudget(null); }
  };

  if (!budgets || budgets.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <EmptyState icon={Plus} title="No budgets yet"
          description="Create your first budget to start tracking your spending limits."
          actionLabel="Add Budget" onAction={openAddModal} gradient="from-indigo-500 to-purple-500" />
        {isModalOpen && <BudgetModal mode={mode} form={form} errors={errors} isSaving={isSaving}
          onChange={setForm} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} />}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scorePop{ 0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1} }
        .budget-card{animation:fadeIn 0.4s ease both}
        .budget-card:nth-child(1){animation-delay:.05s}
        .budget-card:nth-child(2){animation-delay:.10s}
        .budget-card:nth-child(3){animation-delay:.15s}
        .budget-card:nth-child(4){animation-delay:.20s}
        .budget-card:nth-child(5){animation-delay:.25s}
        .budget-card:nth-child(6){animation-delay:.30s}
        .score-badge{animation:scorePop 0.5s ease 0.3s both}
      `}</style>

      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-7">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">This Month</span>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Goals &amp; Budgets</h1>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Track your spending limits and stay on target.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Days left pill */}
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-2xl px-4 py-2.5 border border-gray-100 dark:border-gray-700 shadow-sm">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <div>
                  <p className="text-sm font-extrabold text-gray-800 dark:text-gray-100 leading-none">{daysLeft}d left</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">in this month</p>
                </div>
              </div>
              <button onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200">
                <Plus className="w-4 h-4" />
                Add Budget
              </button>
            </div>
          </div>

          {/* ── Over-budget alert ─────────────────────────────────────────── */}
          {overBudgetCount > 0 && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">
                  {overBudgetCount} budget{overBudgetCount > 1 ? "s are" : " is"} over limit this month
                </p>
                <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">Review the highlighted cards below.</p>
              </div>
            </div>
          )}

          {/* ── Summary Panel ─────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full"
              style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)" }} />
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <SummaryCard label="Total Budget" value={fmt(totals.totalBudget)}
                    sub={`${budgets.length} categories`} Icon={Wallet}
                    bgAccent="bg-indigo-50" textAccent="text-indigo-600" />
                  <SummaryCard label="Total Spent" value={fmt(totals.totalSpent)}
                    sub={`${Math.round(overallPct)}% of budget used`} Icon={TrendingUp}
                    bgAccent={totals.totalSpent > totals.totalBudget ? "bg-red-50" : "bg-orange-50"}
                    textAccent={totals.totalSpent > totals.totalBudget ? "text-red-600" : "text-orange-500"}
                    valueColor={totals.totalSpent > totals.totalBudget ? "text-red-600" : "text-gray-900"} />
                  <SummaryCard label="Remaining" value={fmt(Math.abs(totals.remaining))}
                    sub={totals.remaining < 0 ? "Over total budget" : "Left to spend"} Icon={PiggyBank}
                    bgAccent={totals.remaining < 0 ? "bg-red-50" : "bg-emerald-50"}
                    textAccent={totals.remaining < 0 ? "text-red-600" : "text-emerald-600"}
                    valueColor={totals.remaining < 0 ? "text-red-600" : "text-emerald-600"} />
                </div>

                {/* ── Health Score Badge ───────────────────────────────────── */}
                <div className={`score-badge flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-6 py-4 ring-2 ${health.bg} ${health.ring}`}>
                  <Shield className="w-5 h-5 mb-1" style={{ color: health.color }} />
                  <p className="text-3xl font-extrabold leading-none" style={{ color: health.color }}>
                    {healthScore}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: health.color }}>
                    {health.label}
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">Health Score</p>
                </div>
              </div>

              {/* Overall progress */}
              {totals.totalBudget > 0 && (
                <div className="mt-5 bg-slate-50 dark:bg-gray-700/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Monthly Overview</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {fmt(totals.totalSpent)} spent of {fmt(totals.totalBudget)}
                      </p>
                    </div>
                    <p className={`text-2xl font-extrabold ${
                      overallPct >= 100 ? "text-red-600" : overallPct >= 80 ? "text-amber-500" : "text-emerald-600"
                    }`}>{Math.round(overallPct)}%</p>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${overallPct}%`,
                        background: overallPct >= 100 ? "#ef4444"
                          : overallPct >= 80 ? "linear-gradient(to right,#f59e0b,#ef4444)"
                          : "linear-gradient(to right,#6366f1,#8b5cf6)",
                      }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Budget Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedBudgets.map((b, i) => {
              const percent = b.budget === 0 ? 0 : Math.min((b.spent / b.budget) * 100, 100);
              const over = b.spent > b.budget;
              const nearLimit = percent >= 80;
              const isEmpty = b.spent === 0;
              const isCurrentlyDeleting = deletingId === b.id;
              const statusColor = over ? "#ef4444" : percent >= 90 ? "#f97316" : percent >= 80 ? "#f59e0b" : b.color;
              const tip = getCardTip(b, daysLeft, daysInMonth);

              return (
                <div key={b.id}
                  className={`budget-card bg-white dark:bg-gray-800 rounded-3xl border flex flex-col overflow-hidden transition-all duration-300 ${
                    isCurrentlyDeleting ? "opacity-40 pointer-events-none scale-95"
                    : "hover:shadow-xl hover:-translate-y-1 shadow-sm"
                  } ${over ? "border-red-200 dark:border-red-800" : nearLimit ? "border-amber-200 dark:border-amber-800" : "border-gray-100 dark:border-gray-700"}`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Color accent top bar */}
                  <div className="h-1 w-full"
                    style={{ backgroundColor: isEmpty ? "#e2e8f0" : statusColor }} />

                  <div className="p-5 flex flex-col gap-4 flex-1">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: `${b.color}18`, border: `1.5px solid ${b.color}30` }}>
                          {b.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate text-sm">{b.category}</h3>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Limit: {fmt(b.budget)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditModal(b)}
                          className="p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-300 dark:text-gray-600 hover:text-indigo-500 transition-all" aria-label="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setPendingDeleteBudget(b)}
                          className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all" aria-label="Delete">
                          {isCurrentlyDeleting
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Amount + Radial ring */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-extrabold tracking-tight"
                          style={{ color: isEmpty ? "#cbd5e1" : statusColor }}>
                          {fmt(b.spent)}
                        </p>
                        <p className="text-xs mt-0.5">
                          {over
                            ? <span className="text-red-500 font-semibold">Over by {fmt(b.spent - b.budget)}</span>
                            : isEmpty
                            ? <span className="text-gray-300">No spending yet</span>
                            : <span className="text-gray-400">{fmt(b.budget - b.spent)} remaining</span>
                          }
                        </p>
                      </div>
                      <div className="relative flex items-center justify-center">
                        <RadialProgress percent={percent} color={statusColor} size={54} strokeWidth={5} isEmpty={isEmpty} />
                        <span className="absolute text-xs font-bold"
                          style={{ color: isEmpty ? "#cbd5e1" : statusColor }}>
                          {isEmpty ? "—" : `${Math.round(percent)}%`}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-gray-700">
                      {isEmpty ? (
                        <div className="h-full w-full"
                          style={{ background: "repeating-linear-gradient(90deg,#e2e8f0 0px,#e2e8f0 6px,transparent 6px,transparent 12px)" }} />
                      ) : (
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${percent}%`, backgroundColor: statusColor }} />
                      )}
                    </div>

                    {/* Smart tip footer */}
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 mt-auto"
                      style={{ backgroundColor: `${tip.color}12`, border: `1px solid ${tip.color}28` }}>
                      <span className="text-sm leading-none flex-shrink-0">{tip.emoji}</span>
                      <p className="text-xs font-semibold leading-snug" style={{ color: tip.color }}>
                        {tip.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <BudgetModal mode={mode} form={form} errors={errors} isSaving={isSaving}
          onChange={setForm} onClose={() => !isSaving && setIsModalOpen(false)} onSubmit={handleSubmit} />
      )}
      {pendingDeleteBudget && (
        <DeleteConfirmModal categoryName={pendingDeleteBudget.category}
          onConfirm={handleDeleteConfirm} onCancel={() => setPendingDeleteBudget(null)}
          isDeleting={deletingId === pendingDeleteBudget.id} />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, Icon, bgAccent, textAccent, valueColor = "text-gray-900" }: {
  label: string; value: string; sub?: string; Icon: React.ElementType;
  bgAccent: string; textAccent: string; valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${bgAccent}`}>
        <Icon className={`w-5 h-5 ${textAccent}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-extrabold tracking-tight leading-none ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Budget Modal ──────────────────────────────────────────────────────────────

interface BudgetModalProps {
  mode: Mode; form: FormState; errors: Partial<FormState>; isSaving: boolean;
  onChange: (f: FormState) => void; onClose: () => void; onSubmit: (e: React.FormEvent) => void;
}

function BudgetModal({ mode, form, errors, isSaving, onChange, onClose, onSubmit }: BudgetModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{mode === "add" ? "Create Budget" : "Edit Budget"}</h3>
            <p className="text-indigo-200 text-xs mt-0.5">
              {mode === "add" ? "Set a new spending limit" : "Update your spending limit"}
            </p>
          </div>
          <button onClick={onClose} disabled={isSaving}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition disabled:opacity-50">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Category</label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
              {PRESET_CATEGORIES.map((cat) => (
                <button key={cat.name} type="button"
                  onClick={() => onChange({ ...form, category: cat.name, icon: cat.icon, color: cat.color })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    form.category === cat.name
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "border-gray-100 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700"
                  }`}>
                  <span>{cat.icon}</span><span>{cat.name}</span>
                </button>
              ))}
            </div>
            <input type="text" value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              placeholder="Or type a custom category..."
              className="mt-2 w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 transition placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            {errors.category && <p className="mt-1 text-xs text-red-500 font-medium">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Monthly Limit ($)</label>
            <input type="number" min={0.01} step="0.01" value={form.budget}
              onChange={(e) => onChange({ ...form, budget: e.target.value })}
              placeholder="e.g., 300"
              className="w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 transition placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            {errors.budget && <p className="mt-1 text-xs text-red-500 font-medium">{errors.budget}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Icon</label>
              <input type="text" value={form.icon}
                onChange={(e) => { const v = [...e.target.value].slice(0, 2).join(""); onChange({ ...form, icon: v }); }}
                className="w-full text-center rounded-xl border-2 border-gray-100 dark:border-gray-600 px-2 py-2.5 text-xl focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color}
                  onChange={(e) => onChange({ ...form, color: e.target.value })}
                  className="w-11 h-11 rounded-xl border-2 border-gray-100 dark:border-gray-600 cursor-pointer p-0.5 bg-white dark:bg-gray-700" />
                <input type="text" value={form.color}
                  onChange={(e) => onChange({ ...form, color: e.target.value })}
                  className="flex-1 rounded-xl border-2 border-gray-100 dark:border-gray-600 px-3 py-2.5 text-xs font-mono focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 transition" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition shadow-lg shadow-indigo-200 disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "add" ? "Create Budget" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}