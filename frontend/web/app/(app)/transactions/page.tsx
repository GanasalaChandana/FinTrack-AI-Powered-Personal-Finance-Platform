// frontend/web/app/(app)/transactions/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  Search,
  Download,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  X as Close,
  Check,
  Filter,
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
} from "lucide-react";

import {
  transactionsAPI,
  type Transaction as ApiTransaction,
} from "@/lib/api";
import { detectRecurring } from "@/lib/utils/recurringDetection";

import { BulkActions } from "./BulkActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, Section, Grid, PageContent } from "@/components/layouts/PageHeader";
import { TransactionModal } from "@/components/modals/TransactionModal";

/* =========================
   Types
   ========================= */

type TxType = "income" | "expense";
type TxStatus = "completed" | "pending";

type CategoryId =
  | "all"
  | "food"
  | "transport"
  | "shopping"
  | "entertainment"
  | "bills"
  | "health"
  | "income"
  | "other";

interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
}

interface Transaction extends Omit<ApiTransaction, "category" | "type"> {
  category: Exclude<CategoryId, "all">;
  type: TxType;
  status: TxStatus;
  paymentMethod: string;
  tags: string[];
  notes?: string;
  aiSuggested: boolean;
  merchant?: string;
}

interface NewTxForm {
  date: string;
  merchant: string;
  description: string;
  amount: string; // kept for edit form only
  category: Exclude<CategoryId, "all">;
  type: TxType;
  status: TxStatus;
  paymentMethod: string;
}

interface TxFilters {
  search?: string;
  type?: "all" | TxType;
  category?: string;
  sort?: "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

/* =========================
   Constants
   ========================= */

const PAGE_SIZE = 10;

/* =========================
   Helpers
   ========================= */

const dtUS = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", opts).format(d);

const formatAbsolute = (iso: string) =>
  dtUS(new Date(iso), { month: "short", day: "numeric", year: "numeric" });

const useIsMounted = () => {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
};

const formatRelativeClientOnly = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatAbsolute(iso);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Math.abs(value));

const mapCategoryToUI = (category: string): Exclude<CategoryId, "all"> => {
  const map: Record<string, Exclude<CategoryId, "all">> = {
    "Food & Dining": "food",
    Transportation: "transport",
    Shopping: "shopping",
    Entertainment: "entertainment",
    "Bills & Utilities": "bills",
    Healthcare: "health",
    Income: "income",
    Salary: "income",
    Freelance: "income",
    Business: "income",
    Investment: "income",
  };
  return map[category] || "other";
};

const mapCategoryToBackend = (
  category: Exclude<CategoryId, "all">,
  type: TxType,
): string => {
  if (type === "income") return "Income";
  const map: Record<Exclude<CategoryId, "all">, string> = {
    food: "Food & Dining",
    transport: "Transportation",
    shopping: "Shopping",
    entertainment: "Entertainment",
    bills: "Bills & Utilities",
    health: "Healthcare",
    income: "Income",
    other: "Other",
  };
  return map[category] || "Other";
};

const toBackendType = (type: TxType) =>
  type === "income" ? "INCOME" : "EXPENSE";

const fromBackendType = (
  type: "INCOME" | "EXPENSE" | "income" | "expense",
): TxType =>
  type === "INCOME" || type === "income" ? "income" : "expense";

/* =========================
   Data
   ========================= */

const CATEGORIES: Category[] = [
  { id: "all", name: "All Categories", icon: "📊", badgeBg: "bg-gray-100", badgeText: "text-gray-700" },
  { id: "food", name: "Food & Dining", icon: "🍔", badgeBg: "bg-blue-100", badgeText: "text-blue-700" },
  { id: "transport", name: "Transportation", icon: "🚗", badgeBg: "bg-purple-100", badgeText: "text-purple-700" },
  { id: "shopping", name: "Shopping", icon: "🛍️", badgeBg: "bg-pink-100", badgeText: "text-pink-700" },
  { id: "entertainment", name: "Entertainment", icon: "🎮", badgeBg: "bg-orange-100", badgeText: "text-orange-700" },
  { id: "bills", name: "Bills & Utilities", icon: "💡", badgeBg: "bg-green-100", badgeText: "text-green-700" },
  { id: "health", name: "Healthcare", icon: "⚕️", badgeBg: "bg-red-100", badgeText: "text-red-700" },
  { id: "income", name: "Income", icon: "💰", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  { id: "other", name: "Other", icon: "📦", badgeBg: "bg-gray-100", badgeText: "text-gray-700" },
];

const QUICK_DATE_FILTERS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This Year", days: 365 },
];
/* =========================
   Main Component
   ========================= */

export default function TransactionManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMounted = useIsMounted();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = React.useState<Transaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = React.useState<string[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<Transaction>>({});
  const [editTagsStr, setEditTagsStr] = React.useState("");

  const [showAdd, setShowAdd] = React.useState(false);
  // Initialize filters from URL params (supports ?category=Food&type=expense&search=starbucks)
  const [activeFilters, setActiveFilters] = React.useState<TxFilters>(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    return {
      sort: "date-desc",
      ...(params?.get("search") ? { search: params.get("search")! } : {}),
      ...(params?.get("type") ? { type: params.get("type") as TxFilters["type"] } : {}),
      ...(params?.get("category") ? { category: params.get("category")! } : {}),
      ...(params?.get("dateFrom") ? { dateFrom: params.get("dateFrom")! } : {}),
      ...(params?.get("dateTo") ? { dateTo: params.get("dateTo")! } : {}),
    };
  });
  const [showFilters, setShowFilters] = React.useState(() => {
    // Auto-expand filters panel if URL has filter params
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return !!(p.get("category") || p.get("type") || p.get("dateFrom") || p.get("dateTo"));
  });

  // ✅ Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);

  const [prefillTx, setPrefillTx] = React.useState<any>(null);
  const { toast } = useToast();
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("authToken") || localStorage.getItem("ft_token");
    if (!token) {
      router.replace("/register?mode=signin");
      return;
    }
    void loadTransactions();
  }, [router]);

  // Handle ?highlight=<id> from command palette — scroll to and briefly highlight that row
  React.useEffect(() => {
    const id = searchParams?.get("highlight");
    if (!id) return;
    setHighlightId(id);
    // Scroll to the highlighted row
    const el = document.getElementById(`txn-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Auto-clear after 3 seconds
    const timer = setTimeout(() => {
      setHighlightId(null);
      // Remove from URL without reload
      const params = new URLSearchParams(window.location.search);
      params.delete("highlight");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }, 3000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // Sync active filters → URL params (without triggering a page reload)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (activeFilters.search) params.set("search", activeFilters.search);
    if (activeFilters.type && activeFilters.type !== "all") params.set("type", activeFilters.type);
    if (activeFilters.category) params.set("category", activeFilters.category);
    if (activeFilters.dateFrom) params.set("dateFrom", activeFilters.dateFrom);
    if (activeFilters.dateTo) params.set("dateTo", activeFilters.dateTo);
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [activeFilters]);

  const normalizeTransaction = (t: ApiTransaction): Transaction => ({
    id: t.id!,
    userId: t.userId,
    amount: t.amount,
    description: t.description,
    merchant: (t as any).merchant || t.description || "Unknown",
    category: mapCategoryToUI(t.category),
    date: t.date,
    type: fromBackendType(t.type),
    recurring: t.recurring,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    status: ((t as any).status === "pending" ? "pending" : "completed") as TxStatus,
    paymentMethod: "Credit Card •••• 4242",
    tags: t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    notes: (t as any).notes || undefined,
    aiSuggested: false,
  });

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await transactionsAPI.getAll();
      if (!Array.isArray(data)) throw new Error("Invalid response format");
      const transformed: Transaction[] = data.map(normalizeTransaction);
      setTransactions(transformed);
      setFilteredTransactions(transformed);
    } catch (err: any) {
      console.error("❌ Failed to load transactions:", err);
      if (err?.message?.includes("401") || err?.message?.includes("Unauthorized")) {
        setError("Authentication failed. Please sign in again.");
        setTimeout(() => {
          localStorage.removeItem("authToken");
          localStorage.removeItem("ft_token");
          router.replace("/register?mode=signin");
        }, 2000);
      } else {
        setError(err?.message || "Failed to load transactions");
      }
      setTransactions([]);
      setFilteredTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryInfo = React.useCallback(
    (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id)!,
    [],
  );

  const totals = React.useMemo(() => {
    const income = filteredTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions]);

  // ✅ Recurring merchant detection
  const recurringMerchants = React.useMemo(() => {
    const summary = detectRecurring(transactions as any[]);
    return new Set(summary.items.map((i) => i.merchant.toLowerCase().trim()));
  }, [transactions]);

  const isRecurring = (t: Transaction) =>
    recurringMerchants.has((t.merchant || t.description || "").toLowerCase().trim());

  // ✅ Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const handleExportCSV = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const headers = "Date,Merchant,Description,Category,Amount,Type,Payment Method,Status,Recurring,Tags,Notes";
      const rows = filteredTransactions.map((t) => {
        const catInfo = getCategoryInfo(t.category);
        const tags = Array.isArray(t.tags) ? t.tags.join("; ") : (t.tags || "");
        const notes = (t.notes || "").replace(/"/g, '""');
        const recurring = isRecurring(t) ? "Yes" : "No";
        return `"${t.date}","${t.merchant || "Unknown"}","${t.description}","${catInfo.name}","${formatCurrency(t.amount)}","${t.type}","${t.paymentMethod}","${t.status}","${recurring}","${tags}","${notes}"`;
      });
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredTransactions.length} transactions as CSV`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const rows = filteredTransactions.map((t, i) => {
        const catInfo = getCategoryInfo(t.category);
        const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
        const color = t.type === "income" ? "#059669" : "#dc2626";
        const tags = Array.isArray(t.tags) ? t.tags.join(", ") : (t.tags || "");
        const notes = t.notes || "";
        const recurring = isRecurring(t) ? "✓" : "";
        return `<tr style="background:${bg}">
          <td style="padding:7px;border:1px solid #e5e7eb">${t.date}</td>
          <td style="padding:7px;border:1px solid #e5e7eb">${t.merchant || "Unknown"}</td>
          <td style="padding:7px;border:1px solid #e5e7eb">${t.description}</td>
          <td style="padding:7px;border:1px solid #e5e7eb">${catInfo.name}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;color:${color};font-weight:bold;text-align:right">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</td>
          <td style="padding:7px;border:1px solid #e5e7eb">${t.type}</td>
          <td style="padding:7px;border:1px solid #e5e7eb">${t.paymentMethod}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;text-align:center">${t.status}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;text-align:center;color:#7c3aed">${recurring}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;color:#4f46e5">${tags}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;color:#6b7280;font-style:italic">${notes}</td>
        </tr>`;
      }).join("");
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
        <h1 style="color:#1e40af">FinTrack Transaction Report</h1>
        <p>Generated: ${new Date().toLocaleDateString()} | Total: ${filteredTransactions.length} transactions</p>
        <table border="1" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr style="background:#1e40af;color:white">
            <th style="padding:10px">Date</th><th style="padding:10px">Merchant</th><th style="padding:10px">Description</th>
            <th style="padding:10px">Category</th><th style="padding:10px">Amount</th><th style="padding:10px">Type</th>
            <th style="padding:10px">Payment</th><th style="padding:10px">Status</th>
            <th style="padding:10px">Recurring</th><th style="padding:10px">Tags</th><th style="padding:10px">Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></body></html>`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${today}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredTransactions.length} transactions as Excel`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const handleExportPDF = async () => {
    try {
      const rows = filteredTransactions.map((t, i) => {
        const catInfo = getCategoryInfo(t.category);
        const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
        const color = t.type === "income" ? "#059669" : "#dc2626";
        const tags = Array.isArray(t.tags) ? t.tags.join(", ") : (t.tags || "");
        const notes = t.notes || "";
        const recurring = isRecurring(t);
        return `<tr style="background:${bg}">
          <td style="padding:7px;border:1px solid #ddd;font-size:10px">${t.date}</td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px">
            ${t.merchant || "Unknown"}
            ${recurring ? '<span style="font-size:8px;background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 4px;margin-left:4px">↻ Recurring</span>' : ""}
          </td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px">${t.description}</td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px">${catInfo.name}</td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px;color:${color};font-weight:bold;text-align:right">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px;color:#4f46e5">${tags}</td>
          <td style="padding:7px;border:1px solid #ddd;font-size:10px;color:#6b7280;font-style:italic">${notes}</td>
        </tr>`;
      }).join("");
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Popup blocked. Please allow popups to export PDF.");
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>FinTrack Transaction Report</title>
        <style>
          body{font-family:Arial,sans-serif;padding:20px}
          h1{color:#1e40af;font-size:24px}
          table{width:100%;border-collapse:collapse}
          th{background:#1e40af;color:white;padding:8px;text-align:left;font-size:10px}
          .print-btn{position:fixed;top:20px;right:20px;background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600}
          @media print{.print-btn{display:none}}
        </style>
        </head><body>
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <h1>FinTrack Transaction Report</h1>
        <p style="color:#6b7280">Generated: ${new Date().toLocaleString()} | Total: ${filteredTransactions.length} transactions</p>
        <table>
          <thead><tr>
            <th>Date</th><th>Merchant</th><th>Description</th><th>Category</th>
            <th style="text-align:right">Amount</th><th>Tags</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
      toast.success("PDF print dialog opened");
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const onToggleSelect = (id: string) => {
    setSelectedTransactions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onToggleSelectAll = (checked: boolean) => {
    // ✅ Select all on current page only
    setSelectedTransactions(checked ? paginatedTransactions.map((t) => t.id!) : []);
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.length === 0) return;
    if (!confirm(`Delete ${selectedTransactions.length} transaction(s)?`)) return;
    try {
      await Promise.all(selectedTransactions.map((id) => transactionsAPI.delete(id)));
      setTransactions((prev) => prev.filter((t) => !selectedTransactions.includes(t.id!)));
      setFilteredTransactions((prev) => prev.filter((t) => !selectedTransactions.includes(t.id!)));
      setSelectedTransactions([]);
      toast.success(`Deleted ${selectedTransactions.length} transactions`);
    } catch (err) {
      toast.error("Failed to delete transactions");
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id!);
    setEditForm(transaction);
    setEditTagsStr((transaction.tags || []).join(", "));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setEditTagsStr("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const uiType = (editForm.type ?? "expense") as TxType;
      const backendCategory = mapCategoryToBackend(editForm.category as Exclude<CategoryId, "all">, uiType);
      const tagsArr = editTagsStr.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await transactionsAPI.update(editingId, {
        date: editForm.date!,
        description: editForm.description!,
        category: backendCategory,
        amount: editForm.amount!,
        type: uiType.toUpperCase(),
        status: editForm.status ?? "completed",
        notes: editForm.notes || null,
        tags: tagsArr.join(",") || null,
      } as any);
      const normalized = normalizeTransaction(updated);
      const updateFn = (list: Transaction[]) =>
        list.map((t) =>
          t.id === editingId
            ? {
                ...normalized,
                status: editForm.status || t.status,
                paymentMethod: editForm.paymentMethod || t.paymentMethod,
                merchant: editForm.merchant || normalized.merchant,
                notes: editForm.notes || normalized.notes,
                tags: tagsArr.length > 0 ? tagsArr : normalized.tags,
              }
            : t,
        );
      setTransactions(updateFn);
      setFilteredTransactions(updateFn);
      setEditingId(null);
      setEditForm({});
      setEditTagsStr("");
      toast.success("Transaction updated successfully");
    } catch (err) {
      toast.error("Failed to update transaction");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await transactionsAPI.delete(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setFilteredTransactions((prev) => prev.filter((t) => t.id !== id));
      setSelectedTransactions((prev) => prev.filter((x) => x !== id));
      toast.success("Transaction deleted");
    } catch (err) {
      toast.error("Failed to delete transaction");
    }
  };

  const handleDuplicate = (transaction: Transaction) => {
    setPrefillTx({
      type: transaction.type,
      category: mapCategoryToBackend(transaction.category, transaction.type),
      amount: Math.abs(transaction.amount),
      date: new Date().toISOString().split("T")[0],
      merchant: transaction.merchant || "",
      description: transaction.description,
    });
    setShowAdd(true);
    toast.info("Transaction duplicated — ready to save");
  };

  const handleAddSave = async (tx: { type: string; category: string; amount: number; date: string; merchant: string; description: string; status?: string; notes?: string; tags?: string }) => {
    const created = await transactionsAPI.create({
      date: tx.date,
      description: tx.description.trim() || tx.merchant.trim(),
      amount: Math.abs(tx.amount),
      category: tx.category,
      type: tx.type.toUpperCase() as "INCOME" | "EXPENSE",
      merchant: tx.merchant.trim(),
      ...(tx.status ? { status: tx.status } : {}),
      ...(tx.notes ? { notes: tx.notes } : {}),
      ...(tx.tags ? { tags: tx.tags } : {}),
    } as any);
    const newTx: Transaction = { ...normalizeTransaction(created), merchant: tx.merchant.trim() };
    setTransactions((prev) => [newTx, ...prev]);
    setFilteredTransactions((prev) => [newTx, ...prev]);
    setPrefillTx(null);
    toast.success("Transaction added successfully");
  };

  const applyQuickDateFilter = (days: number) => {
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - days);
    setActiveFilters((prev) => ({
      ...prev,
      dateFrom: days === 0 ? today.toISOString().slice(0, 10) : fromDate.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    }));
  };

  const clearFilters = () => {
    setActiveFilters({ sort: "date-desc" });
    setFilteredTransactions(transactions);
  };

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (activeFilters.search) count++;
    if (activeFilters.type && activeFilters.type !== "all") count++;
    if (activeFilters.category) count++;
    if (activeFilters.dateFrom) count++;
    if (activeFilters.dateTo) count++;
    if (activeFilters.minAmount) count++;
    if (activeFilters.maxAmount) count++;
    return count;
  }, [activeFilters]);

  // Filter + sort effect
  React.useEffect(() => {
    let filtered = [...transactions];
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      filtered = filtered.filter((t) => (t.merchant || "").toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (activeFilters.type && activeFilters.type !== "all") {
      filtered = filtered.filter((t) => t.type === activeFilters.type);
    }
    if (activeFilters.category) {
      const catId = mapCategoryToUI(activeFilters.category);
      filtered = filtered.filter((t) => t.category === catId);
    }
    if (activeFilters.dateFrom) filtered = filtered.filter((t) => t.date >= activeFilters.dateFrom!);
    if (activeFilters.dateTo) filtered = filtered.filter((t) => t.date <= activeFilters.dateTo!);
    if (activeFilters.minAmount !== undefined) filtered = filtered.filter((t) => Math.abs(t.amount) >= activeFilters.minAmount!);
    if (activeFilters.maxAmount !== undefined) filtered = filtered.filter((t) => Math.abs(t.amount) <= activeFilters.maxAmount!);

    const sort = activeFilters.sort || "date-desc";
    filtered = filtered.sort((a, b) => {
      switch (sort) {
        case "date-desc": return +new Date(b.date) - +new Date(a.date);
        case "date-asc": return +new Date(a.date) - +new Date(b.date);
        case "amount-desc": return Math.abs(b.amount) - Math.abs(a.amount);
        case "amount-asc": return Math.abs(a.amount) - Math.abs(b.amount);
        default: return 0;
      }
    });

    setFilteredTransactions(filtered);
    setSelectedTransactions([]);
    setCurrentPage(1); // ✅ Reset to page 1 on filter change
  }, [transactions, activeFilters]);

  /* =========================
     Loading / Error states
     ========================= */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 rounded-xl p-6 mb-4">
            <p className="text-red-600 dark:text-red-400 font-semibold mb-2">⚠️ Error Loading Transactions</p>
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
          <button onClick={loadTransactions} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     Main UI
     ========================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <PageContent>
        <PageHeader
          title="Transactions"
          description={`${filteredTransactions.length} of ${transactions.length} transactions${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search transactions..."
                value={activeFilters.search || ""}
                onChange={(e) => setActiveFilters((prev) => ({ ...prev, search: e.target.value }))}
                size="sm"
                icon={<Search className="w-4 h-4" />}
              />
              <Button
                variant={showFilters || activeFilterCount > 0 ? "secondary" : "ghost"}
                size="sm"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportCSV}>
                CSV
              </Button>
              <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportExcel}>
                Excel
              </Button>
              <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportPDF}>
                PDF
              </Button>
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>
                <span className="hidden sm:inline">Add Transaction</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          }
        />

        <main>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Income</span>
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">From filtered results</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Expenses</span>
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.expenses)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">From filtered results</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Net Amount</span>
              <div className={`w-8 h-8 bg-gradient-to-br ${totals.net >= 0 ? "from-blue-500 to-blue-600" : "from-gray-500 to-gray-600"} rounded-lg flex items-center justify-center`}>
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className={`text-2xl font-bold ${totals.net >= 0 ? "text-blue-600" : "text-gray-600"}`}>
              {formatCurrency(totals.net)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">From filtered results</p>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTransactions.length > 0 && (
          <BulkActions
            selectedCount={selectedTransactions.length}
            onBulkDelete={handleBulkDelete}
            onBulkCategorize={async (categoryId) => {
              try {
                const selectedTxs = filteredTransactions.filter((t) => selectedTransactions.includes(t.id!));
                await Promise.all(
                  selectedTxs.map((transaction) =>
                    transactionsAPI.update(transaction.id!, {
                      date: transaction.date,
                      description: transaction.description,
                      category: mapCategoryToBackend(categoryId as Exclude<CategoryId, "all">, transaction.type),
                      amount: transaction.amount,
                      type: transaction.type,
                    }),
                  ),
                );
                await loadTransactions();
                setSelectedTransactions([]);
                toast.success(`Updated category for ${selectedTxs.length} transaction${selectedTxs.length > 1 ? "s" : ""}`);
              } catch (err) {
                toast.error("Failed to update categories");
              }
            }}
            onBulkExport={async (format) => {
              const selectedTxs = filteredTransactions.filter((t) => selectedTransactions.includes(t.id!));
              const today = new Date().toISOString().split("T")[0];
              try {
                if (format === "csv") {
                  const headers = "Date,Merchant,Description,Category,Amount,Type,Payment Method,Status,Recurring,Tags,Notes";
                  const rows = selectedTxs.map((t) => {
                    const catInfo = getCategoryInfo(t.category);
                    const tags = Array.isArray(t.tags) ? t.tags.join("; ") : (t.tags || "");
                    const notes = (t.notes || "").replace(/"/g, '""');
                    const recurring = isRecurring(t) ? "Yes" : "No";
                    return `"${t.date}","${t.merchant || "Unknown"}","${t.description}","${catInfo.name}","${formatCurrency(t.amount)}","${t.type}","${t.paymentMethod}","${t.status}","${recurring}","${tags}","${notes}"`;
                  });
                  const blob = new Blob(["\uFEFF" + [headers, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `transactions-selected-${today}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(`Exported ${selectedTxs.length} selected transactions as CSV`);
                  setSelectedTransactions([]);
                }
              } catch (err: any) {
                toast.error(`Export failed: ${err.message}`);
              }
            }}
            onBulkDuplicate={() => {
              if (selectedTransactions.length === 1) {
                const transaction = filteredTransactions.find((t) => t.id === selectedTransactions[0]);
                if (transaction) handleDuplicate(transaction);
              } else {
                toast.info("Please select exactly one transaction to duplicate");
              }
            }}
            onClearSelection={() => setSelectedTransactions([])}
          />
        )}

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Clear all filters
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Quick Date Range</label>
              <div className="flex flex-wrap gap-2">
                {QUICK_DATE_FILTERS.map((filter) => (
                  <button
                    key={filter.label}
                    onClick={() => applyQuickDateFilter(filter.days)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Type</label>
                <select value={activeFilters.type || "all"} onChange={(e) => setActiveFilters((prev) => ({ ...prev, type: e.target.value as "all" | TxType }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100">
                  <option value="all">All Types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Category</label>
                <select value={activeFilters.category || ""} onChange={(e) => setActiveFilters((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100">
                  <option value="">All Categories</option>
                  {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Sort By</label>
                <select value={activeFilters.sort} onChange={(e) => setActiveFilters((prev) => ({ ...prev, sort: e.target.value as TxFilters["sort"] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100">
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="amount-desc">Amount (High to Low)</option>
                  <option value="amount-asc">Amount (Low to High)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">From Date</label>
                <input type="date" value={activeFilters.dateFrom || ""} onChange={(e) => setActiveFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">To Date</label>
                <input type="date" value={activeFilters.dateTo || ""} onChange={(e) => setActiveFilters((prev) => ({ ...prev, dateTo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Min Amount</label>
                <input type="number" step="0.01" placeholder="0.00" value={activeFilters.minAmount || ""} onChange={(e) => setActiveFilters((prev) => ({ ...prev, minAmount: e.target.value ? parseFloat(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Max Amount</label>
                <input type="number" step="0.01" placeholder="0.00" value={activeFilters.maxAmount || ""} onChange={(e) => setActiveFilters((prev) => ({ ...prev, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={paginatedTransactions.length > 0 && paginatedTransactions.every((t) => selectedTransactions.includes(t.id!))}
                      onChange={(e) => onToggleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Merchant</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Payment</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Amount</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTransactions.map((t) => {
                  const cat = getCategoryInfo(t.category);
                  const isEditing = editingId === t.id;

                  return (
                    <tr
                      key={t.id}
                      id={`txn-${t.id}`}
                      className={`transition-colors ${highlightId === t.id ? "bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-400 ring-inset" : selectedTransactions.includes(t.id!) ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.includes(t.id!)}
                          onChange={() => onToggleSelect(t.id!)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                        />
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input type="date" value={editForm.date} onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))} className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" />
                        ) : (
                          <>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {isMounted ? formatRelativeClientOnly(t.date) : formatAbsolute(t.date)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{dtUS(new Date(t.date))}</div>
                          </>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-2 min-w-[200px]">
                            <input type="text" value={editForm.merchant || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, merchant: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" placeholder="Merchant" />
                            <input type="text" value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" placeholder="Description" />
                            <input type="text" value={editTagsStr} onChange={(e) => setEditTagsStr(e.target.value)} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" placeholder="Tags: business, vacation" />
                            <input type="text" value={editForm.notes || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" placeholder="Private notes..." />
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 bg-gradient-to-br ${t.type === "income" ? "from-green-500 to-green-600" : "from-blue-500 to-blue-600"} rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                              {(t.merchant || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{t.merchant || "Unknown"}</span>
                                {isRecurring(t) && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    Recurring
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{t.description}</div>
                              {t.aiSuggested && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                  <span className="text-xs text-purple-600 font-medium">AI Suggested</span>
                                </div>
                              )}
                              {t.tags && t.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {t.tags.map((tag, i) => (
                                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {t.notes && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic truncate max-w-[200px]" title={t.notes}>
                                  📝 {t.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select value={editForm.category} onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value as Exclude<CategoryId, "all"> }))} className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100">
                            {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
                            <span>{cat.icon}</span>
                            {cat.name}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{t.paymentMethod}</td>

                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <input type="number" step="0.01" value={Math.abs(editForm.amount as number || 0)} onChange={(e) => setEditForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) }))} className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100" />
                        ) : (
                          <div className={`text-base font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "income" ? "+" : ""}{formatCurrency(t.amount)}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setEditForm((prev) => ({ ...prev, status: "completed" }))}
                              className={`px-2 py-1 rounded-full text-xs font-semibold transition-colors ${editForm.status === "completed" ? "bg-green-100 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 ring-1 ring-green-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-emerald-900/20"}`}
                            >
                              ✓ Completed
                            </button>
                            <button
                              onClick={() => setEditForm((prev) => ({ ...prev, status: "pending" }))}
                              className={`px-2 py-1 rounded-full text-xs font-semibold transition-colors ${editForm.status === "pending" ? "bg-yellow-100 dark:bg-amber-900/20 text-yellow-700 dark:text-amber-400 ring-1 ring-yellow-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-amber-900/20"}`}
                            >
                              ⏱ Pending
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${t.status === "completed" ? "bg-green-100 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400" : "bg-yellow-100 dark:bg-amber-900/20 text-yellow-700 dark:text-amber-400"}`}>
                            {t.status === "completed" ? "Completed" : "Pending"}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={handleSaveEdit} className="p-2 hover:bg-green-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Save">
                              <Check className="w-4 h-4 text-green-600 dark:text-emerald-400" />
                            </button>
                            <button onClick={handleCancelEdit} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Cancel">
                              <Close className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleEdit(t)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </button>
                            <button onClick={() => handleDuplicate(t)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Duplicate">
                              <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button onClick={() => handleDelete(t.id!)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 ? (
            <Alert variant="info" title="No transactions found">
              <div className="space-y-3">
                <p>
                  {activeFilterCount > 0 ? "Try adjusting your filters or search query" : "Get started by adding your first transaction"}
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            </Alert>
          ) : (
            /* ✅ Pagination footer */
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)}
                </span>{" "}
                of <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredTransactions.length}</span> transactions
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 dark:text-gray-500 text-sm">...</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item as number)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === item
                              ? "bg-blue-600 text-white"
                              : "border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700"
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-gray-700 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      </PageContent>

      {/* Add Transaction Modal — unified with AI auto-categorization */}
      <TransactionModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setPrefillTx(null); }}
        onSave={handleAddSave}
        transaction={prefillTx}
        mode="add"
      />

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}