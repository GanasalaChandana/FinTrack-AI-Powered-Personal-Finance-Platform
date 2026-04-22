"use client";

import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  gradient?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  gradient = "from-indigo-500 to-violet-500",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 p-6">
        <Icon className="h-12 w-12 text-white" />
      </div>
      <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mb-6 max-w-md text-gray-600 dark:text-gray-400">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
