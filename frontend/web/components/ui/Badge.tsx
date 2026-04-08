'use client';

import React from 'react';

type BadgeVariant = 'primary' | 'success' | 'error' | 'warning' | 'accent' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  onDismiss?: () => void;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
  success: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-200',
  error: 'bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-200',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-200',
  neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs font-medium rounded-xs',
  md: 'px-2.5 py-1 text-sm font-medium rounded-sm',
  lg: 'px-3 py-1.5 text-base font-medium rounded-md',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      onDismiss,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1.5
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Remove badge"
          >
            ×
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
