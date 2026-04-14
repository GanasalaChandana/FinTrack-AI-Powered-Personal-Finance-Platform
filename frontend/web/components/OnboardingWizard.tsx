"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Target, PiggyBank, Check, ChevronRight, X,
  TrendingUp, Loader2,
} from "lucide-react";
import { transactionsAPI, budgetsAPI, goalsAPI } from "@/lib/api";

const ONBOARDING_KEY = "fintrack-onboarding-done";

interface OnboardingWizardProps {
  onComplete: () => void;
}

// ── Step 1: Add Income ────────────────────────────────────────────────────────
function StepIncome({ onNext }: { onNext: () => void }) {
  const [salary, setSalary] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const handleSave = async () => {
    const amount = parseFloat(salary.replace(/,/g, ""));
    if (!amount || amount <= 0) { onNext(); return; }
    setSaving(true);
    try {
      await transactionsAPI.create({
        merchant: "Salary",
        description: "Monthly Income",
        category: "Salary",
        amount,
        type: "income",
        date: new Date().toISOString().split("T")[0],
        status: "completed",
      });
    } catch { /* proceed anyway */ }
    setSaving(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">What's your income?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Start by adding your primary income source so we can build your budget.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Monthly take-home pay
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
            <input
              type="number"
              value={salary}
              onChange={e => setSalary(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Pay frequency
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["weekly", "biweekly", "monthly"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                  frequency === f
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-emerald-400"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save & Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Set Budget ────────────────────────────────────────────────────────
const BUDGET_PRESETS = [
  { category: "Food & Dining", icon: "🍔", suggested: 400 },
  { category: "Transportation", icon: "🚗", suggested: 200 },
  { category: "Entertainment", icon: "🎮", suggested: 100 },
  { category: "Shopping", icon: "🛍️", suggested: 150 },
  { category: "Bills & Utilities", icon: "💡", suggested: 200 },
  { category: "Healthcare", icon: "⚕️", suggested: 100 },
];

function StepBudget({ onNext }: { onNext: () => void }) {
  const [budgets, setBudgets] = useState<Record<string, string>>(
    Object.fromEntries(BUDGET_PRESETS.map(p => [p.category, String(p.suggested)]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(budgets).filter(([, v]) => parseFloat(v) > 0);
    try {
      await Promise.all(entries.map(([category, amount]) =>
        budgetsAPI.create({
          category,
          budget: parseFloat(amount),
          spent: 0,
          icon: "📦",
          color: "#6366f1",
        }).catch(() => {})
      ));
    } catch { /* proceed anyway */ }
    setSaving(false);
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Set your monthly budget</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We've suggested amounts based on typical spending. Adjust as you like.
        </p>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {BUDGET_PRESETS.map(({ category, icon }) => (
          <div key={category} className="flex items-center gap-3">
            <span className="text-xl w-8 text-center shrink-0">{icon}</span>
            <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{category}</span>
            <div className="relative w-28 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={budgets[category]}
                onChange={e => setBudgets(prev => ({ ...prev, [category]: e.target.value }))}
                className="w-full pl-6 pr-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Set Budgets
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Create Goal ───────────────────────────────────────────────────────
const GOAL_TEMPLATES = [
  { name: "Emergency Fund", icon: "🛡️", target: 5000 },
  { name: "Vacation", icon: "✈️", target: 2000 },
  { name: "New Car", icon: "🚗", target: 15000 },
  { name: "Down Payment", icon: "🏠", target: 30000 },
];

function StepGoal({ onComplete }: { onComplete: () => void }) {
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectTemplate = (tpl: typeof GOAL_TEMPLATES[0]) => {
    setSelectedTemplate(tpl.name);
    setGoalName(tpl.name);
    setTargetAmount(String(tpl.target));
  };

  const handleSave = async () => {
    const amount = parseFloat(targetAmount);
    if (!goalName.trim() || !amount || amount <= 0) { onComplete(); return; }
    setSaving(true);
    try {
      await goalsAPI.create({
        name: goalName.trim(),
        targetAmount: amount,
        currentAmount: 0,
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        category: "Savings",
      });
    } catch { /* proceed anyway */ }
    setSaving(false);
    onComplete();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <PiggyBank className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create a savings goal</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          What are you saving toward? Pick a template or create your own.
        </p>
      </div>

      {/* Templates */}
      <div className="grid grid-cols-2 gap-2">
        {GOAL_TEMPLATES.map(tpl => (
          <button
            key={tpl.name}
            onClick={() => selectTemplate(tpl)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
              selectedTemplate === tpl.name
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                : "border-gray-200 dark:border-gray-600 hover:border-amber-300"
            }`}
          >
            <span className="text-xl">{tpl.icon}</span>
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{tpl.name}</p>
              <p className="text-[11px] text-gray-400">${tpl.target.toLocaleString()}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="space-y-3">
        <input
          type="text"
          value={goalName}
          onChange={e => { setGoalName(e.target.value); setSelectedTemplate(null); }}
          placeholder="Goal name (e.g. New Laptop)"
          className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            value={targetAmount}
            onChange={e => setTargetAmount(e.target.value)}
            placeholder="Target amount"
            className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving…" : "Finish Setup"}
        </button>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const steps = [
    { title: "Add Income", icon: <TrendingUp className="w-4 h-4" /> },
    { title: "Set Budget", icon: <Target className="w-4 h-4" /> },
    { title: "Create Goal", icon: <PiggyBank className="w-4 h-4" /> },
  ];

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const nextStep = () => {
    if (step < 2) setStep(s => s + 1);
    else handleComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">Welcome to FinTrack</p>
              <h1 className="text-white text-lg font-bold mt-0.5">Let's get you set up</h1>
            </div>
            <button
              onClick={handleComplete}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
              title="Skip setup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? "bg-white text-indigo-600" : i === step ? "bg-indigo-400 text-white ring-2 ring-white" : "bg-indigo-700/50 text-indigo-300"
                }`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-white" : "bg-indigo-700/50"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {steps.map((s, i) => (
              <span key={i} className={`text-[10px] font-medium ${i === step ? "text-white" : "text-indigo-300"}`}>
                {s.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          {step === 0 && <StepIncome onNext={nextStep} />}
          {step === 1 && <StepBudget onNext={nextStep} />}
          {step === 2 && <StepGoal onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}

/** Check if onboarding should show for this user */
export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(ONBOARDING_KEY);
}
