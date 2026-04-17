"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, TrendingUp, Info, X, ArrowRight, Brain, Zap } from "lucide-react";
import { Transaction } from "@/lib/api";
import { generateAIInsights } from "@/lib/utils/aiInsights";

interface Props {
  transactions: Transaction[];
}

export function AITopInsightBanner({ transactions }: Props) {
  // Persist dismissed state per session so it reappears on next login
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("fintrack-ai-banner-dismissed") === "true";
  });

  const topInsight = useMemo(() => {
    if (!transactions.length) return null;
    const insights = generateAIInsights(transactions as any);
    // Pick the highest-priority insight
    return (
      insights.find((i) => i.type === "warning" && i.impact === "high") ??
      insights.find((i) => i.type === "warning" && i.impact === "medium") ??
      insights.find((i) => i.type === "info") ??
      insights[0] ??
      null
    );
  }, [transactions]);

  if (dismissed || !topInsight) return null;

  const isHigh   = topInsight.impact === "high";
  const isMedium = topInsight.impact === "medium";

  const gradient = isHigh
    ? "linear-gradient(135deg, #dc2626 0%, #ea580c 100%)"
    : isMedium
    ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)";

  const Icon = isHigh ? AlertTriangle : isMedium ? TrendingUp : Info;
  const label = isHigh ? "⚡ HIGH PRIORITY" : isMedium ? "⚠ AI INSIGHT" : "ℹ AI TIP";

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("fintrack-ai-banner-dismissed", "true");
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-lg animate-slide-down"
      style={{ background: gradient }}
    >
      {/* Icon */}
      <div
        className="p-1.5 rounded-xl flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.2)" }}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
            {label}
          </span>
          <span
            className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            AI
          </span>
        </div>
        <p className="text-sm font-semibold text-white leading-snug line-clamp-1">
          {topInsight.message}
        </p>
      </div>

      {/* Action */}
      <Link
        href="/insights"
        className="flex items-center gap-1.5 text-xs font-bold text-white flex-shrink-0 px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "rgba(255,255,255,0.2)" }}
      >
        View insights <ArrowRight className="w-3 h-3" />
      </Link>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
        style={{ background: "rgba(255,255,255,0.1)" }}
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  );
}
