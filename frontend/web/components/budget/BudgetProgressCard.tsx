'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2, AlertCircle } from 'lucide-react';
import { type Budget } from '@/lib/api';

interface BudgetProgressCardProps {
  budget: Budget;
  spent?: number;
  onEdit?: (budget: Budget) => void;
  onDelete?: (id: string) => void;
  icon?: string;
}

const getCategoryEmoji = (category: string): string => {
  const emojiMap: Record<string, string> = {
    groceries: '🛒',
    grocery: '🛒',
    transport: '🚗',
    transportation: '🚗',
    car: '🚗',
    entertainment: '🎬',
    utilities: '🏠',
    subscription: '💳',
    shopping: '🛍️',
    gym: '💪',
    health: '🏥',
    dining: '🍽️',
    other: '📌',
  };

  const lower = category.toLowerCase().trim();
  return emojiMap[lower] || '📌';
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);

export function BudgetProgressCard({
  budget,
  spent = 0,
  onEdit,
  onDelete,
  icon,
}: BudgetProgressCardProps) {
  const budgetAmount = budget.budget || 0;
  const spentAmount = Math.min(spent, budgetAmount * 1.2); // Cap at 120% for display
  const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
  const remaining = Math.max(0, budgetAmount - spent);
  const isExceeded = spent > budgetAmount;
  const isWarning = percentage > 75 && percentage <= 100;
  const isAlert = percentage > 100;

  const getProgressColor = () => {
    if (isAlert) return 'bg-error-600';
    if (isWarning) return 'bg-warning-600';
    return 'bg-success-600';
  };

  const getStatusVariant = () => {
    if (isAlert) return 'error';
    if (isWarning) return 'warning';
    return 'success';
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{icon || getCategoryEmoji(budget.category || '')}</span>
            <div className="flex-1 min-w-0">
              <CardTitle size="md">{budget.category || 'Budget'}</CardTitle>
            </div>
          </div>
          {onEdit || onDelete ? (
            <div className="flex gap-1 ml-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Edit2 className="w-4 h-4" />}
                  onClick={() => onEdit(budget)}
                  title="Edit budget"
                />
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => onDelete(budget.id || '')}
                  title="Delete budget"
                />
              )}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Amount Info */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              {formatCurrency(spent)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              of {formatCurrency(budgetAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              {percentage.toFixed(0)}%
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {isExceeded ? (
                <span className="text-error-600 dark:text-error-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Over budget
                </span>
              ) : (
                `${formatCurrency(remaining)} remaining`
              )}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-300`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {/* Status Badge */}
          {isAlert && (
            <div className="flex items-center gap-2 p-2 bg-error-50 dark:bg-error-900 dark:bg-opacity-20 rounded-sm border border-error-200 dark:border-error-800">
              <AlertCircle className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" />
              <p className="text-xs font-medium text-error-700 dark:text-error-300">
                Budget exceeded by {formatCurrency(spent - budgetAmount)}
              </p>
            </div>
          )}

          {isWarning && !isAlert && (
            <div className="flex items-center gap-2 p-2 bg-warning-50 dark:bg-warning-900 dark:bg-opacity-20 rounded-sm border border-warning-200 dark:border-warning-800">
              <AlertCircle className="w-4 h-4 text-warning-600 dark:text-warning-400 flex-shrink-0" />
              <p className="text-xs font-medium text-warning-700 dark:text-warning-300">
                You're at {percentage.toFixed(0)}% of your budget
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
