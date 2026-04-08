'use client';

import React from 'react';
import { TransactionListItem } from './TransactionListItem';
import { type Transaction } from '@/lib/api';

interface TransactionGroup {
  date: string;
  label: string;
  transactions: Transaction[];
}

interface TransactionListGroupProps {
  groups: TransactionGroup[];
  onEditTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onDuplicateTransaction?: (transaction: Transaction) => void;
  isLoading?: boolean;
}

const groupTransactionsByDate = (transactions: Transaction[]): TransactionGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const groups: Record<string, Transaction[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  };

  const dateLabels: Record<string, string> = {
    today: 'TODAY',
    yesterday: 'YESTERDAY',
    week: 'LAST 7 DAYS',
    month: 'LAST 30 DAYS',
    older: 'EARLIER',
  };

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date || '');
    const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());

    if (txDateOnly.getTime() === today.getTime()) {
      groups.today.push(tx);
    } else if (txDateOnly.getTime() === yesterday.getTime()) {
      groups.yesterday.push(tx);
    } else if (txDateOnly > weekAgo) {
      groups.week.push(tx);
    } else if (txDateOnly > monthAgo) {
      groups.month.push(tx);
    } else {
      groups.older.push(tx);
    }
  });

  return Object.entries(groups)
    .filter(([_, txs]) => txs.length > 0)
    .map(([key, txs]) => ({
      date: key,
      label: dateLabels[key],
      transactions: txs,
    }));
};

export function TransactionListGroup({
  groups: providedGroups,
  onEditTransaction,
  onDeleteTransaction,
  onDuplicateTransaction,
  isLoading = false,
}: TransactionListGroupProps) {
  const groups = providedGroups.length > 0 ? providedGroups : groupTransactionsByDate([]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            {[1, 2].map((j) => (
              <div key={j} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-md animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">No transactions yet</p>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
          Start by adding your first transaction
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date}>
          {/* Date Header */}
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 pl-4">
            {group.label}
          </h3>

          {/* Transaction Items */}
          <div className="space-y-2">
            {group.transactions.map((transaction) => (
              <TransactionListItem
                key={transaction.id}
                transaction={transaction}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
                onDuplicate={onDuplicateTransaction}
                showMenu={true}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { groupTransactionsByDate };
