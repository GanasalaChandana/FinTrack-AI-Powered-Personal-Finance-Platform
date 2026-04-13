"use client";

import React, { useState, useRef } from "react";
import {
  Camera, Upload, X, Check, AlertCircle, Loader2,
  Edit2, Save, ScanLine, RotateCcw,
} from "lucide-react";
import { parseReceiptImage, type ParsedReceipt } from "@/lib/utils/ocrParser";

interface ReceiptScannerProps {
  onReceiptParsed?: (receipt: ParsedReceipt) => void;
  onSaveTransaction?: (transaction: any) => void;
}

const CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Healthcare",
  "Entertainment", "Bills & Utilities", "Groceries", "Education",
  "Travel", "Personal Care", "Other",
];

export function ReceiptScanner({ onReceiptParsed, onSaveTransaction }: ReceiptScannerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select a valid image file"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be less than 10MB"); return; }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedImage(ev.target?.result as string);
      setError(null);
      setParsedData(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageFile) { setError("Please select an image first"); return; }
    setIsProcessing(true);
    setError(null);
    try {
      const result = await parseReceiptImage(imageFile);
      setParsedData(result);
      setEditedData({
        merchant: result.merchant,
        date: result.date,
        amount: result.total,
        category: result.category,
        description: `Receipt from ${result.merchant}`,
        type: "expense",
      });
      onReceiptParsed?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse receipt");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveTransaction = () => {
    if (!editedData || !onSaveTransaction) return;
    onSaveTransaction(editedData);
    handleReset();
  };

  const handleReset = () => {
    setSelectedImage(null); setImageFile(null);
    setParsedData(null); setError(null);
    setIsEditing(false); setEditedData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const confidence = parsedData?.confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);
  const confidenceStyle =
    confidence >= 0.7 ? { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500", label: "High Confidence" } :
    confidence >= 0.4 ? { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   bar: "bg-amber-400",   label: "Medium Confidence" } :
                        { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     bar: "bg-red-500",     label: "Low Confidence" };

  const inputCls = "w-full rounded-xl border-2 border-gray-100 dark:border-gray-600 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 transition placeholder:text-gray-400 dark:placeholder:text-gray-500";

  return (
    <div className="space-y-5">

      {/* ── Step 1: Upload ───────────────────────────────────────────────── */}
      {!selectedImage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              ref: cameraInputRef,
              capture: "environment" as const,
              icon: Camera,
              label: "Take Photo",
              sub: "Use your device camera to capture a receipt",
              color: "#6366f1",
              bg: "hover:bg-indigo-50 hover:border-indigo-400",
            },
            {
              ref: fileInputRef,
              capture: undefined,
              icon: Upload,
              label: "Upload Image",
              sub: "Select a receipt image from your device",
              color: "#8b5cf6",
              bg: "hover:bg-violet-50 hover:border-violet-400",
            },
          ].map((item) => (
            <button key={item.label}
              onClick={() => item.ref.current?.click()}
              className={`group rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center transition-all duration-200 ${item.bg} hover:shadow-md`}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${item.color}12`, border: `1.5px solid ${item.color}25` }}>
                <item.icon className="w-7 h-7" style={{ color: item.color }} />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{item.label}</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">{item.sub}</p>
              <input ref={item.ref} type="file" accept="image/*"
                capture={item.capture} onChange={handleFileSelect} className="hidden" />
            </button>
          ))}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-400">Error</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Preview ──────────────────────────────────────────────── */}
      {selectedImage && !parsedData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Preview</p>
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700">
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center" style={{ minHeight: 220 }}>
            <img src={selectedImage} alt="Receipt preview"
              className="max-h-80 w-auto object-contain rounded-xl" />
          </div>

          <button onClick={handleScan} disabled={isProcessing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:opacity-90 transition disabled:opacity-60">
            {isProcessing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing receipt…</>
              : <><ScanLine className="w-4 h-4" /> Scan Receipt</>
            }
          </button>
        </div>
      )}

      {/* ── Step 3: Results ──────────────────────────────────────────────── */}
      {parsedData && (
        <div className="space-y-4">

          {/* Confidence bar */}
          <div className={`rounded-2xl border px-4 py-3 ${confidenceStyle.bg} ${confidenceStyle.border}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${confidenceStyle.text}`} />
                <span className={`text-sm font-bold ${confidenceStyle.text}`}>
                  Scan Complete — {confidenceStyle.label}
                </span>
              </div>
              <span className={`text-sm font-extrabold font-mono ${confidenceStyle.text}`}>
                {confidencePct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${confidenceStyle.bar}`}
                style={{ width: `${confidencePct}%` }} />
            </div>
          </div>

          {/* Extracted data card */}
          <div className="bg-slate-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Extracted Data</p>
              <button onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isEditing
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                }`}>
                <Edit2 className="w-3 h-3" />
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>

            <div className="p-5">
              {isEditing ? (
                <div className="space-y-3">
                  {[
                    { label: "Merchant", key: "merchant", type: "text" },
                    { label: "Date", key: "date", type: "date" },
                    { label: "Amount", key: "amount", type: "number" },
                    { label: "Description", key: "description", type: "text" },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                        {field.label}
                      </label>
                      <input type={field.type} value={editedData?.[field.key] || ""}
                        step={field.type === "number" ? "0.01" : undefined}
                        onChange={(e) => setEditedData({ ...editedData, [field.key]: field.type === "number" ? parseFloat(e.target.value) : e.target.value })}
                        className={inputCls} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select value={editedData?.category || ""} onChange={(e) => setEditedData({ ...editedData, category: e.target.value })} className={inputCls}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Merchant", value: parsedData.merchant },
                    { label: "Date", value: parsedData.date },
                    { label: "Category", value: parsedData.category, pill: true },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{row.label}</span>
                      {row.pill
                        ? <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold">{row.value}</span>
                        : <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{row.value}</span>
                      }
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total</span>
                    <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">${parsedData.total.toFixed(2)}</span>
                  </div>

                  {parsedData.items.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                        Items ({parsedData.items.length})
                      </p>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {parsedData.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-xl px-3 py-2">
                            <span>{item.quantity}× {item.name}</span>
                            <span className="font-semibold text-gray-800 dark:text-gray-100">${item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail + actions */}
          {selectedImage && (
            <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3">
              <img src={selectedImage} alt="Receipt thumbnail"
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-100 dark:border-gray-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Original Image</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{imageFile?.name ?? "receipt.jpg"}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={handleSaveTransaction}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:opacity-90 transition">
              <Save className="w-4 h-4" /> Save Transaction
            </button>
            <button onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 dark:border-gray-600 px-5 py-3 text-sm font-bold text-gray-500 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition">
              <RotateCcw className="w-4 h-4" /> Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}