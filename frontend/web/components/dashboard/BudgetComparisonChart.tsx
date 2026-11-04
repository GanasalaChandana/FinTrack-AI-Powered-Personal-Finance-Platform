"use client";
import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BudgetData {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
}

interface BudgetComparisonChartProps {
  data: BudgetData[];
  /** Optional: called when a bar is clicked — lets parent navigate to that category */
  onCategoryClick?: (category: string) => void;
  /** Optional: called when the "Add Budget" CTA is clicked */
  onAddBudget?: () => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const formatAxisTick = (value: number): string => {
  if (value === 0) return "$0";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);

// ── Custom tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const budget = payload.find((p) => p.name === "Budget")?.value ?? 0;
  const spent  = payload.find((p) => p.name === "Spent")?.value  ?? 0;
  const pct    = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const isOver = spent > budget;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-lg min-w-[180px]">
      <p className="font-bold text-gray-900 mb-3 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between items-center gap-4 mb-1.5">
          <span className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.fill }} />
            {entry.name}
          </span>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(entry.value)}</span>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Usage</span>
          <span className={`text-xs font-bold ${isOver ? "text-red-600" : "text-emerald-600"}`}>
            {pct}% {isOver ? "⚠ Over" : "✓ OK"}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        {isOver && (
          <p className="mt-2 text-[10px] text-red-500 font-semibold">
            Over by {formatCurrency(spent - budget)}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Active bar shape (highlights clicked category) ────────────────────────────

const ActiveBar = (props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) => {
  const { x, y, width, height, fill } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />
      {/* subtle left accent */}
      <rect x={x} y={y} width={3} height={height} fill={fill} opacity={0.6} rx={1} />
    </g>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export function BudgetComparisonChart({
  data,
  onCategoryClick,
  onAddBudget,
}: BudgetComparisonChartProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const overBudget = data.filter((d) => d.spent > d.budget);
  const onTrack    = data.filter((d) => d.spent <= d.budget);

  // ── FIX: safe xAxisMax — avoids Math.max(...[]) = -Infinity ──────────────
  const allValues = data.flatMap((d) => [d.budget, d.spent]);
  const maxValue  = allValues.length > 0 ? Math.max(...allValues) : 100;
  const xAxisMax  = Math.ceil(maxValue * 1.15);

  // Derived footer stats
  const totalBudget    = data.reduce((s, d) => s + d.budget, 0);
  const totalSpent     = data.reduce((s, d) => s + d.spent, 0);
  const totalRemaining = data.reduce((s, d) => s + Math.max(0, d.budget - d.spent), 0);
  const overallPct     = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const handleBarClick = (barData: { activePayload?: { payload: { category: string } }[] } | null) => {
    if (!barData?.activePayload?.[0]) return;
    const category = barData.activePayload[0].payload.category as string;
    setActiveCategory((prev) => (prev === category ? null : category));
    onCategoryClick?.(category);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Budget vs Actual</h3>
          <p className="text-sm text-gray-500 mt-0.5">Current month comparison</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {onTrack.length > 0 && (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              {onTrack.length} on track
            </span>
          )}
          {overBudget.length > 0 && (
            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
              {overBudget.length} over budget
            </span>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {data.length === 0 ? (
        <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 gap-3">
          <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">No budget data yet</p>
            <p className="text-xs text-gray-400 mt-1">Set spending limits to track your progress</p>
          </div>
          {onAddBudget && (
            <button
              onClick={onAddBudget}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + Add Budget
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Chart ── */}
          <ResponsiveContainer width="100%" height={Math.max(250, data.length * 72)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              barCategoryGap="30%"
              barGap={4}
              onClick={handleBarClick}
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />

              <XAxis
                type="number"
                domain={[0, xAxisMax]}
                tickFormatter={formatAxisTick}
                stroke="#d1d5db"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                type="category"
                dataKey="category"
                stroke="#d1d5db"
                tick={({ x, y, payload }) => {
                  const isActive = activeCategory === payload.value;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={4}
                      textAnchor="end"
                      fill={isActive ? "#4f46e5" : "#374151"}
                      fontSize={13}
                      fontWeight={isActive ? 700 : 500}
                    >
                      {payload.value}
                    </text>
                  );
                }}
                width={110}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Legend
                wrapperStyle={{ paddingTop: "16px", fontSize: "13px" }}
                iconType="circle"
                iconSize={8}
              />

              {/* Budget bar — gray baseline */}
              <Bar
                dataKey="budget"
                fill="#e2e8f0"
                name="Budget"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`budget-cell-${index}`}
                    fill={activeCategory === entry.category ? "#cbd5e1" : "#e2e8f0"}
                  />
                ))}
              </Bar>

              {/* Spent bar — green under, red over */}
              <Bar
                dataKey="spent"
                name="Spent"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
                shape={<ActiveBar />}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`spent-cell-${index}`}
                    fill={
                      activeCategory === entry.category
                        ? entry.spent > entry.budget ? "#dc2626" : "#059669"
                        : entry.spent > entry.budget ? "#ef4444" : "#10b981"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Click hint */}
          {onCategoryClick && (
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Click a bar to filter transactions by category
            </p>
          )}

          {/* ── Footer summary ── */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Total Budget</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{formatCurrency(totalBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Spent</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{formatCurrency(totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrency(totalRemaining)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Used</p>
                <p className={`text-sm font-bold mt-0.5 ${overallPct > 100 ? "text-red-600" : overallPct > 80 ? "text-amber-600" : "text-gray-800"}`}>
                  {overallPct}%
                </p>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallPct > 100 ? "bg-red-500" : overallPct > 80 ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(overallPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">$0</span>
              <span className="text-[10px] text-gray-400">{formatCurrency(totalBudget)}</span>
            </div>

            {/* Over-budget callout */}
            {overBudget.length > 0 && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs text-red-700 font-semibold">
                  ⚠ {overBudget.map((b) => b.category).join(", ")} {overBudget.length === 1 ? "is" : "are"} over budget
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}