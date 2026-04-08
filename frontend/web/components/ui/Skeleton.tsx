'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'avatar' | 'card' | 'circle';
  height?: string;
  width?: string;
  count?: number;
}

const variantClasses: Record<string, string> = {
  text: 'h-4 rounded-sm',
  avatar: 'w-12 h-12 rounded-full',
  card: 'h-48 rounded-md',
  circle: 'rounded-full',
};

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'text',
      height = '1rem',
      width = '100%',
      count = 1,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      bg-neutral-200 dark:bg-neutral-700
      animate-pulse
      ${variantClasses[variant]}
      ${className}
    `;

    if (count > 1) {
      return (
        <div className="space-y-3" {...props}>
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              ref={i === 0 ? ref : undefined}
              className={baseClasses}
              style={{
                height: variant === 'text' ? undefined : height,
                width: variant === 'text' ? width : undefined,
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={baseClasses}
        style={{
          height: variant === 'text' ? undefined : height,
          width: variant === 'text' ? width : undefined,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Specialized Skeleton Loaders
export function CardSkeleton() {
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 p-6 space-y-4">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="100%" count={3} />
      <div className="flex gap-3 pt-4">
        <Skeleton width="80px" height="40px" />
        <Skeleton width="80px" height="40px" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr>
      <td className="p-4">
        <Skeleton variant="text" width="80%" />
      </td>
      <td className="p-4">
        <Skeleton variant="text" width="60%" />
      </td>
      <td className="p-4">
        <Skeleton variant="text" width="40%" />
      </td>
      <td className="p-4">
        <Skeleton width="40px" height="40px" />
      </td>
    </tr>
  );
}

export function TransactionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <Skeleton width="80px" height="20px" />
    </div>
  );
}
