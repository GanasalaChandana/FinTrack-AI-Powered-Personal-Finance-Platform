"use client";
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SpendingData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface SpendingTrendChartProps {
  data: SpendingData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const latestMonth = data[data.length - 1];
  const previousMonth = data[data.length - 2];

  // ✅ Guard: only calculate trend if previous expenses > 0
  const trend: number | null =
    previousMonth && previousMonth.expenses > 0
      ? ((latestMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
      : null;

  const isIncreasing = trend !== null && trend > 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Income vs Expenses</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Last 6 months overview</p>
        </div>

        {/* ✅ Badge: only shows % when previous data exists */}
        {trend !== null ? (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            isIncreasing ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {isIncreasing ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-bold">
              {isIncreasing ? '+' : ''}{trend.toFixed(1)}% vs last month
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
            <Minus className="w-4 h-4" />
            <span className="text-sm font-medium">No previous data</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            stroke="#9ca3af"
            style={{ fontSize: '12px', fill: '#9ca3af' }}
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: '12px', fill: '#9ca3af' }}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, white)',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#10b981"
            strokeWidth={3}
            name="Income"
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#ef4444"
            strokeWidth={3}
            name="Expenses"
            dot={{ fill: '#ef4444', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Savings"
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}