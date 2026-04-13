"use client";

import { useState, useEffect } from "react";
import {
  Loader2, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, Target, Lightbulb, Sparkles, Shield, Star,
} from "lucide-react";
import { transactionsAPI, budgetsAPI } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancialData {
  monthlyIncome: number;
  monthlyExpenses: number;
  totalSavings: number;
  totalDebt: number;
  emergencyFund: number;
  monthlyBudget: number;
  actualSpending: number;
  onTimePayments: number;
  totalPayments: number;
}

interface ComponentScore {
  score: number;
  maxScore: number;
  percentage: number;
  status: "excellent" | "good" | "fair" | "poor";
  description: string;
}

interface HealthScoreResult {
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  components: {
    savingsRate: ComponentScore;
    debtToIncome: ComponentScore;
    emergencyFund: ComponentScore;
    budgetAdherence: ComponentScore;
    paymentHistory: ComponentScore;
  };
  recommendations: string[];
  strengths: string[];
  improvements: string[];
}

// ── Score calculators ─────────────────────────────────────────────────────────

function calcSavingsRate(data: FinancialData): ComponentScore {
  const rate =
    data.monthlyIncome > 0
      ? ((data.monthlyIncome - data.monthlyExpenses) / data.monthlyIncome) * 100
      : 0;
  if (rate >= 20) return { score: 100, maxScore: 100, percentage: rate, status: "excellent", description: "Excellent! You're saving 20%+ of your income." };
  if (rate >= 15) return { score: 85,  maxScore: 100, percentage: rate, status: "good",      description: "Good savings rate. Aim for 20% for optimal health." };
  if (rate >= 10) return { score: 70,  maxScore: 100, percentage: rate, status: "fair",      description: "Fair savings rate. Try to increase to 15–20%." };
  if (rate >= 5)  return { score: 50,  maxScore: 100, percentage: rate, status: "fair",      description: "Low savings rate. Focus on increasing to at least 10%." };
  return               { score: 25,  maxScore: 100, percentage: rate, status: "poor",      description: "Critical: Very low or negative savings. Review expenses." };
}

function calcDebtToIncome(data: FinancialData): ComponentScore {
  const dti =
    data.monthlyIncome > 0
      ? (data.totalDebt / (data.monthlyIncome * 12)) * 100
      : 0;
  if (dti === 0) return { score: 100, maxScore: 100, percentage: dti, status: "excellent", description: "Debt-free! Excellent financial position." };
  if (dti <= 36) return { score: 90,  maxScore: 100, percentage: dti, status: "excellent", description: "Excellent debt-to-income ratio below 36%." };
  if (dti <= 43) return { score: 75,  maxScore: 100, percentage: dti, status: "good",      description: "Manageable debt level. Keep monitoring." };
  if (dti <= 50) return { score: 50,  maxScore: 100, percentage: dti, status: "fair",      description: "High debt level. Consider debt reduction strategies." };
  return              { score: 25,  maxScore: 100, percentage: dti, status: "poor",      description: "Critical debt level. Seek a debt reduction plan." };
}

function calcEmergencyFund(data: FinancialData): ComponentScore {
  const months =
    data.monthlyExpenses > 0 ? data.emergencyFund / data.monthlyExpenses : 0;
  if (months >= 6) return { score: 100, maxScore: 100, percentage: Math.min((months / 6) * 100, 100), status: "excellent", description: "Excellent! You have 6+ months of expenses saved." };
  if (months >= 3) return { score: 80,  maxScore: 100, percentage: (months / 6) * 100,                status: "good",      description: "Good emergency fund. Aim for 6 months coverage." };
  if (months >= 1) return { score: 60,  maxScore: 100, percentage: (months / 6) * 100,                status: "fair",      description: "Build your emergency fund to 3–6 months of expenses." };
  if (months > 0)  return { score: 30,  maxScore: 100, percentage: (months / 6) * 100,                status: "poor",      description: "Critical: Emergency fund too low. Start building it." };
  return               { score: 0,   maxScore: 100, percentage: 0,                                    status: "poor",      description: "No emergency fund. This should be your top priority." };
}

function calcBudgetAdherence(data: FinancialData): ComponentScore {
  const adh =
    data.monthlyBudget > 0
      ? Math.max(
          0,
          (1 - Math.abs(data.actualSpending - data.monthlyBudget) / data.monthlyBudget) * 100
        )
      : 0;
  if (adh >= 95) return { score: 100, maxScore: 100, percentage: adh, status: "excellent", description: "Excellent budget adherence!" };
  if (adh >= 85) return { score: 85,  maxScore: 100, percentage: adh, status: "good",      description: "Good budget management. Minor adjustments needed." };
  if (adh >= 70) return { score: 70,  maxScore: 100, percentage: adh, status: "fair",      description: "Fair budget adherence. Review spending categories." };
  if (adh >= 50) return { score: 50,  maxScore: 100, percentage: adh, status: "fair",      description: "Budget needs attention. Track spending more closely." };
  return             { score: 25,  maxScore: 100, percentage: adh, status: "poor",      description: "Poor budget adherence. Revise budget or spending habits." };
}

function calcPaymentHistory(data: FinancialData): ComponentScore {
  const rate =
    data.totalPayments > 0
      ? (data.onTimePayments / data.totalPayments) * 100
      : 100; // no recorded payments → assume perfect
  if (rate === 100) return { score: 100, maxScore: 100, percentage: rate, status: "excellent", description: "Perfect payment history!" };
  if (rate >= 95)   return { score: 90,  maxScore: 100, percentage: rate, status: "excellent", description: "Excellent payment history." };
  if (rate >= 85)   return { score: 75,  maxScore: 100, percentage: rate, status: "good",      description: "Good payment history. Stay consistent." };
  if (rate >= 70)   return { score: 50,  maxScore: 100, percentage: rate, status: "fair",      description: "Fair payment history. Avoid late payments." };
  return                { score: 25,  maxScore: 100, percentage: rate, status: "poor",      description: "Poor payment history. Set up auto-pay." };
}

// ── Grade thresholds ──────────────────────────────────────────────────────────
//
// Max possible score = (100×2.5) + (100×2.5) + (100×2.0) + (100×2.0) + (100×1.0) = 1000
//
// FIX: Old thresholds (900/800/700/600) mapped 650 → D even though 650 = 65%.
// New thresholds align with intuitive percentage grading:
//
//   A  ≥ 850  (85%+)  — Excellent financial health
//   B  ≥ 700  (70%+)  — Good financial health
//   C  ≥ 550  (55%+)  — Fair financial health       ← 650 now correctly → C
//   D  ≥ 400  (40%+)  — Needs improvement
//   F  < 400           — Critical
//
const getGrade = (score: number): "A" | "B" | "C" | "D" | "F" => {
  if (score >= 850) return "A";
  if (score >= 700) return "B";
  if (score >= 550) return "C";
  if (score >= 400) return "D";
  return "F";
};

// ── Main calculator ───────────────────────────────────────────────────────────

function calculateFinancialHealthScore(data: FinancialData): HealthScoreResult {
  const components = {
    savingsRate:     calcSavingsRate(data),
    debtToIncome:    calcDebtToIncome(data),
    emergencyFund:   calcEmergencyFund(data),
    budgetAdherence: calcBudgetAdherence(data),
    paymentHistory:  calcPaymentHistory(data),
  };

  const totalScore = Math.round(
    components.savingsRate.score     * 2.5 +
    components.debtToIncome.score    * 2.5 +
    components.emergencyFund.score   * 2.0 +
    components.budgetAdherence.score * 2.0 +
    components.paymentHistory.score  * 1.0
  );

  // ✅ FIX: use getGrade() instead of inline ternary with wrong thresholds
  const grade = getGrade(totalScore);

  const LABELS: Record<string, { strength: string; improvement: string }> = {
    savingsRate:     { strength: "Strong savings habits",         improvement: "Increase savings rate" },
    debtToIncome:    { strength: "Manageable debt levels",        improvement: "Reduce debt burden" },
    emergencyFund:   { strength: "Well-funded emergency savings", improvement: "Build emergency fund" },
    budgetAdherence: { strength: "Excellent budget discipline",   improvement: "Improve budget adherence" },
    paymentHistory:  { strength: "Consistent payment history",    improvement: "Maintain on-time payments" },
  };

  const strengths: string[] = [];
  const improvements: string[] = [];
  const recommendations: string[] = [];

  Object.entries(components).forEach(([key, c]) => {
    if (c.status === "excellent" || c.status === "good") strengths.push(LABELS[key].strength);
    else improvements.push(LABELS[key].improvement);
  });

  if (["poor", "fair"].includes(components.savingsRate.status))
    recommendations.push("Increase your savings rate to at least 15% of income", "Set up automatic transfers to savings on payday");
  if (["poor", "fair"].includes(components.debtToIncome.status))
    recommendations.push("Focus on paying down high-interest debt first");
  if (["poor", "fair"].includes(components.emergencyFund.status))
    recommendations.push("Build your emergency fund to cover 3–6 months of expenses");
  if (["poor", "fair"].includes(components.budgetAdherence.status))
    recommendations.push("Review and adjust your budget to match spending patterns");
  if (["poor", "fair"].includes(components.paymentHistory.status))
    recommendations.push("Set up automatic payments to avoid late fees");

  return {
    totalScore,
    grade,
    components,
    recommendations: recommendations.slice(0, 5),
    strengths,
    improvements,
  };
}

// ── Grade label helper ────────────────────────────────────────────────────────

const GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Needs Work",
  F: "Critical",
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; bar: string; label: string }> = {
  excellent: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", label: "Excellent" },
  good:      { bg: "bg-indigo-50",  text: "text-indigo-700",  bar: "bg-indigo-500",  label: "Good" },
  fair:      { bg: "bg-amber-50",   text: "text-amber-700",   bar: "bg-amber-400",   label: "Fair" },
  poor:      { bg: "bg-red-50",     text: "text-red-700",     bar: "bg-red-500",     label: "Poor" },
};

const GRADE_STYLES: Record<string, { color: string; bg: string; ring: string }> = {
  A: { color: "#10b981", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  B: { color: "#6366f1", bg: "bg-indigo-50",  ring: "ring-indigo-200"  },
  C: { color: "#f59e0b", bg: "bg-amber-50",   ring: "ring-amber-200"   },
  D: { color: "#f97316", bg: "bg-orange-50",  ring: "ring-orange-200"  },
  F: { color: "#ef4444", bg: "bg-red-50",     ring: "ring-red-200"     },
};

const COMPONENT_LABELS: Record<string, string> = {
  savingsRate:     "Savings Rate",
  debtToIncome:    "Debt to Income",
  emergencyFund:   "Emergency Fund",
  budgetAdherence: "Budget Adherence",
  paymentHistory:  "Payment History",
};

const COMPONENT_ICONS: Record<string, React.ElementType> = {
  savingsRate:     TrendingUp,
  debtToIncome:    Shield,
  emergencyFund:   Star,
  budgetAdherence: Target,
  paymentHistory:  CheckCircle,
};

// ── FinancialHealthScore component ────────────────────────────────────────────

function FinancialHealthScore({ data }: { data: FinancialData }) {
  const [score, setScore] = useState<HealthScoreResult | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const result = calculateFinancialHealthScore(data);
    setScore(result);

    let current = 0;
    const increment = result.totalScore / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= result.totalScore) {
        setAnimatedScore(result.totalScore);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, 20);
    return () => clearInterval(timer);
  }, [data]);

  if (!score) return null;

  const gradeStyle = GRADE_STYLES[score.grade];
  const circumference = 2 * Math.PI * 88;

  return (
    <div className="space-y-6">

      {/* ── Score Hero Card ── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(to right,#a855f7,#6366f1,#3b82f6)" }}
        />
        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-1">
              Overall Rating
            </p>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Financial Health Score</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Your overall financial wellness rating</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 mb-8">
            {/* Animated ring */}
            <div className="relative flex-shrink-0">
              <svg className="w-48 h-48" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                <circle
                  cx="96" cy="96" r="88"
                  stroke={gradeStyle.color}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - animatedScore / 1000)}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-5xl font-black leading-none"
                  style={{ color: gradeStyle.color }}
                >
                  {animatedScore}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">out of 1000</span>
              </div>
            </div>

            {/* Grade badge */}
            <div
              className={`flex flex-col items-center justify-center w-36 h-36 rounded-3xl ring-2 ${gradeStyle.bg} ${gradeStyle.ring} flex-shrink-0`}
              style={{ animation: "scorePop 0.5s ease 0.6s both" }}
            >
              <span
                className="text-6xl font-black leading-none"
                style={{ color: gradeStyle.color }}
              >
                {score.grade}
              </span>
              <span
                className="text-xs font-bold uppercase tracking-widest mt-1"
                style={{ color: gradeStyle.color }}
              >
                {GRADE_LABELS[score.grade]}
              </span>
            </div>
          </div>

          {/* Grade scale legend */}
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {(["A", "B", "C", "D", "F"] as const).map((g) => (
              <div
                key={g}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  score.grade === g
                    ? `${GRADE_STYLES[g].bg} ring-2 ${GRADE_STYLES[g].ring}`
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                }`}
                style={score.grade === g ? { color: GRADE_STYLES[g].color } : {}}
              >
                {g}
                {score.grade === g && (
                  <span className="text-[10px] opacity-70">← you</span>
                )}
              </div>
            ))}
          </div>

          {/* Strengths & Focus Areas */}
          <div className="grid sm:grid-cols-2 gap-4">
            {score.strengths.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Your Strengths</span>
                </div>
                <ul className="space-y-1.5">
                  {score.strengths.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {score.improvements.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-400">Focus Areas</span>
                </div>
                <ul className="space-y-1.5">
                  {score.improvements.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Score Breakdown ── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6)" }}
        />
        <div className="p-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-5">Score Breakdown</h3>
          <div className="space-y-5">
            {Object.entries(score.components).map(([key, component]) => {
              const st = STATUS_STYLES[component.status];
              const Icon = COMPONENT_ICONS[key] ?? CheckCircle;
              const pct = (component.score / component.maxScore) * 100;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${st.bg}`}
                      >
                        <Icon className={`w-4 h-4 ${st.text}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {COMPONENT_LABELS[key]}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {component.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                        {component.score}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-0.5">/{component.maxScore}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${st.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}
                    >
                      {st.label}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Recommendations ── */}
      {score.recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-amber-400" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Personalized Recommendations</h3>
            </div>
            <div className="space-y-3">
              {score.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 px-4 py-3"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-indigo-800 dark:text-indigo-400">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field-alias resolvers (same pattern as dashboard fix) ─────────────────────

const resolveSpent = (b: any): number => {
  const candidates = [
    b.spent, b.usedAmount, b.amountSpent, b.amount_spent,
    b.currentSpending, b.current_spending, b.totalSpent,
    b.total_spent, b.used, b.consumed, b.actual,
  ];
  for (const val of candidates) {
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
      const p = parseFloat(val);
      if (!isNaN(p)) return p;
    }
  }
  return 0;
};

const resolveLimit = (b: any): number => {
  const candidates = [
    b.budget, b.limit, b.amount, b.budgetAmount, b.budget_amount,
    b.targetAmount, b.target_amount, b.monthlyLimit, b.monthly_limit,
    b.allocatedAmount, b.allocated_amount, b.budgeted,
  ];
  for (const val of candidates) {
    if (typeof val === "number" && !isNaN(val) && val > 0) return val;
    if (typeof val === "string" && val.trim() !== "") {
      const p = parseFloat(val);
      if (!isNaN(p) && p > 0) return p;
    }
  }
  return 0;
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [transactions, budgets] = await Promise.all([
        transactionsAPI.getAll().catch(() => [] as any[]),
        budgetsAPI.getAll().catch(() => [] as any[]),
      ]);

      // ── Income / Expenses ────────────────────────────────────────────────
      const income   = transactions
        .filter((t: any) => t.type === "income")
        .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
      const expenses = transactions
        .filter((t: any) => t.type === "expense")
        .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

      // ── Budget totals (✅ uses resolveLimit/resolveSpent aliases) ────────
      const totalBudget = budgets.reduce((s: number, b: any) => s + resolveLimit(b), 0);
      const totalSpent  = budgets.reduce((s: number, b: any) => s + resolveSpent(b), 0);

      // ── Savings ──────────────────────────────────────────────────────────
      const savings = transactions
        .filter(
          (t: any) =>
            t.category?.toLowerCase().includes("savings") ||
            t.type === "savings"
        )
        .reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);

      // ── Debt ─────────────────────────────────────────────────────────────
      const debt = transactions
        .filter(
          (t: any) =>
            ["debt", "loan", "credit card"].some((k) =>
              t.category?.toLowerCase().includes(k)
            ) || t.type === "debt"
        )
        .reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);

      // ── Emergency fund ───────────────────────────────────────────────────
      const emergency = transactions
        .filter(
          (t: any) =>
            t.category?.toLowerCase().includes("emergency") ||
            t.type === "emergency"
        )
        .reduce((s: number, t: any) => s + Math.abs(t.amount ?? 0), 0);

      // ── Payment history ──────────────────────────────────────────────────
      const payments = transactions.filter(
        (t: any) =>
          t.type === "payment" ||
          ["bill", "payment"].some((k) => t.category?.toLowerCase().includes(k))
      );
      // A payment is "on time" when: explicitly flagged, not marked late, or no status at all
      const onTime = payments.filter(
        (t: any) => t.status === "on-time" || t.onTime === true || (!t.late && t.status !== "late")
      ).length;

      if (transactions.length === 0 && budgets.length === 0) {
        setError(
          "No financial data found. Add transactions and budgets to see your health score."
        );
      }

      setFinancialData({
        monthlyIncome:   income,
        monthlyExpenses: expenses,
        totalSavings:    savings,
        totalDebt:       debt,
        emergencyFund:   emergency,
        monthlyBudget:   totalBudget,
        actualSpending:  totalSpent,
        onTimePayments:  onTime,
        totalPayments:   payments.length,
      });
    } catch {
      setError("Failed to load financial data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Calculating your health score…</p>
        </div>
      </div>
    );
  }

  if (error && !financialData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Couldn't Load Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes scorePop {
          0%   { transform: scale(0.8); opacity: 0 }
          70%  { transform: scale(1.05) }
          100% { transform: scale(1);   opacity: 1 }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-7">

          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-violet-500 uppercase tracking-widest">
                Wellness
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              Financial Health Score
            </h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Comprehensive analysis of your financial wellness.
            </p>
          </div>

          {/* Warning banner (data exists but is incomplete) */}
          {error && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
            </div>
          )}

          {financialData && <FinancialHealthScore data={financialData} />}

        </div>
      </div>
    </>
  );
}