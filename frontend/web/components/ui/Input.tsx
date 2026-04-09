'use client';

import React from 'react';

type InputSize = 'sm' | 'md' | 'lg';
type InputVariant = 'default' | 'error' | 'success';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  variant?: InputVariant;
  size?: InputSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs h-8',
  md: 'px-3 py-2 text-sm h-10',
  lg: 'px-4 py-3 text-base h-12',
};

const variantClasses: Record<InputVariant, string> = {
  default: `
    border border-neutral-300 dark:border-neutral-600
    bg-white dark:bg-neutral-800
    text-neutral-900 dark:text-neutral-50
    placeholder-neutral-500 dark:placeholder-neutral-400
    focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-opacity-10
  `,
  error: `
    border-2 border-error-500 dark:border-error-600
    bg-white dark:bg-neutral-800
    text-neutral-900 dark:text-neutral-50
    placeholder-neutral-500 dark:placeholder-neutral-400
    focus:border-error-600 focus:ring-2 focus:ring-error-600 focus:ring-opacity-10
  `,
  success: `
    border border-success-500 dark:border-success-600
    bg-white dark:bg-neutral-800
    text-neutral-900 dark:text-neutral-50
    placeholder-neutral-500 dark:placeholder-neutral-400
    focus:border-success-600 focus:ring-2 focus:ring-success-600 focus:ring-opacity-10
  `,
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      error,
      variant = error ? 'error' : 'default',
      size = 'md',
      icon,
      iconPosition = 'left',
      fullWidth = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={fullWidth ? 'w-full' : 'inline-block'}>
        {label && (
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {props.required && <span className="text-error-600 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 pointer-events-none flex items-center">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={`
              w-full
              rounded-sm
              border-0
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              ${variantClasses[variant]}
              ${sizeClasses[size]}
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />

          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 pointer-events-none flex items-center">
              {icon}
            </div>
          )}
        </div>

        {description && !error && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        )}

        {error && (
          <p className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  variant?: InputVariant;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      error,
      variant = error ? 'error' : 'default',
      fullWidth = true,
      className = '',
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    return (
      <div className={fullWidth ? 'w-full' : 'inline-block'}>
        {label && (
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {props.required && <span className="text-error-600 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={`
            w-full
            rounded-sm
            border-0
            px-3 py-2
            text-sm
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${variantClasses[variant]}
            ${className}
          `}
          {...props}
        />

        {description && !error && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        )}

        {error && (
          <p className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select Component
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  variant?: InputVariant;
  size?: InputSize;
  fullWidth?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      description,
      error,
      options,
      variant = error ? 'error' : 'default',
      size = 'md',
      fullWidth = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={fullWidth ? 'w-full' : 'inline-block'}>
        {label && (
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {props.required && <span className="text-error-600 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          disabled={disabled}
          className={`
            w-full
            rounded-sm
            border-0
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            appearance-none
            cursor-pointer
            ${variantClasses[variant]}
            ${sizeClasses[size]}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {description && !error && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        )}

        {error && (
          <p className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
