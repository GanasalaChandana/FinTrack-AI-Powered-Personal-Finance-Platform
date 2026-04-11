"use client";

import { useState, useEffect, useRef } from "react";
import { X, DollarSign, Calendar, Tag, FileText, TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface Transaction {
  id?: number;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  merchant: string;
  description: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => Promise<void>;
  transaction?: Transaction | null;
  mode?: "add" | "edit";
}

const EXPENSE_CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Entertainment",
  "Bills & Utilities", "Healthcare", "Housing", "Health & Fitness",
  "Insurance", "Personal Care", "Education", "Travel", "Savings", "Other",
];

const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Business", "Gift", "Other"];

// Local keyword lookup — runs first before hitting the ML API
const MERCHANT_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ["starbucks", "coffee", "cafe", "dunkin", "tim hortons", "peet", "panera", "chipotle", "mcdonald", "burger", "pizza", "subway", "kfc", "taco", "wendys", "domino", "sushi", "restaurant", "diner", "grill", "bistro", "bakery", "donut", "smoothie", "juice", "instacart", "doordash", "ubereats", "grubhub", "postmates", "whole foods", "trader joe", "walmart grocery", "kroger", "safeway", "aldi", "publix", "costco food"], category: "Food & Dining" },
  { keywords: ["uber", "lyft", "taxi", "shell", "bp", "chevron", "exxon", "mobil", "gas", "fuel", "parking", "metro", "transit", "bus", "train", "airline", "delta", "united", "southwest", "american air"], category: "Transportation" },
  { keywords: ["netflix", "spotify", "hulu", "disney", "hbo", "apple tv", "youtube premium", "twitch", "cinema", "amc", "movie", "concert", "ticket", "steam", "playstation", "xbox", "nintendo", "gaming"], category: "Entertainment" },
  { keywords: ["amazon", "walmart", "target", "ebay", "etsy", "zara", "h&m", "nike", "adidas", "apple store", "best buy", "costco", "ikea", "home depot", "lowes", "tj maxx", "nordstrom", "macys"], category: "Shopping" },
  { keywords: ["at&t", "verizon", "t-mobile", "comcast", "xfinity", "spectrum", "electric", "water bill", "gas bill", "internet", "isp", "utility", "pg&e", "duke energy", "con ed"], category: "Bills & Utilities" },
  { keywords: ["cvs", "walgreens", "pharmacy", "hospital", "clinic", "doctor", "dental", "optometry", "medical", "health center", "urgent care", "lab"], category: "Healthcare" },
  { keywords: ["planet fitness", "gym", "anytime fitness", "24 hour fitness", "yoga", "crossfit", "equinox", "la fitness", "peloton"], category: "Health & Fitness" },
  { keywords: ["rent", "mortgage", "apartment", "property", "landlord", "hoa"], category: "Housing" },
  { keywords: ["udemy", "coursera", "skillshare", "linkedin learning", "book", "barnes", "tuition", "school", "university", "college"], category: "Education" },
  { keywords: ["hotel", "marriott", "hilton", "airbnb", "expedia", "booking.com", "flight", "travel", "vacation", "resort"], category: "Travel" },
  { keywords: ["state farm", "geico", "allstate", "progressive", "insurance", "premium"], category: "Insurance" },
  { keywords: ["haircut", "salon", "spa", "beauty", "barber", "nail"], category: "Personal Care" },
];

function keywordMatch(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { keywords, category } of MERCHANT_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}


export function TransactionModal({ isOpen, onClose, onSave, transaction, mode = "add" }: TransactionModalProps) {
  const [formData, setFormData] = useState<Transaction>({
    type: "expense",
    category: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    merchant: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [predicting, setPredicting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (transaction && mode === "edit") {
      setFormData(transaction);
      setAiSuggested(false);
    } else if (mode === "add") {
      // Support prefill for duplicate — strip the id
      setFormData(transaction
        ? { ...transaction, id: undefined }
        : { type: "expense", category: "", amount: 0, date: new Date().toISOString().split("T")[0], merchant: "", description: "" }
      );
      setAiSuggested(false);
    }
  }, [transaction, mode, isOpen]);

  // Auto-categorize when merchant or description changes (expense only)
  useEffect(() => {
    if (mode === "edit") return;
    if (formData.type !== "expense") return;

    const text = [formData.merchant, formData.description].filter(Boolean).join(" ").trim();
    if (text.length < 2) return;

    // Step 1: instant local keyword match — no debounce, no API call
    const local = keywordMatch(text);
    if (local) {
      setFormData((prev) => {
        if (prev.category && !aiSuggested) return prev;
        return { ...prev, category: local };
      });
      setAiSuggested(true);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    // Step 2: unknown merchant — debounce then call ML API
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setPredicting(true);
      try {
        const result = await apiRequest<{ category: string; confidence: number }>(
          "/api/transactions/classify",
          { method: "POST", body: JSON.stringify({ description: text }) }
        );
        if (result?.category && result.category !== "Uncategorized" && result.category !== "Other") {
          const normalized = result.category.toLowerCase();
          const matched = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === normalized);
          const finalCategory = matched || result.category;
          setFormData((prev) => {
            if (prev.category && !aiSuggested) return prev;
            return { ...prev, category: finalCategory };
          });
          setAiSuggested(true);
        }
      } catch { /* silent */ }
      setPredicting(false);
    }, 700);

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.merchant, formData.description, formData.type, mode]);

  const categories = formData.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.merchant.trim()) newErrors.merchant = "Merchant is required";
    if (formData.amount <= 0) newErrors.amount = "Amount must be greater than 0";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.date) newErrors.date = "Date is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full rounded-lg border ${errors[field] ? "border-red-300" : "border-gray-300 dark:border-gray-600"} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 pl-10 pr-4 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {mode === "edit" ? "Edit Transaction" : "Add New Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Type Toggle */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => { setFormData({ ...formData, type: "expense", category: "" }); setAiSuggested(false); }}
                className={`flex items-center justify-center gap-2 rounded-xl p-4 font-semibold transition-all ${
                  formData.type === "expense"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-2 ring-red-500"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <TrendingDown className="h-5 w-5" />
                Expense
              </button>
              <button
                type="button"
                onClick={() => { setFormData({ ...formData, type: "income", category: "" }); setAiSuggested(false); }}
                className={`flex items-center justify-center gap-2 rounded-xl p-4 font-semibold transition-all ${
                  formData.type === "income"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-2 ring-green-500"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <TrendingUp className="h-5 w-5" />
                Income
              </button>
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Merchant */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Merchant / Source
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.merchant}
                  onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                  className={inputClass("merchant")}
                  placeholder="e.g., Starbucks, Salary"
                />
              </div>
              {errors.merchant && <p className="mt-1 text-sm text-red-600">{errors.merchant}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className={inputClass("amount")}
                  placeholder="0.00"
                />
              </div>
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
            </div>

            {/* Category */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                {predicting && (
                  <span className="flex items-center gap-1 text-xs text-indigo-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI suggesting...
                  </span>
                )}
                {!predicting && aiSuggested && formData.category && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                    <Sparkles className="h-3 w-3" />
                    AI suggested
                  </span>
                )}
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.category}
                  onChange={(e) => { setFormData({ ...formData, category: e.target.value }); setAiSuggested(false); }}
                  className={`w-full appearance-none rounded-lg border ${
                    errors.category ? "border-red-300" : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 pl-10 pr-10 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
            </div>

            {/* Date */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={inputClass("date")}
                />
              </div>
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
            </div>
          </div>

          {/* Description */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 pl-10 pr-4 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Add any notes about this transaction..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border-2 border-gray-300 dark:border-gray-600 px-6 py-2.5 font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : mode === "edit" ? "Update" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
