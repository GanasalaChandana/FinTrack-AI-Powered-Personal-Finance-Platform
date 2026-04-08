'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-primary-600 text-white
    hover:bg-primary-700 active:bg-primary-800
    dark:bg-primary-600 dark:hover:bg-primary-500
    focus-visible:ring-4 focus-visible:ring-primary-600 focus-visible:ring-opacity-10
  `,
  secondary: `
    bg-primary-50 text-primary-700
    hover:bg-primary-100 active:bg-primary-200
    dark:bg-neutral-700 dark:text-primary-300 dark:hover:bg-neutral-600
    focus-visible:ring-4 focus-visible:ring-primary-600 focus-visible:ring-opacity-10
  `,
  ghost: `
    text-primary-700 bg-transparent
    hover:bg-primary-50 active:bg-primary-100
    dark:text-primary-300 dark:hover:bg-neutral-800
    focus-visible:ring-4 focus-visible:ring-primary-600 focus-visible:ring-opacity-10
  `,
  danger: `
    bg-error-600 text-white
    hover:bg-error-700 active:bg-error-800
    dark:bg-error-600 dark:hover:bg-error-500
    focus-visible:ring-4 focus-visible:ring-error-600 focus-visible:ring-opacity-10
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-sm h-7',
  md: 'px-4 py-2.5 text-sm font-medium rounded-sm h-10',
  lg: 'px-6 py-3 text-base font-semibold rounded-md h-12',
};

const disabledClasses = `
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
`;

const transitionClasses = `
  transition-all duration-150 ease-out
`;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center gap-2
          ${fullWidth ? 'w-full' : ''}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${disabledClasses}
          ${transitionClasses}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {children}
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
            {children}
            {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
