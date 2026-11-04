"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Scatter, ScatterChart, ZAxis } from "recharts";

// Income vs Expenses Comparison Chart
export function IncomeExpenseComparison({ data }: { data: any[] }) {
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
export function SpendingPatternRadar({ data }: { data: any[] }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 text-xl font-bold text-gray-900">Spending Patterns</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="category" />
          <PolarRadiusAxis />
          <Radar
            name="This Month"
            dataKey="current"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
          <Radar
            name="Last Month"
            dataKey="previous"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.3}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Transaction Scatter Plot
export function TransactionScatter({ data }: { data: any[] }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 text-xl font-bold text-gray-900">Transaction Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="day" name="Day" />
          <YAxis type="number" dataKey="amount" name="Amount" />
          <ZAxis type="number" dataKey="z" range={[50, 400]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter
            name="Income"
            data={data.filter((d) => d.type === "income")}
            fill="#10b981"
          />
          <Scatter
            name="Expenses"
            data={data.filter((d) => d.type === "expense")}
            fill="#ef4444"
          />
          <Legend />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
