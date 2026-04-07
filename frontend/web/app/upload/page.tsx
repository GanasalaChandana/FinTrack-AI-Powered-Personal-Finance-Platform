"use client";

import React, { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

/* ---------- Auth helpers ---------- */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const getToken = (): string | null =>
  typeof window !== "undefined"
    ? localStorage.getItem("ft_token") || localStorage.getItem("authToken")
    : null;

const getUserId = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem("userId") : null;

/* ---------- Types ---------- */

interface PreviewRow {
  [key: string]: string;
}

interface UploadResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors?: string[];
}

/* ---------- Sample CSV template ---------- */

const SAMPLE_CSV = `date,description,amount,category,type
2025-01-15,Starbucks Coffee,5.80,Food & Dining,EXPENSE
2025-01-14,Amazon Purchase,89.99,Shopping,EXPENSE
2025-01-13,Salary,3500.00,Income,INCOME
2025-01-12,Uber Ride,15.50,Transportation,EXPENSE
2025-01-11,Netflix,15.99,Entertainment,EXPENSE`;

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "fintrack-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Component ---------- */

const CSVUploadSystem: React.FC = () => {
  const [step,        setStep]        = useState<number>(1);
  const [file,        setFile]        = useState<File | null>(null);
  const [isDragging,  setIsDragging]  = useState<boolean>(false);
  const [headers,     setHeaders]     = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows,   setTotalRows]   = useState<number>(0);
  const [processing,  setProcessing]  = useState<boolean>(false);
  const [result,      setResult]      = useState<UploadResult | null>(null);
  const [error,       setError]       = useState<string>("");

  /* ---------- Drag & drop ---------- */

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) handleFile(dropped);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected) handleFile(selected);
  };

  /* ---------- File processing ---------- */

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please upload a CSV file (.csv)");
      return;
    }
    setFile(selectedFile);
    setError("");

    // Count total rows + grab preview
    let rowCount = 0;
    Papa.parse<PreviewRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        rowCount = results.data.length;
        setTotalRows(rowCount);
        setHeaders(results.meta.fields ?? []);
        setPreviewRows(results.data.slice(0, 5));
        setStep(2);
      },
      error: () => {
        setError("Failed to parse CSV. Check that it's a valid CSV file.");
      },
    });
  };

  /* ---------- Import ---------- */

  const handleImport = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token  = getToken();
      const userId = getUserId();

      const response = await fetch(`${API_BASE_URL}/api/transactions/upload`, {
        method: "POST",
        headers: {
          ...(token  && { Authorization: `Bearer ${token}` }),
          ...(userId && { "X-User-Id": userId }),
        },
        body: formData,
        credentials: "include",
      });

      if (response.status === 401) {
        localStorage.removeItem("ft_token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        window.location.href = "/register?mode=signin";
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Upload failed (${response.status})`);
      }

      setResult({
        totalRows:    data.totalRows    ?? totalRows,
        successCount: data.successCount ?? 0,
        errorCount:   data.errorCount   ?? 0,
        errors:       data.errors,
      });
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  /* ---------- Reset ---------- */

  const resetUpload = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setResult(null);
    setError("");
  };

  /* ---------- Step 1 — Upload ---------- */

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload Your Transactions</h2>
        <p className="text-gray-600">Import CSV files from your bank or financial institution</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-105"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          id="file-upload"
        />

        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Upload className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {isDragging ? "Drop your file here" : "Drag & drop your CSV file"}
          </h3>
          <p className="text-gray-600 mb-6">or click to browse from your computer</p>

          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <FileText className="w-5 h-5" />
            Select CSV File
          </label>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Supported Formats
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 ml-7">
          <li>• CSV files (.csv) — up to 10 MB</li>
          <li>• Required columns: <strong>date</strong>, <strong>description</strong>, <strong>amount</strong></li>
          <li>• Optional columns: category, type (INCOME / EXPENSE), merchant_name, notes</li>
          <li>• Dates: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY</li>
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
          <div className="text-3xl font-bold text-green-700">1</div>
          <div className="text-sm text-green-600 font-medium">Upload File</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-xl">
          <div className="text-3xl font-bold text-gray-400">2</div>
          <div className="text-sm text-gray-500 font-medium">Preview Data</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-xl">
          <div className="text-3xl font-bold text-gray-400">3</div>
          <div className="text-sm text-gray-500 font-medium">Import</div>
        </div>
      </div>
    </div>
  );

  /* ---------- Step 2 — Preview ---------- */

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Preview Your Data</h2>
          <p className="text-gray-600">
            {totalRows} row{totalRows !== 1 ? "s" : ""} detected — review before importing
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-700">{file?.name}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Column chips */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Detected Columns</p>
        <div className="flex flex-wrap gap-2">
          {headers.map((h) => (
            <span
              key={h}
              className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-sm"
            >
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    {headers.map((h) => (
                      <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {row[h] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 text-center">
            Showing first {previewRows.length} of {totalRows} row{totalRows !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={resetUpload}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 transition-all shadow-lg"
        >
          {processing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Import {totalRows} Transaction{totalRows !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );

  /* ---------- Step 3 — Success / partial error ---------- */

  const renderSuccessStep = () => {
    if (!result) return null;
    const hasErrors = result.errorCount > 0;

    return (
      <div className="text-center space-y-6 py-12">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-xl ${
            hasErrors
              ? "bg-gradient-to-br from-amber-400 to-amber-500"
              : "bg-gradient-to-br from-green-500 to-green-600 animate-bounce"
          }`}
        >
          {hasErrors ? (
            <AlertTriangle className="w-12 h-12 text-white" />
          ) : (
            <CheckCircle className="w-12 h-12 text-white" />
          )}
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {hasErrors ? "Import Completed with Warnings" : "Import Successful!"}
          </h2>
          <p className="text-lg text-gray-600">
            {result.successCount} transaction{result.successCount !== 1 ? "s" : ""} imported successfully
            {hasErrors && `, ${result.errorCount} row${result.errorCount !== 1 ? "s" : ""} skipped`}
          </p>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 text-center">
            <div className="text-2xl font-bold text-green-700">{result.successCount}</div>
            <div className="text-sm text-green-600">Imported</div>
          </div>
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-center">
              <div className="text-2xl font-bold text-red-700">{result.errorCount}</div>
              <div className="text-sm text-red-600">Skipped</div>
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{result.totalRows}</div>
            <div className="text-sm text-gray-500">Total Rows</div>
          </div>
        </div>

        {/* Row-level errors */}
        {result.errors && result.errors.length > 0 && (
          <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-lg mx-auto">
            <p className="text-sm font-semibold text-amber-800 mb-2">Skipped rows:</p>
            <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-center pt-6">
          <button
            onClick={resetUpload}
            className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Another File
          </button>
          <button
            onClick={() => (window.location.href = "/transactions")}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            View Transactions
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  /* ---------- Render ---------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          {step === 1 && renderUploadStep()}
          {step === 2 && renderPreviewStep()}
          {step === 3 && renderSuccessStep()}
        </div>

        {step === 1 && (
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Need a sample CSV file?</p>
            <button
              onClick={downloadSample}
              className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Sample Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVUploadSystem;
