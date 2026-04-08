'use client';

import React from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onDismiss?: () => void;
  showIcon?: boolean;
  children: React.ReactNode;
}

const variantConfig: Record<
  AlertVariant,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
  }
> = {
  success: {
    bg: 'bg-success-50 dark:bg-success-900 dark:bg-opacity-20',
    border: 'border-success-200 dark:border-success-800',
    text: 'text-success-900 dark:text-success-200',
    icon: <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />,
  },
  error: {
    bg: 'bg-error-50 dark:bg-error-900 dark:bg-opacity-20',
    border: 'border-error-200 dark:border-error-800',
    text: 'text-error-900 dark:text-error-200',
    icon: <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400" />,
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900 dark:bg-opacity-20',
    border: 'border-warning-200 dark:border-warning-800',
    text: 'text-warning-900 dark:text-warning-200',
    icon: <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400" />,
  },
  info: {
    bg: 'bg-primary-50 dark:bg-primary-900 dark:bg-opacity-20',
    border: 'border-primary-200 dark:border-primary-800',
    text: 'text-primary-900 dark:text-primary-200',
    icon: <Info className="w-5 h-5 text-primary-600 dark:text-primary-400" />,
  },
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      onDismiss,
      showIcon = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const config = variantConfig[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={`
          rounded-md border p-4
          ${config.bg} ${config.border} ${config.text}
          ${className}
        `}
        {...props}
      >
        <div className="flex gap-3">
          {showIcon && (
            <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
          )}

          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="font-semibold text-sm mb-1">{title}</h3>
            )}
            <div className="text-sm opacity-90">{children}</div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
