"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Income vs Expenses Comparison Chart
export interface MonthComparison { month: string; income: number; expenses: number; savings: number }

export function IncomeExpenseComparison({ data }: { data: MonthComparison[] }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 text-xl font-bold text-gray-900">Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="income"
            fill="#10b981"
            stroke="#10b981"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            fill="#ef4444"
            stroke="#ef4444"
            fillOpacity={0.3}
          />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Spending Pattern Radar Chart
