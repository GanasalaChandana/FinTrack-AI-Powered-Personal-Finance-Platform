'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MoreVertical, Edit2, Trash2, Copy } from 'lucide-react';
import { type Transaction } from '@/lib/api';

interface TransactionListItemProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (transaction: Transaction) => void;
  showMenu?: boolean;
}

const getCategoryEmoji = (category: string): string => {
  const emojiMap: Record<string, string> = {
    groceries: '🛒',
    grocery: '🛒',
    transport: '🚗',
    transportation: '🚗',
    car: '🚗',
    gas: '⛽',
    entertainment: '🎬',
    movie: '🎬',
    game: '🎮',
    food: '🍕',
    restaurant: '🍽️',
    coffee: '☕',
    utilities: '🏠',
    electricity: '💡',
    water: '💧',
    internet: '📡',
    phone: '📱',
    subscription: '💳',
    netflix: '📺',
    spotify: '🎵',
    gym: '💪',
    health: '🏥',
    medicine: '💊',
    shopping: '🛍️',
    clothes: '👕',
    shoes: '👟',
    books: '📚',
    education: '🎓',
    rent: '🏘️',
    mortgage: '🏦',
    salary: '💼',
    income: '💰',
    bonus: '🎁',
    refund: '↩️',
    investment: '📈',
    savings: '🏦',
    transfer: '➡️',
    other: '📌',
  };

  const lower = category.toLowerCase().trim();
  return emojiMap[lower] || '📌';
};

const formatCurrency = (value: number, isExpense: boolean) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(value));

  return isExpense ? `-${formatted}` : `+${formatted}`;
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function TransactionListItem({
  transaction,
  onEdit,
  onDelete,
  onDuplicate,
  showMenu = true,
}: TransactionListItemProps) {
  const [showActions, setShowActions] = React.useState(false);

  const isExpense = transaction.type === 'expense' || transaction.type === 'EXPENSE';
  const isIncome = transaction.type === 'income' || transaction.type === 'INCOME';
  const amountColor = isExpense ? 'text-error-600 dark:text-error-400' : isIncome ? 'text-success-600 dark:text-success-400' : 'text-neutral-600 dark:text-neutral-400';

  return (
    <Card
      variant="default"
      padding="md"
      className="hover:shadow-md dark:hover:shadow-md transition-shadow"
      isInteractive={showMenu}
    >
      <CardContent className="flex items-center justify-between gap-4">
        {/* Icon & Details */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 text-2xl">
            {getCategoryEmoji(transaction.category || '')}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
              {transaction.description || transaction.category || 'Transaction'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {transaction.category || 'Other'} • {formatDate(transaction.date)}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className={`flex-shrink-0 text-right ${amountColor}`}>
          <p className="text-sm font-semibold">
            {formatCurrency(transaction.amount || 0, isExpense)}
          </p>
        </div>

        {/* Menu */}
        {showMenu && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-sm transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showActions && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-10 min-w-max">
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(transaction);
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors first:rounded-t-sm"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                )}

                {onDuplicate && (
                  <button
                    onClick={() => {
                      onDuplicate(transaction);
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Duplicate
                  </button>
                )}

                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete(transaction.id || '');
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900 dark:hover:bg-opacity-20 transition-colors last:rounded-b-sm border-t border-neutral-200 dark:border-neutral-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
