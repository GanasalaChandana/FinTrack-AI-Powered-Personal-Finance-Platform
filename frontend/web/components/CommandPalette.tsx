"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, ArrowRightLeft, Target, FileText,
  Camera, Activity, Brain, RefreshCw, BarChart3, Wallet,
  LogOut, Sun, Moon, Monitor, Calendar,
  X, ChevronRight, Loader2,
} from "lucide-react";
import { transactionsAPI } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  keywords?: string[];
}

interface QuickAction {
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface Transaction {
  id: string | number;
  merchant?: string;
  description?: string;
  amount: number;
  type: string;
  category?: string;
  date: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onCycleTheme: () => void;
  currentTheme: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, keywords: ["home", "overview"] },
  { label: "Transactions", href: "/transactions", icon: <ArrowRightLeft className="w-4 h-4" />, keywords: ["expenses", "income", "payments"] },
  { label: "Goals & Budgets", href: "/goals-budgets", icon: <Target className="w-4 h-4" />, keywords: ["budget", "goal", "savings target"] },
  { label: "Reports", href: "/reports", icon: <FileText className="w-4 h-4" />, keywords: ["charts", "export", "monthly", "forecast"] },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="w-4 h-4" />, keywords: ["spending", "trends", "merchants"] },
  { label: "Net Worth", href: "/net-worth", icon: <Wallet className="w-4 h-4" />, keywords: ["assets", "liabilities", "wealth"] },
  { label: "Health Score", href: "/health", icon: <Activity className="w-4 h-4" />, keywords: ["financial health", "score"] },
  { label: "AI Insights", href: "/insights", icon: <Brain className="w-4 h-4" />, keywords: ["ai", "anomaly", "smart"] },
  { label: "Recurring", href: "/recurring", icon: <RefreshCw className="w-4 h-4" />, keywords: ["subscriptions", "bills", "recurring"] },
  { label: "Receipt Scanner", href: "/receipts", icon: <Camera className="w-4 h-4" />, keywords: ["scan", "ocr", "photo"] },
  { label: "Calendar", href: "/calendar", icon: <Calendar className="w-4 h-4" />, keywords: ["calendar", "bills", "schedule", "upcoming"] },
];

const formatAmount = (amount: number, type: string) => {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(Math.abs(amount));
  return type === "income" ? `+${formatted}` : `-${formatted}`;
};

export function CommandPalette({ isOpen, onClose, onLogout, onCycleTheme, currentTheme }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "system" ? Monitor : Sun;
  const nextTheme = currentTheme === "light" ? "Dark" : currentTheme === "dark" ? "System" : "Light";

  const quickActions: QuickAction[] = [
    {
      label: `Switch to ${nextTheme} Mode`,
      description: `Currently: ${currentTheme}`,
      icon: <ThemeIcon className="w-4 h-4" />,
      action: () => { onCycleTheme(); onClose(); },
    },
    {
      label: "Log Out",
      icon: <LogOut className="w-4 h-4 text-red-500" />,
      action: () => { onLogout(); onClose(); },
    },
  ];

  // Load transactions when palette opens
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
    setLoadingTxns(true);
    transactionsAPI.getAll()
      .then((data: any[]) => setTransactions(data.slice(0, 200)))
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTxns(false));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Filter nav items by query
  const filteredNav = query.trim()
    ? NAV_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords?.some(k => k.toLowerCase().includes(query.toLowerCase()))
      )
    : NAV_ITEMS;

  // Filter transactions by query
  const filteredTxns: Transaction[] = query.trim().length >= 2
    ? transactions.filter(t => {
        const q = query.toLowerCase();
        return (
          (t.merchant || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
        );
      }).slice(0, 5)
    : [];

  // Filter quick actions by query
  const filteredActions = query.trim()
    ? quickActions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
    : quickActions;

  // Build flat list of all items for keyboard nav
  const allItems: Array<{ type: "nav" | "action" | "transaction"; data: NavItem | QuickAction | Transaction }> = [
    ...filteredNav.map(d => ({ type: "nav" as const, data: d })),
    ...filteredActions.map(d => ({ type: "action" as const, data: d })),
    ...filteredTxns.map(d => ({ type: "transaction" as const, data: d })),
  ];

  const activateItem = useCallback((index: number) => {
    const item = allItems[index];
    if (!item) return;
    if (item.type === "nav") {
      router.push((item.data as NavItem).href);
      onClose();
    } else if (item.type === "action") {
      (item.data as QuickAction).action();
    } else {
      const t = item.data as Transaction;
      router.push(`/transactions?highlight=${t.id}`);
      onClose();
    }
  }, [allItems, router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        activateItem(activeIndex);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, activeIndex, activateItem, allItems.length, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Reset active index when query changes
  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!isOpen) return null;

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions, transactions..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm outline-none"
          />
          {loadingTxns && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">

          {/* Navigation section */}
          {filteredNav.length > 0 && (
            <div>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {query ? "Pages" : "Navigation"}
                </span>
              </div>
              {filteredNav.map((item) => {
                const idx = globalIdx++;
                return (
                  <button
                    key={item.href}
                    data-idx={idx}
                    onClick={() => activateItem(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeIndex === idx
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <span className={activeIndex === idx ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions section */}
          {filteredActions.length > 0 && (
            <div className={filteredNav.length > 0 ? "mt-1 pt-1 border-t border-gray-100 dark:border-gray-800" : ""}>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Quick Actions
                </span>
              </div>
              {filteredActions.map((action) => {
                const idx = globalIdx++;
                return (
                  <button
                    key={action.label}
                    data-idx={idx}
                    onClick={() => activateItem(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeIndex === idx
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <span className={activeIndex === idx ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}>
                      {action.icon}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{action.label}</span>
                      {action.description && (
                        <span className="block text-xs text-gray-400 dark:text-gray-500">{action.description}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Transactions section */}
          {filteredTxns.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Transactions
                </span>
              </div>
              {filteredTxns.map((txn) => {
                const idx = globalIdx++;
                const isIncome = txn.type === "income";
                return (
                  <button
                    key={txn.id}
                    data-idx={idx}
                    onClick={() => activateItem(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeIndex === idx
                        ? "bg-indigo-50 dark:bg-indigo-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isIncome
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }`}>
                      {(txn.merchant || txn.description || "?")[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {txn.merchant || txn.description || "Transaction"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {txn.category} · {new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatAmount(txn.amount, txn.type)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {query.trim() && filteredNav.length === 0 && filteredActions.length === 0 && filteredTxns.length === 0 && !loadingTxns && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No results for <strong>"{query}"</strong></p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">Esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
