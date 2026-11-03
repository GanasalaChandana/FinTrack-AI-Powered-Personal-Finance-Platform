"use client";
import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface CategoryPieChartProps {
  data: CategoryData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

const CustomTooltip = ({ active, payload, total }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percentage = ((data.value / total) * 100).toFixed(1);
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border-2 border-gray-200">
        <p className="font-bold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {formatCurrency(data.value)} ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);


  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">Spending by Category</h3>
        <p className="text-sm text-gray-600">Where your money goes</p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {data.slice(0, 6).map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
            />
            <span className="text-sm text-gray-700">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}