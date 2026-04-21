"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Target, PiggyBank, Check, X,
  TrendingUp, Loader2, Upload, BarChart3, Brain,
  Bell, ArrowRight, Sparkles, ChevronRight,
} from "lucide-react";
import { transactionsAPI, budgetsAPI, goalsAPI, getUser } from "@/lib/api";

const ONBOARDING_KEY = "fintrack-onboarding-done";

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — Welcome
// ─────────────────────────────────────────────────────────────────────────────
function StepWelcome({ onNext, onSkip, userName }: { onNext: () => void; onSkip: () => void; userName: string }) {
  const highlights = [
    { icon: BarChart3, color: "#6366f1", bg: "rgba(99,102,241,0.12)", label: "Live dashboard",    desc: "Income, expenses & net worth at a glance" },
    { icon: Brain,     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", label: "4 AI models",       desc: "Anomaly detection, forecasts, predictions" },
    { icon: Target,    color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Budgets & goals",   desc: "Set limits, track progress automatically" },
    { icon: Bell,      color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Smart alerts",      desc: "Unusual spending caught before it hurts" },
  ];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Welcome{userName ? `, ${userName}` : ""}! 🎉
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          FinTrack is your AI-powered money dashboard. Let's take 60 seconds to personalise it for you.
        </p>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-2 gap-2.5">
        {highlights.map(({ icon: Icon, color, bg, label, desc }) => (
          <div
            key={label}
            className="flex flex-col gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onSkip}
          className="py-2.5 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip setup
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          Let's get started <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Income
// ─────────────────────────────────────────────────────────────────────────────
function StepIncome({ onNext }: { onNext: () => void }) {
  const [salary, setSalary] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">What's your income?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We'll use this to build smart budgets and track your savings rate.
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
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-semibold"
              autoFocus
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
                {f === "biweekly" ? "Bi-weekly" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="py-2.5 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Budgets
// ─────────────────────────────────────────────────────────────────────────────
const BUDGET_PRESETS = [
  { category: "Food & Dining",    icon: "🍽️", color: "#f97316", suggested: 500 },
  { category: "Transportation",   icon: "🚗", color: "#10b981", suggested: 200 },
  { category: "Entertainment",    icon: "🎬", color: "#8b5cf6", suggested: 100 },
  { category: "Shopping",         icon: "🛍️", color: "#f59e0b", suggested: 200 },
  { category: "Bills & Utilities",icon: "💡", color: "#0ea5e9", suggested: 250 },
  { category: "Health & Fitness", icon: "💪", color: "#ec4899", suggested: 100 },
];

function StepBudget({ onNext }: { onNext: () => void }) {
  const [budgets, setBudgets] = useState<Record<string, string>>(
    Object.fromEntries(BUDGET_PRESETS.map(p => [p.category, String(p.suggested)]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const entries = BUDGET_PRESETS.filter(p => parseFloat(budgets[p.category] || "0") > 0);
    try {
      await Promise.all(
        entries.map(p =>
          budgetsAPI.create({
            category: p.category,
            budget: parseFloat(budgets[p.category]),
            spent: 0,
            icon: p.icon,
            color: p.color,
          }).catch(() => {})
        )
      );
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Set your monthly limits</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We'll alert you before you overspend. Adjust any amount — or set to 0 to skip a category.
        </p>
      </div>

      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
        {BUDGET_PRESETS.map(({ category, icon, color }) => (
          <div key={category} className="flex items-center gap-3">
            <span className="text-xl w-8 text-center shrink-0">{icon}</span>
            <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{category}</span>
            <div className="relative w-28 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={budgets[category]}
                onChange={e => setBudgets(prev => ({ ...prev, [category]: e.target.value }))}
                className="w-full pl-6 pr-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-right text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ focusBorderColor: color } as any}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="py-2.5 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Set Budgets"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Goal
// ─────────────────────────────────────────────────────────────────────────────
const GOAL_TEMPLATES = [
  { name: "Emergency Fund", icon: "🛡️", target: 5000 },
  { name: "Vacation",       icon: "✈️",  target: 2000 },
  { name: "New Car",        icon: "🚗", target: 15000 },
  { name: "Down Payment",   icon: "🏠", target: 30000 },
];

function StepGoal({ onNext }: { onNext: () => void }) {
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
    if (!goalName.trim() || !amount || amount <= 0) { onNext(); return; }
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
    onNext();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <PiggyBank className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create a savings goal</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pick a template or name your own. Track progress right on the dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {GOAL_TEMPLATES.map(tpl => (
          <button
            key={tpl.name}
            onClick={() => selectTemplate(tpl)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
              selectedTemplate === tpl.name
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                : "border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-600"
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

      <div className="space-y-2.5">
        <input
          type="text"
          value={goalName}
          onChange={e => { setGoalName(e.target.value); setSelectedTemplate(null); }}
          placeholder="Or name your own goal…"
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
          onClick={onNext}
          className="py-2.5 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving…" : "Create Goal"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — All done!
// ─────────────────────────────────────────────────────────────────────────────
function StepDone({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();

  const actions = [
    {
      icon: Upload,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      label: "Import transactions",
      desc: "Upload a CSV from your bank — ML auto-categorises every row",
      onClick: () => { onComplete(); /* CSV import modal is on the dashboard */ },
    },
    {
      icon: DollarSign,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
      label: "Add a transaction",
      desc: "Manually log income or an expense right now",
      onClick: () => { onComplete(); },
    },
    {
      icon: BarChart3,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
      label: "Explore dashboard",
      desc: "See your AI insights, spending charts, and budget overview",
      onClick: () => { onComplete(); },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Confetti header */}
      <div className="text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">You're all set!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          Your account is personalised. Here are the best next steps to get real value fast.
        </p>
      </div>

      {/* Quick action cards */}
      <div className="space-y-2.5">
        {actions.map(({ icon: Icon, color, bg, label, desc, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-600 text-left transition group"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-0.5 truncate">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition shrink-0" />
          </button>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        Go to Dashboard <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEP_META = [
  { title: "Welcome"  },
  { title: "Income"   },
  { title: "Budgets"  },
  { title: "Goal"     },
  { title: "Done"     },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const userName = (() => {
    try { return getUser()?.firstName || getUser()?.name?.split(" ")[0] || ""; } catch { return ""; }
  })();

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const next = () => setStep(s => Math.min(s + 1, STEP_META.length - 1));

  // Progress indicator — only show dots for steps 1-3 (data collection)
  const dataSteps = STEP_META.slice(1, 4); // Income, Budgets, Goal
  const dataStep  = step - 1;             // 0-indexed within data steps

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === 0 ? handleComplete : undefined} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Gradient header */}
        <div
          className="px-6 py-5"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">FinTrack Setup</p>
              <h1 className="text-white text-lg font-bold mt-0.5">
                {step === 0 ? "Welcome aboard" : step === 4 ? "Setup complete" : `Step ${step} of 3`}
              </h1>
            </div>
            <button
              onClick={handleComplete}
              className="p-1.5 rounded-lg transition"
              style={{ color: "rgba(199,210,254,0.8)", background: "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(199,210,254,0.8)"; }}
              title="Close setup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress dots — shown only during data-collection steps */}
          {step >= 1 && step <= 3 && (
            <div className="flex items-center gap-2">
              {dataSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: i < dataStep ? "white" : i === dataStep ? "rgba(165,180,252,0.9)" : "rgba(79,70,229,0.4)",
                      color:      i < dataStep ? "#4f46e5" : "white",
                      boxShadow:  i === dataStep ? "0 0 0 2px white" : "none",
                    }}
                  >
                    {i < dataStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {i < dataSteps.length - 1 && (
                    <div
                      className="flex-1 h-0.5 rounded transition-all"
                      style={{ background: i < dataStep ? "white" : "rgba(79,70,229,0.3)" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {step >= 1 && step <= 3 && (
            <div className="flex justify-between mt-1.5">
              {dataSteps.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium"
                  style={{ color: i === dataStep ? "white" : "rgba(165,180,252,0.7)" }}
                >
                  {s.title}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step content */}
        <div className="p-6">
          {step === 0 && <StepWelcome onNext={next} onSkip={handleComplete} userName={userName} />}
          {step === 1 && <StepIncome onNext={next} />}
          {step === 2 && <StepBudget onNext={next} />}
          {step === 3 && <StepGoal onNext={next} />}
          {step === 4 && <StepDone onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when onboarding should show for this user (first session only). */
export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(ONBOARDING_KEY);
}
