"use client";

// SpendingByDayCard — shows average spending by day of week.
// Answers "which day do I spend the most?" at a glance on the dashboard.

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { Transaction } from "@/lib/api";

interface Props {
  transactions: Transaction[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
  }).format(v);

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-700 dark:text-gray-200">{label}</p>
      <p className="text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
        Avg {fmt(payload[0]?.value ?? 0)}/visit
      </p>
      <p className="text-gray-400 dark:text-gray-500 mt-0.5">
        {payload[0]?.payload?.count} transactions
      </p>
    </div>
  );
}

export function SpendingByDayCard({ transactions }: Props) {
  const data = useMemo(() => {
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);

    transactions
      .filter((t) => t.type === "expense" || t.type === "EXPENSE")
      .forEach((t) => {
        // Use T00:00:00 to avoid UTC shift when parsing date-only strings
        const d = new Date(`${(t.date ?? "").slice(0, 10)}T00:00:00`).getDay();
        totals[d] += Math.abs(t.amount ?? 0);
        counts[d]++;
      });

    return DAYS.map((day, i) => ({
      day,
      avg:   counts[i] > 0 ? Math.round((totals[i] / counts[i]) * 100) / 100 : 0,
      total: Math.round(totals[i] * 100) / 100,
      count: counts[i],
      isWeekend: i === 0 || i === 6,
    }));
  }, [transactions]);

  const maxDay = data.reduce(
    (best, d) => (d.avg > best.avg ? d : best),
    { avg: 0, day: "" }
  );

  const hasData = data.some((d) => d.avg > 0);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(to right,#f59e0b,#f97316)" }} />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <CalendarDays className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Spending by Day of Week
              </h3>
              {hasData && maxDay.avg > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Peak: <span className="font-semibold text-amber-600 dark:text-amber-400">{maxDay.day}</span>
                  {" "}(avg {fmt(maxDay.avg)})
                </p>
              )}
            </div>
          </div>

          {/* Weekend vs weekday legend */}
          <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />
              Weekend
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
              Weekday
            </span>
          </div>
        </div>

        {/* Chart */}
        {hasData ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.isWeekend
                        ? "#f97316"
                        : entry.day === maxDay.day
                        ? "#6366f1"
                        : "#c7d2fe"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-center">
            <CalendarDays className="w-8 h-8 text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add more transactions to see patterns
            </p>
          </div>
        )}

        {/* Day-by-day mini table */}
        {hasData && (
          <div className="grid grid-cols-7 gap-1 text-center">
            {data.map((d) => (
              <div key={d.day} className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase">
                  {d.day.slice(0, 2)}
                </span>
                <span className={`text-[10px] font-bold ${
                  d.day === maxDay.day
                    ? "text-indigo-600 dark:text-indigo-400"
                    : d.isWeekend
                    ? "text-orange-500"
                    : "text-gray-600 dark:text-gray-300"
                }`}>
                  {d.avg > 0 ? `$${d.avg.toFixed(0)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
