"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Loader2, Sparkles, X, CheckCircle2,
  ArrowRight, ReceiptText, RefreshCw,
} from "lucide-react";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import { transactionsAPI, isAuthenticated as checkAuth } from "@/lib/api";
import type { ParsedReceipt } from "@/lib/utils/ocrParser";

// ── Saved transaction info shown after a successful save ──────────────────────
interface SavedTx {
  merchant:  string;
  amount:    number;
  category:  string;
  date:      string;
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [isAuth,    setIsAuth]    = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTx,   setSavedTx]   = useState<SavedTx | null>(null);
  const [scanCount, setScanCount] = useState(0); // key to force re-mount scanner after reset

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!checkAuth()) {
        router.replace("/register?mode=signin&reason=session_required");
      } else {
        setIsAuth(true);
        setIsLoading(false);
      }
    }
  }, [router]);

  // Called when Tesseract finishes parsing — just used for logging/debugging
  const handleReceiptParsed = (receipt: ParsedReceipt) => {
    console.log("✅ Receipt parsed:", {
      merchant:   receipt.merchant,
      total:      receipt.total,
      category:   receipt.category,
      confidence: `${Math.round(receipt.confidence * 100)}%`,
      items:      receipt.items.length,
    });
  };

  // Called when user clicks "Save Transaction" inside the scanner
  const handleSaveTransaction = async (transaction: any) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await transactionsAPI.create({
        date:        transaction.date,
        merchant:    transaction.merchant,
        description: transaction.description || `Receipt from ${transaction.merchant}`,
        amount:      transaction.amount,
        category:    transaction.category,
        type:        transaction.type || "expense",
      });

      // Show success state with transaction details
      setSavedTx({
        merchant: transaction.merchant || "Unknown merchant",
        amount:   transaction.amount   || 0,
        category: transaction.category || "Other",
        date:     transaction.date     || new Date().toISOString().split("T")[0],
      });
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save transaction. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleScanAnother = () => {
    setSavedTx(null);
    setSaveError(null);
    setScanCount((n) => n + 1); // re-mount scanner with fresh state
  };

  if (isLoading || !isAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-7">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">AI Powered</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Receipt Scanner</h1>
          <p className="text-gray-400 text-sm mt-1">
            Scan receipts and extract transaction data automatically.
          </p>
        </div>

        {/* ── Success State ──────────────────────────────────────────────────── */}
        {savedTx ? (
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-emerald-500" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Transaction Saved!</h2>
              <p className="text-sm text-gray-400 mb-6">
                Your receipt has been scanned and saved to your transactions.
              </p>

              {/* Summary card */}
              <div className="bg-slate-50 rounded-2xl border border-gray-100 p-5 mb-6 text-left space-y-3">
                {[
                  { label: "Merchant",  value: savedTx.merchant },
                  { label: "Amount",    value: fmt(savedTx.amount) },
                  { label: "Category",  value: savedTx.category },
                  { label: "Date",      value: new Date(savedTx.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.label === "Amount" ? "text-red-600 text-base font-extrabold" : "text-gray-800"}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => router.push("/transactions")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition"
                >
                  <ReceiptText className="w-4 h-4" />
                  View Transactions
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleScanAnother}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-5 py-3 text-sm font-bold text-gray-600 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Scan Another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Save Error Banner ──────────────────────────────────────────── */}
            {saveError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700">Failed to save</p>
                  <p className="text-xs text-red-600 mt-0.5">{saveError}</p>
                </div>
                <button onClick={() => setSaveError(null)} className="text-red-300 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Saving overlay ─────────────────────────────────────────────── */}
            {isSaving && (
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
                <p className="text-sm font-semibold text-indigo-700">Saving transaction…</p>
              </div>
            )}

            {/* ── Scanner Card ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right,#6366f1,#8b5cf6,#a855f7)" }} />
              <div className="p-6">
                <ReceiptScanner
                  key={scanCount}
                  onReceiptParsed={handleReceiptParsed}
                  onSaveTransaction={handleSaveTransaction}
                />
              </div>
            </div>

            {/* ── Tips Card ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-amber-400" />
              <div className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Tips for Best Results</h3>
                  <ul className="space-y-2">
                    {[
                      "Ensure good lighting — avoid shadows on the receipt",
                      "Keep the receipt flat and fully visible in frame",
                      "Capture the entire receipt including the total",
                      "Use high contrast — dark text on light background works best",
                      "Hold your device steady to avoid blurry images",
                      "After scanning, review and edit the extracted data if needed",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2.5 text-sm text-gray-500">
                        <span className="text-amber-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
