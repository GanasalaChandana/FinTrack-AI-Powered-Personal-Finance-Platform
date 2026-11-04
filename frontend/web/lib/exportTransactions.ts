// Shared, safe export for transactions (CSV, Excel, PDF).
//
// All text here comes from the user or from imported bank files, so:
//  - CSV cells are quoted and formula-like values are neutralised
//    (a cell starting with = + - @ would run as a formula in Excel)
//  - PDF/print HTML is escaped (it is written into a same-origin window,
//    so raw HTML in a description would run as script inside the app)
//  - Excel is a real .xlsx with plain-text cells (no HTML-disguised .xls)

import type { CellObject, SheetData } from "write-excel-file/browser";

export interface ExportRow {
  date: string;
  merchant: string;
  description: string;
  category: string;
  amount: number;      // positive; sign comes from `type`
  type: "income" | "expense";
  paymentMethod: string;
  status: string;
  recurring: boolean;
  tags: string;
  notes: string;
}

const HEADERS = ["Date", "Merchant", "Description", "Category", "Amount", "Type",
                 "Payment Method", "Status", "Recurring", "Tags", "Notes"];

const signedAmount = (r: ExportRow) => (r.type === "income" ? 1 : -1) * Math.abs(r.amount);

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV ────────────────────────────────────────────────────────────────────

export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Stop spreadsheet apps from treating user text as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = rows.map((r) => [
    r.date, r.merchant, r.description, r.category,
    signedAmount(r).toFixed(2), // numeric, so it's safe and sortable
    r.type, r.paymentMethod, r.status, r.recurring ? "Yes" : "No", r.tags, r.notes,
  ].map((v, i) => (i === 4 ? v : csvCell(v))).join(","));
  return [HEADERS.join(","), ...lines].join("\r\n");
}

export function exportCsv(rows: ExportRow[], filename: string) {
  // BOM so Excel opens UTF-8 (₹, €, accents) correctly
  download(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8;" }), filename);
}

// ── Excel (.xlsx) ──────────────────────────────────────────────────────────

export async function exportXlsx(rows: ExportRow[], filename: string) {
  // Loaded on demand — only people who export pay for the library
  const writeExcelFile = (await import("write-excel-file/browser")).default;

  const head = (value: string): CellObject =>
    ({ value, fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: "#1E40AF" });
  // Strings are always written as text cells (formulas need an explicit type), so a
  // merchant like "=HYPERLINK(...)" from an imported file can't run in Excel
  const text = (v: unknown): CellObject => ({ value: v == null ? "" : String(v), type: String });

  const sheetData: SheetData = [
    ["Date", "Merchant", "Description", "Category", "Amount", "Type", "Payment Method", "Status", "Recurring", "Tags", "Notes"].map(head),
    ...rows.map((r) => [
      text(r.date), text(r.merchant), text(r.description), text(r.category),
      { value: signedAmount(r), type: Number, format: "#,##0.00;[Red]-#,##0.00" },
      text(r.type), text(r.paymentMethod), text(r.status), text(r.recurring ? "Yes" : "No"),
      text(r.tags), text(r.notes),
    ]),
  ];
  const columns = [12, 24, 36, 18, 14, 10, 18, 12, 10, 20, 30].map((width) => ({ width }));

  const blob = await writeExcelFile(sheetData, { columns, stickyRowsCount: 1, sheet: "Transactions" }).toBlob();
  download(blob, filename);
}

// ── PDF (print view) ───────────────────────────────────────────────────────

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportPdf(rows: ExportRow[], formatAmount: (n: number) => string) {
  const body = rows.map((r, i) => {
    const color = r.type === "income" ? "#059669" : "#dc2626";
    return `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"}">
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.merchant)}${r.recurring ? ' <span class="rec">↻ Recurring</span>' : ""}</td>
      <td>${escapeHtml(r.description)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td style="color:${color};font-weight:bold;text-align:right">${r.type === "income" ? "+" : "-"}${escapeHtml(formatAmount(Math.abs(r.amount)))}</td>
      <td style="color:#4f46e5">${escapeHtml(r.tags)}</td>
      <td style="color:#6b7280;font-style:italic">${escapeHtml(r.notes)}</td>
    </tr>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup blocked. Please allow popups to export PDF.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>FinTrack Transaction Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px}
      h1{color:#1e40af;font-size:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e40af;color:white;padding:8px;text-align:left;font-size:10px}
      td{padding:7px;border:1px solid #ddd;font-size:10px}
      .rec{font-size:8px;background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 4px}
      .print-btn{position:fixed;top:20px;right:20px;background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600}
      @media print{.print-btn{display:none}}
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <h1>FinTrack Transaction Report</h1>
    <p style="color:#6b7280">Generated: ${escapeHtml(new Date().toLocaleString())} | Total: ${rows.length} transactions</p>
    <table><thead><tr>
      <th>Date</th><th>Merchant</th><th>Description</th><th>Category</th>
      <th style="text-align:right">Amount</th><th>Tags</th><th>Notes</th>
    </tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
