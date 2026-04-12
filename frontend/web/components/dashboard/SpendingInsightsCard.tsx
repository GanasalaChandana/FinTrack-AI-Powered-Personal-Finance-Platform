"use client";

import React, { useMemo, useState } from "react";
import { Brain, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Info, Lightbulb, CheckCircle } from "lucide-react";
import { Transaction } from "@/lib/api";
import { generateSpendingInsights, SpendingInsight, InsightSentiment } from "@/lib/utils/spendingInsights";

interface Props {
  transactions: Transaction[];
}

const SENTIMENT_CONFIG: Record<InsightSentiment, {
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
  icon: React.ElementType;
  iconColor: string;
}> = {
  positive: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800/40",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    badgeText: "Win",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
  },
  neutral: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800/40",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    badgeText: "Insight",
    icon: Info,
    iconColor: "text-blue-500",
  },
  warning: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800/40",
    badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
    badgeText: "Heads Up",
    icon: TrendingUp,
    iconColor: "text-orange-500",
  },
  tip: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800/40",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400",
    badgeText: "Tip",
    icon: Lightbulb,
    iconColor: "text-purple-500",
  },
};

function InsightDot({ sentiment, active }: { sentiment: InsightSentiment; active: boolean }) {
  const colors: Record<InsightSentiment, string> = {
    positive: "bg-emerald-400",
    neutral: "bg-blue-400",
    warning: "bg-orange-400",
    tip: "bg-purple-400",
  };
  return (
    <span className={`inline-block rounded-full transition-all ${active ? `w-4 h-2 ${colors[sentiment]}` : "w-2 h-2 bg-gray-300 dark:bg-gray-600"}`} />
  );
}

export function SpendingInsightsCard({ transactions }: Props) {
  const insights = useMemo(() => generateSpendingInsights(transactions), [transactions]);
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c - 1 + insights.length) % insights.length);
  const next = () => setCurrent((c) => (c + 1) % insights.length);

  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Spending Insights</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          Add more transactions to generate personalized insights.
        </p>
      </div>
    );
  }

  const insight = insights[Math.min(current, insights.length - 1)];
  const cfg = SENTIMENT_CONFIG[insight.sentiment];
  const Icon = cfg.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Spending Insights</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{insights.length} insights generated</p>
          </div>
        </div>
        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={insights.length <= 1}
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center tabular-nums">
            {current + 1}/{insights.length}
          </span>
          <button
            onClick={next}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={insights.length <= 1}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Insight Card */}
      <div className={`rounded-xl border p-4 transition-all ${cfg.bg} ${cfg.border}`}>
        {/* Top row: emoji + title + badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{insight.emoji}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{insight.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {cfg.badgeText}
                </span>
              </div>
            </div>
          </div>
          <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          {insight.description}
        </p>

        {/* Highlighted value */}
        {insight.value && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {insight.value}
            </span>
            {insight.valueLabel && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{insight.valueLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-1.5">
        {insights.map((ins, i) => (
          <button key={ins.id} onClick={() => setCurrent(i)}>
            <InsightDot sentiment={ins.sentiment} active={i === current} />
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Win</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Insight</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Heads Up</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Tip</span>
      </div>
    </div>
  );
}
