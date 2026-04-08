'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2, Target, Calendar } from 'lucide-react';
import { type Goal } from '@/lib/api';

interface GoalProgressCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'No date';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getDaysRemaining = (targetDate: string | undefined): number | null => {
  if (!targetDate) return null;
  try {
    const target = new Date(targetDate);
    const today = new Date();
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const getGoalEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('house') || lower.includes('home') || lower.includes('down')) return '🏠';
  if (lower.includes('vacation') || lower.includes('travel') || lower.includes('trip')) return '✈️';
  if (lower.includes('car')) return '🚗';
  if (lower.includes('education') || lower.includes('school')) return '🎓';
  if (lower.includes('wedding')) return '💍';
  if (lower.includes('emergency')) return '🆘';
  if (lower.includes('retirement')) return '🏖️';
  return '🎯';
};

export function GoalProgressCard({
  goal,
  onEdit,
  onDelete,
}: GoalProgressCardProps) {
  const targetAmount = goal.targetAmount || 0;
  const currentAmount = goal.currentAmount || (goal as any).current || 0;
  const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const daysRemaining = getDaysRemaining(goal.targetDate);
  const isCompleted = percentage >= 100;

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-success-600';
    if (percentage >= 75) return 'bg-primary-600';
    if (percentage >= 50) return 'bg-accent-600';
    return 'bg-warning-600';
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{getGoalEmoji(goal.name || '')}</span>
            <div className="flex-1 min-w-0">
              <CardTitle size="md">{goal.name || 'Goal'}</CardTitle>
            </div>
          </div>
          {onEdit || onDelete ? (
            <div className="flex gap-1 ml-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Edit2 className="w-4 h-4" />}
                  onClick={() => onEdit(goal)}
                  title="Edit goal"
                />
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => onDelete(goal.id || '')}
                  title="Delete goal"
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
              {formatCurrency(currentAmount)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              of {formatCurrency(targetAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              {percentage.toFixed(0)}%
            </p>
            {!isCompleted && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {formatCurrency(remaining)} to go
              </p>
            )}
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
        </div>

        {/* Timeline Info */}
        {goal.targetDate && (
          <div className="flex items-center gap-2 p-2 bg-primary-50 dark:bg-primary-900 dark:bg-opacity-20 rounded-sm border border-primary-200 dark:border-primary-800">
            <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary-700 dark:text-primary-300">
                Target: {formatDate(goal.targetDate)}
              </p>
              {daysRemaining !== null && (
                <p className="text-xs text-primary-600 dark:text-primary-400">
                  {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Target date passed'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Completion Badge */}
        {isCompleted && (
          <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900 dark:bg-opacity-20 rounded-sm border border-success-200 dark:border-success-800">
            <Target className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-success-700 dark:text-success-300">
              Goal completed! 🎉
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
