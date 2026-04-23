"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown,
  DollarSign, Loader2, X, Clock,
} from "lucide-react";
import { transactionsAPI, type Transaction } from "@/lib/api";
import { detectRecurring } from "@/lib/utils/recurringDetection";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface DayData {
  income: number;
  expenses: number;
  transactions: Transaction[];
  upcomingBills: Array<{ merchant: string; amount: number; isSubscription: boolean }>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [view, setView] = useState<"month" | "year">("month");
  const [yearView, setYearView] = useState(today.getFullYear());

  useEffect(() => {
    transactionsAPI.getAll()
      .then((data: Transaction[]) => setTransactions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const goBack = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
    setSelectedDay(null);
  };
  const goForward = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Build recurring/upcoming bills for this month
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);

  // Build day-level data map
  const dayMap = useMemo<Map<string, DayData>>(() => {
    const map = new Map<string, DayData>();

    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { income: 0, expenses: 0, transactions: [], upcomingBills: [] });
      return map.get(key)!;
    };

    // Place actual transactions
    transactions.forEach(t => {
      const raw = t.date?.split("T")[0] ?? "";
      if (!raw) return;
      const d = ensure(raw);
      if (t.type === "income" || t.type === "INCOME") d.income += Math.abs(t.amount);
      else d.expenses += Math.abs(t.amount);
      d.transactions.push(t);
    });

    // Place upcoming bills (project nextExpected into this month's calendar)
    recurring.items.forEach(item => {
      if (!item.nextExpected) return;
      const next = item.nextExpected.split("T")[0];
      const [y, m] = next.split("-").map(Number);
      if (y === currentYear && m - 1 === currentMonth) {
        const d = ensure(next);
        d.upcomingBills.push({
          merchant: item.merchant,
          amount: item.amount,
          isSubscription: item.isSubscription,
        });
      }
    });

    return map;
  }, [transactions, recurring, currentYear, currentMonth]);

  // Calendar grid
  const totalDays = daysInMonth(currentYear, currentMonth);
  const startDay = startDayOfMonth(currentYear, currentMonth);
  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    let income = 0; let expenses = 0;
    dayMap.forEach(d => { income += d.income; expenses += d.expenses; });
    return { income, expenses, net: income - expenses };
  }, [dayMap]);

  // Heatmap: max daily expense this month (for intensity scaling)
  const maxDailyExpense = useMemo(() => {
    let max = 0;
    dayMap.forEach(d => { if (d.expenses > max) max = d.expenses; });
    return max;
  }, [dayMap]);

  // Year view: daily expense map for the selected year (52×7 grid)
  const yearHeatmap = useMemo(() => {
    // Build day-by-day expense totals for the whole year
    const dayExp: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type === "expense" || t.type === "EXPENSE") {
        const d = (t.date ?? "").slice(0, 10);
        if (d.startsWith(String(yearView))) {
          dayExp[d] = (dayExp[d] ?? 0) + Math.abs(t.amount ?? 0);
        }
      }
    });

    const maxExp = Math.max(1, ...Object.values(dayExp));

    // Build 53 weeks × 7 days grid starting from Jan 1
    const jan1 = new Date(yearView, 0, 1);
    const startOffset = jan1.getDay(); // 0=Sun
    const dec31 = new Date(yearView, 11, 31);
    const totalDays = Math.floor((dec31.getTime() - jan1.getTime()) / 86_400_000) + 1;

    const cells: { date: string; expenses: number; ratio: number }[] = [];
    // Leading empty cells
    for (let i = 0; i < startOffset; i++) cells.push({ date: "", expenses: 0, ratio: 0 });
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(yearView, 0, 1 + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const exp = dayExp[key] ?? 0;
      cells.push({ date: key, expenses: exp, ratio: exp / maxExp });
    }

    // Month label positions (which column does each month start in)
    const monthLabels: { month: string; col: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(yearView, m, 1);
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000);
      const col = Math.floor((dayOfYear + startOffset) / 7);
      monthLabels.push({ month: MONTH_NAMES[m].slice(0, 3), col });
    }

    return { cells, maxExp, monthLabels, weeks: Math.ceil(cells.length / 7) };
  }, [transactions, yearView]);

  // Selected day panel
  const selectedDateStr = selectedDay ? toDateStr(currentYear, currentMonth, selectedDay) : null;
  const selectedData = selectedDateStr ? dayMap.get(selectedDateStr) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading calendar…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Financial Calendar
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Transactions by day with upcoming bills</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
              {(["month", "year"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    view === v
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {v === "month" ? "Month" : "Year"}
                </button>
              ))}
            </div>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Today
            </button>
          </div>
        </div>

        {/* Monthly summary chips */}
        {(() => {
          const chipStyles: Record<string, { wrap: string; text: string }> = {
            emerald: { wrap: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", text: "text-emerald-600 dark:text-emerald-400" },
            red:     { wrap: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",                text: "text-red-600 dark:text-red-400" },
            indigo:  { wrap: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",   text: "text-indigo-600 dark:text-indigo-400" },
            orange:  { wrap: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",   text: "text-orange-600 dark:text-orange-400" },
          };
          const chips = [
            { label: "Income",   value: monthlySummary.income,   color: "emerald", icon: <TrendingUp className="w-4 h-4" /> },
            { label: "Expenses", value: monthlySummary.expenses, color: "red",     icon: <TrendingDown className="w-4 h-4" /> },
            { label: "Net",      value: monthlySummary.net,      color: monthlySummary.net >= 0 ? "indigo" : "orange", icon: <DollarSign className="w-4 h-4" /> },
          ];
          return (
        <div className="grid grid-cols-3 gap-3">
          {chips.map(({ label, value, color, icon }) => {
            const s = chipStyles[color];
            return (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.wrap}`}>
                {icon}
              </span>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className={`text-base font-bold ${s.text}`}>{fmt(Math.abs(value))}</p>
              </div>
            </div>
            );
          })}
        </div>
          );
        })()}

        {/* ── Year Heatmap View ── */}
        {view === "year" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 overflow-x-auto">
            {/* Year nav */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {yearView} Spending Heatmap
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Each cell is a day — darker red = higher spend
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setYearView(y => y - 1)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-10 text-center">{yearView}</span>
                <button
                  onClick={() => setYearView(y => y + 1)}
                  className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Month labels */}
            <div className="flex mb-1 pl-6" style={{ minWidth: `${yearHeatmap.weeks * 13}px` }}>
              {yearHeatmap.monthLabels.map(({ month, col }) => (
                <span
                  key={month}
                  className="text-[10px] text-gray-400 dark:text-gray-500 font-medium absolute"
                  style={{ left: `${col * 13 + 24}px`, position: "relative" }}
                >
                  {month}
                </span>
              ))}
            </div>

            {/* Grid: columns = weeks, rows = days of week */}
            <div
              className="grid gap-[3px] relative"
              style={{
                gridTemplateColumns: `repeat(${yearHeatmap.weeks}, 10px)`,
                gridTemplateRows: "repeat(7, 10px)",
                gridAutoFlow: "column",
                minWidth: `${yearHeatmap.weeks * 13}px`,
              }}
            >
              {yearHeatmap.cells.map((cell, idx) => (
                <div
                  key={idx}
                  title={cell.date ? `${cell.date}: ${cell.expenses > 0 ? `$${cell.expenses.toFixed(0)}` : "No spend"}` : ""}
                  className="w-[10px] h-[10px] rounded-[2px] cursor-default"
                  style={{
                    backgroundColor: !cell.date
                      ? "transparent"
                      : cell.expenses === 0
                        ? "rgba(203,213,225,0.35)"
                        : `rgba(239,68,68,${(0.15 + cell.ratio * 0.75).toFixed(3)})`,
                  }}
                />
              ))}
            </div>

            {/* Day labels */}
            <div className="flex flex-col gap-[3px] absolute left-2 mt-[-94px] text-[9px] text-gray-400 dark:text-gray-600 space-y-0">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <span key={i} className="h-[10px] leading-[10px] w-3 text-center">{i % 2 === 1 ? d : ""}</span>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Less</span>
              {[0.1, 0.25, 0.45, 0.65, 0.9].map((a, i) => (
                <span
                  key={i}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: `rgba(239,68,68,${a})`, display: "inline-block" }}
                />
              ))}
              <span>More</span>
              <span className="ml-4 text-gray-400 dark:text-gray-500">
                Max single day: ${yearHeatmap.maxExp > 1 ? yearHeatmap.maxExp.toFixed(0) : "0"}
              </span>
            </div>
          </div>
        )}

        {/* Calendar card — Month view */}
        {view === "year" ? null : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={goBack}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={goForward}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {DAY_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="border-b border-r border-gray-100 dark:border-gray-800 h-24 bg-gray-50/50 dark:bg-gray-900/20" />;
              }

              const dateStr = toDateStr(currentYear, currentMonth, day);
              const data = dayMap.get(dateStr);
              const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;
              const isSelected = day === selectedDay;
              const hasIncome = (data?.income ?? 0) > 0;
              const hasExpenses = (data?.expenses ?? 0) > 0;
              const hasBills = (data?.upcomingBills?.length ?? 0) > 0;
              const isPast = new Date(currentYear, currentMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isFuture = !isPast && !isToday;

              // Heatmap intensity: 0 → no color, 1 → deep red
              const heatRatio = maxDailyExpense > 0 && hasExpenses
                ? (data!.expenses / maxDailyExpense)
                : 0;
              // Use inline style — safe from Tailwind purge
              const heatStyle = heatRatio > 0 && !isSelected
                ? { backgroundColor: `rgba(239,68,68,${(0.07 + heatRatio * 0.28).toFixed(3)})` }
                : {};

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  style={heatStyle}
                  className={`relative h-24 p-1.5 text-left border-b border-r border-gray-100 dark:border-gray-800 transition-colors focus:outline-none ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-900/20"
                      : heatRatio === 0 ? "hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
                  } ${isFuture && !hasBills ? "opacity-60" : ""}`}
                >
                  {/* Day number */}
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                    isToday
                      ? "bg-indigo-600 text-white"
                      : isSelected
                        ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {day}
                  </span>

                  {/* Amounts */}
                  <div className="mt-1 space-y-0.5">
                    {hasIncome && (
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate leading-none">
                        +{fmt(data!.income)}
                      </div>
                    )}
                    {hasExpenses && (
                      <div className="text-[10px] font-semibold text-red-600 dark:text-red-400 truncate leading-none">
                        -{fmt(data!.expenses)}
                      </div>
                    )}
                  </div>

                  {/* Dot indicators */}
                  <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">
                    {hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {hasExpenses && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    {hasBills && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )} {/* end month view */}

        {/* Legend — only in month view */}
        {view === "month" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          {[
            { color: "bg-emerald-500", label: "Income" },
            { color: "bg-red-500", label: "Expenses" },
            { color: "bg-orange-400", label: "Upcoming bill" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              {label}
            </span>
          ))}
          {/* Heatmap gradient legend */}
          <span className="flex items-center gap-1.5 ml-1">
            <span className="text-gray-400 dark:text-gray-500">Spend intensity:</span>
            <span className="flex items-center gap-0.5">
              {[0.1, 0.22, 0.35].map((alpha, i) => (
                <span
                  key={i}
                  className="w-3.5 h-3.5 rounded-sm"
                  style={{ backgroundColor: `rgba(239,68,68,${alpha})` }}
                />
              ))}
            </span>
            <span className="text-gray-400 dark:text-gray-500">low → high</span>
          </span>
        </div>
        )} {/* end legend */}

        {/* Selected day panel — month view only */}
        {view === "month" && selectedDay && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedData?.transactions.length ?? 0} transaction(s) · {selectedData?.upcomingBills.length ?? 0} upcoming bill(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(!selectedData || (selectedData.transactions.length === 0 && selectedData.upcomingBills.length === 0)) ? (
              <div className="py-10 text-center">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No activity on this day</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* Actual transactions */}
                {selectedData?.transactions.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map((t, i) => {
                  const isIncome = t.type === "income" || t.type === "INCOME";
                  return (
                    <div key={`txn-${t.id ?? i}`} className="flex items-center gap-3 px-5 py-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isIncome
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      }`}>
                        {(t.merchant || t.description || "?")[0].toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {t.merchant || t.description || "Transaction"}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{t.category || "Uncategorized"}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isIncome ? "+" : "-"}{fmt(Math.abs(t.amount))}
                      </span>
                    </div>
                  );
                })}

                {/* Upcoming bills */}
                {selectedData?.upcomingBills.map((bill, i) => (
                  <div key={`bill-${i}`} className="flex items-center gap-3 px-5 py-3 bg-orange-50/50 dark:bg-orange-900/10">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {bill.merchant}
                        </p>
                        {bill.isSubscription && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                            Sub
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-orange-500 dark:text-orange-400">Upcoming bill</p>
                    </div>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400 shrink-0">
                      -{fmt(bill.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )} {/* end selectedDay panel */}

      </div>
    </div>
  );
}
