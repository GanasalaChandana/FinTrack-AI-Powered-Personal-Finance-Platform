'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { PageHeader, PageContent, Section, Grid } from '@/components/layouts/PageHeader';

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netWorth: number;
  incomeChange: number | null;
  expensesChange: number | null;
}

interface DashboardLayoutProps {
  userName: string;
  stats: DashboardStats;
  isLoading: boolean;
  onRefresh: () => void;
  onAddTransaction: () => void;
  incomeSparkline?: Array<{ v: number }>;
  expensesSparkline?: Array<{ v: number }>;
  savingsSparkline?: Array<{ v: number }>;
  children?: React.ReactNode;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

export function DashboardLayout({
  userName,
  stats,
  isLoading,
  onRefresh,
  onAddTransaction,
  incomeSparkline,
  expensesSparkline,
  savingsSparkline,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          title={`Welcome back, ${userName}!`}
          description="Here's a summary of your financial activity"
          actions={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={onRefresh}
                isLoading={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                onClick={onAddTransaction}
              >
                Add Transaction
              </Button>
            </div>
          }
        />

        <PageContent>
          {/* Key Stats */}
          <Section title="Financial Overview" description="Your key financial metrics">
            <Grid columns={3} gap="lg">
              <StatCard
                title="Total Income"
                value={formatCurrency(stats.totalIncome)}
                change={stats.incomeChange}
                icon={TrendingUp}
                color="success"
                sparklineData={incomeSparkline}
              />
              <StatCard
                title="Total Expenses"
                value={formatCurrency(stats.totalExpenses)}
                change={stats.expensesChange}
                icon={TrendingDown}
                color="error"
                sparklineData={expensesSparkline}
              />
              <StatCard
                title="Net Savings"
                value={formatCurrency(stats.totalSavings)}
                change={stats.totalSavings > 0 ? 100 : -100}
                icon={Target}
                color="primary"
                sparklineData={savingsSparkline}
              />
            </Grid>
          </Section>

          {/* Charts and Additional Sections */}
          {children}
        </PageContent>
      </div>
    </div>
  );
}

export { PageHeader, PageContent, Section, Grid };
