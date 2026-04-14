"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CreditCard, Plus, Trash2, TrendingDown, DollarSign, Calendar, Zap, Target } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Debt {
  id: number;
  name: string;
  balance: number;
  interestRate: number; // APR %
  minimumPayment: number;
  color: string;
}

const DEBT_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const LOCAL_KEY = "fintrack-debts";

function loadDebts(): Debt[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
}
function saveDebts(debts: Debt[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(debts)); } catch {}
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Math.abs(v));

// ─── Payoff calculator ─────────────────────────────────────────────────────────

function calcPayoff(balance: number, apr: number, monthlyPayment: number) {
  if (monthlyPayment <= 0 || balance <= 0) return null;
  const monthlyRate = apr / 100 / 12;
  let bal = balance;
  let months = 0;
  let totalInterest = 0;
  const schedule: Array<{ month: number; balance: number; principal: number; interest: number }> = [];

  while (bal > 0 && months < 600) {
    months++;
    const interest = monthlyRate > 0 ? bal * monthlyRate : 0;
    const principal = Math.min(monthlyPayment - interest, bal);
    if (principal <= 0) return null; // payment too low to cover interest
    totalInterest += interest;
    bal = Math.max(0, bal - principal);
    if (months <= 60 || months % 12 === 0) { // keep first 5 years monthly, then yearly
      schedule.push({ month: months, balance: Math.round(bal), principal: Math.round(principal), interest: Math.round(interest) });
    }
  }

  return { months, totalInterest: Math.round(totalInterest), schedule };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebtPayoffPage() {
  const [debts, setDebts] = useState<Debt[]>(() => loadDebts());
  const [extraPayment, setExtraPayment] = useState(0);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", balance: "", interestRate: "", minimumPayment: "" });

  const persist = (next: Debt[]) => { setDebts(next); saveDebts(next); };

  const handleAdd = () => {
    const bal = parseFloat(form.balance);
    const apr = parseFloat(form.interestRate);
    const min = parseFloat(form.minimumPayment);
    if (!form.name.trim() || isNaN(bal) || bal <= 0 || isNaN(apr) || isNaN(min) || min <= 0) return;
    const next: Debt = {
      id: Date.now(),
      name: form.name.trim(),
      balance: bal,
      interestRate: apr,
      minimumPayment: min,
      color: DEBT_COLORS[debts.length % DEBT_COLORS.length],
    };
    persist([...debts, next]);
    setForm({ name: "", balance: "", interestRate: "", minimumPayment: "" });
    setShowAdd(false);
  };

  const handleDelete = (id: number) => persist(debts.filter(d => d.id !== id));

  // Order debts by strategy
  const orderedDebts = useMemo(() => {
    const copy = [...debts];
    if (strategy === "avalanche") copy.sort((a, b) => b.interestRate - a.interestRate); // highest APR first
    else copy.sort((a, b) => a.balance - b.balance); // lowest balance first (snowball)
    return copy;
  }, [debts, strategy]);

  // Aggregate payoff simulation using the chosen strategy
  const simulation = useMemo(() => {
    if (orderedDebts.length === 0) return null;
    const totalMinimum = orderedDebts.reduce((s, d) => s + d.minimumPayment, 0);
    const totalPayment = totalMinimum + extraPayment;

    // Simulate month by month across all debts
    let balances = orderedDebts.map(d => ({ ...d, bal: d.balance }));
    let month = 0;
    let totalInterest = 0;
    const timeline: Array<{ month: number; totalDebt: number; label?: string }> = [];

    while (balances.some(d => d.bal > 0) && month < 600) {
      month++;
      let remaining = totalPayment;

      // Pay minimums first on non-focus debts
      for (let i = 1; i < balances.length; i++) {
        if (balances[i].bal <= 0) continue;
        const rate = balances[i].interestRate / 100 / 12;
        const interest = balances[i].bal * rate;
        totalInterest += interest;
        const payment = Math.min(balances[i].minimumPayment, balances[i].bal + interest);
        balances[i].bal = Math.max(0, balances[i].bal + interest - payment);
        remaining -= payment;
      }

      // Put remaining on focus debt (first in ordered list)
      for (let i = 0; i < balances.length; i++) {
        if (balances[i].bal <= 0) continue;
        const rate = balances[i].interestRate / 100 / 12;
        const interest = balances[i].bal * rate;
        totalInterest += interest;
        const payment = Math.min(remaining, balances[i].bal + interest);
        balances[i].bal = Math.max(0, balances[i].bal + interest - payment);
        remaining -= payment;
        if (remaining <= 0) break;
      }

      const totalDebt = Math.round(balances.reduce((s, d) => s + d.bal, 0));
      if (month <= 24 || month % 6 === 0) {
        timeline.push({ month, totalDebt });
      }
    }

    // Minimum-only scenario for comparison
    let minBalances = orderedDebts.map(d => ({ ...d, bal: d.balance }));
    let minMonths = 0;
    let minInterest = 0;
    while (minBalances.some(d => d.bal > 0) && minMonths < 600) {
      minMonths++;
      for (const d of minBalances) {
        if (d.bal <= 0) continue;
        const rate = d.interestRate / 100 / 12;
        const interest = d.bal * rate;
        minInterest += interest;
        d.bal = Math.max(0, d.bal + interest - d.minimumPayment);
      }
    }

    const years = Math.floor(month / 12);
    const months = month % 12;
    return {
      months: month, years, remainingMonths: months,
      totalInterest: Math.round(totalInterest),
      totalPaid: Math.round(orderedDebts.reduce((s, d) => s + d.balance, 0) + totalInterest),
      timeline,
      minOnlyMonths: minMonths,
      minOnlyInterest: Math.round(minInterest),
      interestSaved: Math.round(minInterest - totalInterest),
      monthsSaved: minMonths - month,
    };
  }, [orderedDebts, extraPayment]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimum = debts.reduce((s, d) => s + d.minimumPayment, 0);

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-red-500" /> Debt Payoff Calculator
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Plan your debt-free journey</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Debt
          </button>
        </div>

        {/* Add Debt Form */}
        {showAdd && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Add a Debt</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Debt name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Visa Card, Student Loan" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Balance ($)</label>
                <input type="number" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} placeholder="5000" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">APR (%)</label>
                <input type="number" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} placeholder="19.99" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min. payment ($/mo)</label>
                <input type="number" value={form.minimumPayment} onChange={e => setForm(p => ({ ...p, minimumPayment: e.target.value }))} placeholder="150" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
              <button onClick={handleAdd} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">Add</button>
            </div>
          </div>
        )}

        {debts.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
            <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No debts added yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add your credit cards, loans, or any debt to see your payoff plan.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
              Add your first debt
            </button>
          </div>
        ) : (
          <>
            {/* Debt list */}
            <div className="grid sm:grid-cols-2 gap-3">
              {debts.map(d => {
                const info = calcPayoff(d.balance, d.interestRate, d.minimumPayment);
                return (
                  <div key={d.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{d.name}</span>
                      </div>
                      <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Balance</p>
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(d.balance)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">APR</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{d.interestRate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Min/mo</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(d.minimumPayment)}</p>
                      </div>
                    </div>
                    {info && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500">
                        Debt-free in <strong className="text-gray-700 dark:text-gray-300">{Math.ceil(info.months / 12)} yr {info.months % 12} mo</strong> · Total interest: <strong className="text-red-500">{fmt(info.totalInterest)}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Strategy + Extra Payment */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Payoff Strategy</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "avalanche", label: "Avalanche", desc: "Highest APR first — saves most interest" },
                      { key: "snowball", label: "Snowball", desc: "Lowest balance first — builds momentum" },
                    ].map(({ key, label, desc }) => (
                      <button
                        key={key}
                        onClick={() => setStrategy(key as any)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          strategy === key
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-gray-200 dark:border-gray-600 hover:border-indigo-300"
                        }`}
                      >
                        <p className={`text-xs font-bold ${strategy === key ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-white"}`}>{label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Extra monthly payment ($)</label>
                  <input
                    type="number"
                    value={extraPayment || ""}
                    onChange={e => setExtraPayment(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Adding extra payment accelerates your payoff significantly.</p>
                </div>
              </div>
            </div>

            {/* Simulation results */}
            {simulation && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Debt-Free In", value: `${simulation.years}y ${simulation.remainingMonths}m`, icon: <Calendar className="w-4 h-4" />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
                    { label: "Total Interest", value: fmt(simulation.totalInterest), icon: <DollarSign className="w-4 h-4" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
                    { label: "Interest Saved", value: fmt(simulation.interestSaved), icon: <TrendingDown className="w-4 h-4" />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                    { label: "Months Saved", value: `${simulation.monthsSaved}`, icon: <Zap className="w-4 h-4" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
                  ].map(({ label, value, icon, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-4 border border-gray-100 dark:border-gray-700`}>
                      <div className={`${color} mb-1.5`}>{icon}</div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className={`text-lg font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Payoff timeline chart */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Debt Payoff Timeline</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Total remaining debt balance over time with {strategy} strategy + {fmt(extraPayment)} extra/month</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={simulation.timeline}>
                      <defs>
                        <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} tickLine={false} label={{ value: "Months", position: "insideBottom", offset: -5, fontSize: 11, fill: "#9ca3af" }} />
                      <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => [fmt(v), "Remaining Debt"]}
                        labelFormatter={v => `Month ${v}`}
                      />
                      <Area type="monotone" dataKey="totalDebt" stroke="#ef4444" strokeWidth={2.5} fill="url(#debtGrad)" name="Remaining Debt" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Payoff order */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Payoff Order ({strategy === "avalanche" ? "Avalanche" : "Snowball"})</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {strategy === "avalanche"
                      ? "Tackle highest interest rate first to minimize total interest paid."
                      : "Tackle smallest balance first to build momentum and motivation."}
                  </p>
                  <div className="space-y-3">
                    {orderedDebts.map((d, i) => {
                      const pct = totalDebt > 0 ? (d.balance / totalDebt) * 100 : 0;
                      return (
                        <div key={d.id} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{d.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{fmt(d.balance)} · {d.interestRate}% APR</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
