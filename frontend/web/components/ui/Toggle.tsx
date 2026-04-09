'use client';

import React from 'react';

interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLElement>, 'size'> {
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<string, { toggle: string; circle: string }> = {
  sm: {
    toggle: 'w-10 h-6',
    circle: 'w-5 h-5 translate-x-0.5 group-data-[state=checked]:translate-x-4',
  },
  md: {
    toggle: 'w-12 h-7',
    circle: 'w-6 h-6 translate-x-0.5 group-data-[state=checked]:translate-x-5',
  },
  lg: {
    toggle: 'w-14 h-8',
    circle: 'w-7 h-7 translate-x-0.5 group-data-[state=checked]:translate-x-6',
  },
};

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      label,
      description,
      disabled,
      size = 'md',
      className = '',
      id,
      checked,
      onChange,
      ...props
    },
    ref
  ) => {
    const sizeClass = sizeClasses[size];
    const inputId = id || `toggle-${Math.random().toString(36).slice(2)}`;

    return (
      <div className={disabled ? 'opacity-50 cursor-not-allowed' : ''}>
        <div className="flex items-center gap-3">
          <div
            className="group relative"
            data-state={checked ? 'checked' : 'unchecked'}
          >
            <input
              ref={ref}
              type="checkbox"
              id={inputId}
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              className="sr-only peer"
              {...props}
            />

            <label
              htmlFor={inputId}
              className={`
                block cursor-pointer
                bg-neutral-300 dark:bg-neutral-600
                peer-checked:bg-primary-600 peer-checked:dark:bg-primary-600
                transition-all duration-200
                relative
                ${sizeClass.toggle}
                rounded-full
              `}
            >
              <span
                className={`
                  absolute top-1/2 -translate-y-1/2 left-0.5
                  bg-white dark:bg-neutral-50
                  shadow-sm
                  transition-all duration-200
                  rounded-full
                  ${sizeClass.circle}
                `}
              />
            </label>
          </div>

          {label && (
            <div className="flex-1">
              <label
                htmlFor={inputId}
                className={`
                  block text-sm font-medium
                  text-neutral-900 dark:text-neutral-50
                  ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {label}
              </label>
              {description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';
