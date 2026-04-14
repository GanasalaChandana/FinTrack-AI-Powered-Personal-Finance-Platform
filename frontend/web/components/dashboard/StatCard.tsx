'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface StatCardProps {
  title: string;
  value: string;
  change?: number | null;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'accent';
  description?: string;
  /** Optional sparkline — array of { v: number } for the last N months */
  sparklineData?: { v: number }[];
  /** Navigate when card is clicked */
  onClick?: () => void;
}

const snapZero = (n: number): number => (Math.abs(n) < 0.05 ? 0 : n);

// Use inline styles for gradients — dynamic Tailwind class strings get purged in production
const colorGradientMap: Record<string, string> = {
  primary: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
  success: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  error:   'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  warning: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  accent:  'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
};

const sparkColorMap: Record<string, string> = {
  primary: '#6366F1',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  accent: '#06B6D4',
};

const SparkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 text-[10px] font-bold px-2 py-1 rounded-sm shadow-lg pointer-events-none">
      ${Number(payload[0].value).toLocaleString()}
    </div>
  );
};

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color = 'primary',
  description,
  sparklineData,
  onClick,
}: StatCardProps) {
  const snapped = change != null ? snapZero(change) : null;

  const isPositive = snapped !== null && snapped > 0;
  const isNegative = snapped !== null && snapped < 0;
  const isZero = snapped !== null && snapped === 0;
  const showBadge = snapped !== null && !isZero;

  const badgeVariant = isPositive ? 'success' : isNegative ? 'error' : 'neutral';
  const badgeStyles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    error:   'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  };

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  const iconGradient = colorGradientMap[color];
  const sparkColor = sparkColorMap[color];

  const hasSparkline = Array.isArray(sparklineData) && sparklineData.length >= 2;

  return (
    <div
      className={`
        bg-white dark:bg-neutral-800
        rounded-md
        shadow-sm dark:shadow-sm
        border border-neutral-200 dark:border-neutral-700
        p-6
        transition-all duration-300
        ${onClick ? 'hover:shadow-md dark:hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md dark:hover:shadow-md'}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: iconGradient }}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {showBadge && (
          <div
            className={`
              flex items-center gap-1
              px-2.5 py-1
              rounded-sm
              text-xs font-semibold
              ${badgeStyles[badgeVariant]}
            `}
          >
            <TrendIcon className="w-3 h-3" />
            {isPositive && '+'}
            {snapped!.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{value}</p>
        {description && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{description}</p>
        )}
      </div>

      {hasSparkline && (
        <div className="h-12 -mx-2 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Tooltip content={<SparkTooltip />} cursor={false} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: sparkColor, stroke: 'white', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}