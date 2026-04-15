"use client";
import React from 'react';
import { Target, TrendingUp } from 'lucide-react';

// Map goal.color strings to safe inline CSS gradients (avoids Tailwind purge in prod)
const GOAL_GRADIENT: Record<string, string> = {
  'from-blue-500 to-blue-600':     'linear-gradient(to right,#3B82F6,#2563EB)',
  'from-green-500 to-green-600':   'linear-gradient(to right,#10B981,#059669)',
  'from-purple-500 to-purple-600': 'linear-gradient(to right,#8B5CF6,#7C3AED)',
  'from-orange-500 to-orange-600': 'linear-gradient(to right,#F97316,#EA580C)',
  'from-pink-500 to-pink-600':     'linear-gradient(to right,#EC4899,#DB2777)',
  'from-indigo-500 to-indigo-600': 'linear-gradient(to right,#6366F1,#4F46E5)',
  'from-red-500 to-red-600':       'linear-gradient(to right,#EF4444,#DC2626)',
  'from-yellow-500 to-yellow-600': 'linear-gradient(to right,#EAB308,#CA8A04)',
  'from-teal-500 to-teal-600':     'linear-gradient(to right,#14B8A6,#0D9488)',
  'from-cyan-500 to-cyan-600':     'linear-gradient(to right,#06B6D4,#0891B2)',
};
const COMPLETE_GRADIENT = 'linear-gradient(to right,#10B981,#059669)';
const FALLBACK_GRADIENT = 'linear-gradient(to right,#6366F1,#4F46E5)';

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  icon: string;
  color: string;
}

interface GoalProgressChartProps {
  goals: Goal[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

export function GoalProgressChart({ goals }: GoalProgressChartProps) {
  const sortedGoals = [...goals].sort((a, b) => {
    const progressA = (a.current / a.target) * 100;
    const progressB = (b.current / b.target) * 100;
    return progressB - progressA;
  });

  const averageProgress = goals.length > 0
    ? goals.reduce((sum, goal) => sum + (goal.current / goal.target) * 100, 0) / goals.length
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Savings Goals Progress</h3>
          <p className="text-sm text-gray-600">{goals.length} active goals</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-bold">{averageProgress.toFixed(0)}% avg</span>
        </div>
      </div>

      <div className="space-y-4">
        {sortedGoals.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No active goals</p>
          </div>
        ) : (
          sortedGoals.map((goal) => {
            const progress = (goal.current / goal.target) * 100;
            const isComplete = progress >= 100;

            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{goal.icon}</span>
                    <span className="font-semibold text-gray-900">{goal.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-600">
                    {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                  </span>
                </div>
                <div className="relative">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        background: isComplete ? COMPLETE_GRADIENT : (GOAL_GRADIENT[goal.color] ?? FALLBACK_GRADIENT),
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-700">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}