'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
  isInteractive?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: `
    bg-white dark:bg-neutral-800
    border border-neutral-200 dark:border-neutral-700
    shadow-sm dark:shadow-sm
  `,
  elevated: `
    bg-white dark:bg-neutral-800
    border border-neutral-100 dark:border-neutral-700
    shadow-md dark:shadow-md
  `,
  outlined: `
    bg-transparent
    border-2 border-primary-200 dark:border-primary-900
  `,
};

const paddingClasses: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      isInteractive = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-md
          ${variantClasses[variant]}
          ${paddingClasses[padding]}
          ${isInteractive ? 'cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-lg' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card.Header - For consistent card header styling
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col gap-2 mb-4 ${className}`}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

// Card.Title - For card titles
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ size = 'md', className = '', ...props }, ref) => {
    const sizeClasses: Record<string, string> = {
      sm: 'text-sm font-semibold',
      md: 'text-base font-semibold',
      lg: 'text-lg font-bold',
    };

    return (
      <h3
        ref={ref}
        className={`text-neutral-900 dark:text-neutral-50 ${sizeClasses[size]} ${className}`}
        {...props}
      />
    );
  }
);

CardTitle.displayName = 'CardTitle';

// Card.Description - For card descriptions
export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-neutral-600 dark:text-neutral-400 ${className}`}
      {...props}
    />
  )
);

CardDescription.displayName = 'CardDescription';

// Card.Content - For card content wrapper
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`${className}`}
      {...props}
    />
  )
);

CardContent.displayName = 'CardContent';

// Card.Footer - For card footer
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex gap-3 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 ${className}`}
      {...props}
    />
  )
);

CardFooter.displayName = 'CardFooter';
