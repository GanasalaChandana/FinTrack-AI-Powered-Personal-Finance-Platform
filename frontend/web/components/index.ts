// ========== UI Components (Phase 2) ==========
export { Button } from './ui/Button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
export { Input, Textarea, Select } from './ui/Input';
export { Modal, ModalContent, ModalFooter } from './ui/Modal';
export { Badge } from './ui/Badge';
export { Toggle } from './ui/Toggle';
export { Skeleton, CardSkeleton, TableRowSkeleton, TransactionItemSkeleton } from './ui/Skeleton';
export { Alert } from './ui/Alert';
export { ToastProvider, useToast } from './ui/Toast';

// ========== Layout Components (Phase 3) ==========
export { PageHeader, PageContent, Section, Grid } from './layouts/PageHeader';

// ========== Dashboard Components (Phase 3) ==========
export { DashboardLayout } from './dashboard/DashboardLayout';
export { StatCard } from './dashboard/StatCard';

// ========== Transaction Components (Phase 3) ==========
export { TransactionListItem } from './transaction/TransactionListItem';
export { TransactionListGroup, groupTransactionsByDate } from './transaction/TransactionListGroup';

// ========== Budget Components (Phase 3) ==========
export { BudgetProgressCard } from './budget/BudgetProgressCard';

// ========== Goal Components (Phase 3) ==========
export { GoalProgressCard } from './goals/GoalProgressCard';

// ========== Error Handling (Phase 3) ==========
export { ErrorBoundary } from './ErrorBoundary';

// ========== Re-exports of common utilities ==========
export type { default as ButtonProps } from './ui/Button';
export type { default as CardProps } from './ui/Card';
export type { default as InputProps } from './ui/Input';
export type { default as ModalProps } from './ui/Modal';
export type { default as BadgeProps } from './ui/Badge';
export type { default as ToggleProps } from './ui/Toggle';
export type { default as SkeletonProps } from './ui/Skeleton';
export type { default as AlertProps } from './ui/Alert';
