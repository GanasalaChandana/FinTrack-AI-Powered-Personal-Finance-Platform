"use client";

import { useState, useMemo } from "react";
import { Trophy, Plus, X, Flame, Target, CheckCircle } from "lucide-react";
import { type Transaction } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  type: "spend-limit" | "category-limit" | "no-spend-days";
  title: string;
  category?: string;
  limitAmount?: number;
  targetDays?: number;
  startDate: string;
  endDate: string;
}

const CHALLENGE_KEY = "fintrack-challenges";

function loadChallenges(): Challenge[] {
  try { return JSON.parse(localStorage.getItem(CHALLENGE_KEY) ?? "[]"); } catch { return []; }
}
function saveChallenges(cs: Challenge[]) {
  try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(cs)); } catch {}
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysLeft(endDate: string): number {
  const end = new Date(endDate + "T23:59:59");
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

function evaluateChallenge(c: Challenge, transactions: Transaction[]) {
  const inRange = transactions.filter(t => {
    const d = (t.date ?? "").slice(0, 10);
    return d >= c.startDate && d <= c.endDate;
  });
  const expenses = inRange.filter(t => t.type === "expense" || t.type === "EXPENSE");

  if (c.type === "spend-limit") {
    const spent = expenses.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const limit = c.limitAmount ?? 0;
    return { spent, target: limit, pct: Math.min(100, limit > 0 ? (spent / limit) * 100 : 0), success: spent <= limit, label: `${fmt(spent)} of ${fmt(limit)}` };
  }
  if (c.type === "category-limit") {
    const spent = expenses
      .filter(t => (t.category ?? "").toLowerCase() === (c.category ?? "").toLowerCase())
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const limit = c.limitAmount ?? 0;
    return { spent, target: limit, pct: Math.min(100, limit > 0 ? (spent / limit) * 100 : 0), success: spent <= limit, label: `${fmt(spent)} of ${fmt(limit)} on ${c.category}` };
  }
  // no-spend-days
  const start = new Date(c.startDate + "T00:00:00");
  const end   = new Date(c.endDate   + "T00:00:00");
  const today = new Date(todayStr()  + "T00:00:00");
  const spendDays = new Set(expenses.map(t => (t.date ?? "").slice(0, 10)));
  let noSpendCount = 0;
  const cursor = new Date(start);
  while (cursor <= end && cursor <= today) {
    if (!spendDays.has(cursor.toISOString().slice(0, 10))) noSpendCount++;
    cursor.setDate(cursor.getDate() + 1);
  }
  const target = c.targetDays ?? 0;
  return { spent: noSpendCount, target, pct: Math.min(100, target > 0 ? (noSpendCount / target) * 100 : 0), success: noSpendCount >= target, label: `${noSpendCount} / ${target} no-spend days` };
}

// ── Create Modal ──────────────────────────────────────────────────────────────

const CATEGORIES = ["Food & Dining", "Transportation", "Shopping", "Entertainment", "Bills & Utilities", "Healthcare", "Travel", "Personal Care", "Other"];
const DURATIONS  = [7, 14, 30];

function CreateModal({ onSave, onClose }: { onSave: (c: Challenge) => void; onClose: () => void }) {
  const [type, setType]     = useState<Challenge["type"]>("spend-limit");
  const [title, setTitle]   = useState("");
  const [category, setCat]  = useState("Food & Dining");
  const [amount, setAmount] = useState("");
  const [noDays, setNoDays] = useState("5");
  const [dur, setDur]       = useState(30);
  const inp = "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const handleSave = () => {
    if (!title.trim()) return;
    const start  = todayStr();
    const endDt  = new Date();
    endDt.setDate(endDt.getDate() + dur - 1);
    const c: Challenge = {
      id: Date.now().toString(),
      type,
      title: title.trim(),
      category:    type === "category-limit" ? category : undefined,
      limitAmount: type !== "no-spend-days"  ? (parseFloat(amount) || 0) : undefined,
      targetDays:  type === "no-spend-days"  ? (parseInt(noDays)   || 5) : undefined,
      startDate: start,
      endDate:   endDt.toISOString().slice(0, 10),
    };
    onSave(c);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">New Spending Challenge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Challenge Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "spend-limit",    label: "Total Cap",    desc: "Limit total spending" },
                { key: "category-limit", label: "Category Cap", desc: "Limit one category" },
                { key: "no-spend-days",  label: "No-Spend Days",desc: "Days with zero spending" },
              ] as const).map(({ key, label, desc }) => (
                <button key={key} onClick={() => setType(key)}
                  className={`p-3 rounded-xl border text-left transition-colors ${type === key ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-600 hover:border-indigo-300"}`}>
                  <p className={`text-xs font-bold ${type === key ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200"}`}>{label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Challenge Name</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder='e.g. "No impulse buys this month"' className={inp} />
          </div>

          {/* Category (for category-limit) */}
          {type === "category-limit" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Category</label>
              <select value={category} onChange={e => setCat(e.target.value)} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Amount or target days */}
          {type !== "no-spend-days" ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Spending Limit ($)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="200" className={inp} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target No-Spend Days</label>
              <input type="number" value={noDays} onChange={e => setNoDays(e.target.value)} placeholder="5" min="1" className={inp} />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDur(d)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition ${dur === d ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300"}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">Start Challenge</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function SpendingChallengeCard({ transactions }: { transactions: Transaction[] }) {
  const [challenges, setChallenges] = useState<Challenge[]>(() => loadChallenges());
  const [showCreate, setShowCreate] = useState(false);

  const today = todayStr();
  const active  = challenges.filter(c => c.endDate >= today);
  const expired = challenges.filter(c => c.endDate < today);

  const results = useMemo(
    () => active.map(c => ({ ...c, eval: evaluateChallenge(c, transactions) })),
    [active, transactions]
  );

  const add = (c: Challenge) => {
    const next = [...challenges, c];
    setChallenges(next);
    saveChallenges(next);
  };

  const remove = (id: string) => {
    const next = challenges.filter(c => c.id !== id);
    setChallenges(next);
    saveChallenges(next);
  };

  const wins = results.filter(r => r.eval.success).length;

  return (
    <>
      {showCreate && <CreateModal onSave={add} onClose={() => setShowCreate(false)} />}

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right, #f97316, #ef4444)" }} />
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Gamification</p>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 leading-tight">Spending Challenges</h3>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-8">
              <Flame className="w-10 h-10 text-orange-200 dark:text-orange-800 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No active challenges</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a challenge to build better spending habits</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-3 px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition">
                Start a Challenge
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Win count */}
              {wins > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {wins} challenge{wins !== 1 ? "s" : ""} on track! 🎉
                  </p>
                </div>
              )}

              {results.map(r => {
                const { eval: ev } = r;
                const isWinning  = ev.success;
                const isExpiring = daysLeft(r.endDate) <= 2;
                const barColor   = isWinning ? "#10b981" : ev.pct > 80 ? "#f97316" : "#ef4444";
                return (
                  <div key={r.id} className={`p-4 rounded-2xl border ${isWinning ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-gray-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/30"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{r.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ev.label}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isExpiring && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 animate-pulse">
                            {daysLeft(r.endDate) === 0 ? "Ends today" : `${daysLeft(r.endDate)}d left`}
                          </span>
                        )}
                        {!isExpiring && daysLeft(r.endDate) > 0 && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{daysLeft(r.endDate)}d left</span>
                        )}
                        <button onClick={() => remove(r.id)} className="p-1 text-gray-300 dark:text-gray-500 hover:text-red-500 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${ev.pct}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {r.type === "no-spend-days" ? "Days earned" : "Amount used"}
                      </span>
                      <span className={`text-[10px] font-bold ${isWinning ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {isWinning ? "✓ On track" : `${ev.pct.toFixed(0)}% used`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {expired.length > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center pt-1">
                  + {expired.length} completed challenge{expired.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
