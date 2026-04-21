// lib/utils/pdfExport.ts — Client-side PDF report generation (jsPDF + autoTable)
// Runs entirely in the browser — no backend required.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Transaction {
  id?: string;
  date: string;
  description?: string;
  merchant?: string;
  category: string;
  amount: number;
  type: string; // "income" | "expense" | "INCOME" | "EXPENSE"
}

interface Budget {
  category: string;
  budget: number;
  spent: number;
  icon?: string;
}

interface ExportOptions {
  title?: string;
  dateRange?: string;
  orientation?: "portrait" | "landscape";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const isIncome = (t: Transaction) =>
  t.type?.toLowerCase() === "income";

const isExpense = (t: Transaction) =>
  !isIncome(t);

/** Draw a filled rounded rectangle (jsPDF doesn't support borderRadius, so we approximate) */
function filledRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
  doc.setFillColor(r, g, b);
  doc.rect(x, y, w, h, "F");
}

/** Draw a horizontal progress bar */
function progressBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number, over: boolean) {
  // Track
  doc.setFillColor(230, 232, 240);
  doc.rect(x, y, w, h, "F");
  // Fill
  const fillW = Math.min(w, (w * Math.min(pct, 100)) / 100);
  if (over) doc.setFillColor(239, 68, 68);   // red
  else if (pct >= 80) doc.setFillColor(249, 115, 22); // orange
  else doc.setFillColor(99, 102, 241);        // indigo
  if (fillW > 0) doc.rect(x, y, fillW, h, "F");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: exportMonthlyReport
// The flagship export — takes transactions + optional budgets, generates a
// professional 2-page PDF report entirely client-side.
// ─────────────────────────────────────────────────────────────────────────────

export function exportMonthlyReport(
  transactions: Transaction[],
  budgets: Budget[] = [],
  period?: string   // e.g. "March 2026" — defaults to current month
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();   // 210
  const PH = doc.internal.pageSize.getHeight();  // 297
  const now = new Date();
  const reportPeriod = period ?? now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const generatedOn  = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

  // ── Compute summary stats ─────────────────────────────────────────────────
  const totalIncome   = transactions.filter(isIncome).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = transactions.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netSavings    = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Category breakdown
  const catMap = new Map<string, number>();
  transactions.filter(isExpense).forEach(t => {
    const cat = t.category || "Other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
  });
  const categories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8); // top 8

  // ── PAGE 1 ────────────────────────────────────────────────────────────────

  // Branded header strip
  filledRect(doc, 0, 0, PW, 28, 79, 70, 229);  // indigo-600
  filledRect(doc, 0, 22, PW, 8, 109, 40, 217); // violet-600 gradient effect

  // FinTrack logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FinTrack", 14, 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text("AI-Powered Financial Report", 14, 18);

  // Report title (right-aligned)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(reportPeriod, PW - 14, 12, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(199, 210, 254);
  doc.text(`Generated ${generatedOn}`, PW - 14, 18, { align: "right" });

  let y = 36;

  // ── KPI boxes row ─────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("FINANCIAL SUMMARY", 14, y);
  y += 6;

  const kpis = [
    { label: "Total Income",   value: fmt(totalIncome),           r:16,g:185,b:129 }, // emerald
    { label: "Total Expenses", value: fmt(totalExpenses),          r:239,g:68,b:68 }, // red
    { label: "Net Savings",    value: fmt(netSavings),             r:99,g:102,b:241 }, // indigo
    { label: "Savings Rate",   value: `${savingsRate.toFixed(1)}%`,r:245,g:158,b:11 }, // amber
  ];

  const boxW = (PW - 28 - 9) / 4; // 4 boxes with 3 gaps of 3mm
  kpis.forEach(({ label, value, r, g, b }, i) => {
    const bx = 14 + i * (boxW + 3);
    const by = y;
    // Background
    doc.setFillColor(r, g, b);
    doc.setDrawColor(r, g, b);
    doc.rect(bx, by, boxW, 22, "F");
    // Left accent bar
    doc.setFillColor(Math.max(r - 30, 0), Math.max(g - 30, 0), Math.max(b - 30, 0));
    doc.rect(bx, by, 2, 22, "F");
    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(label.toUpperCase(), bx + 5, by + 7);
    // Value
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(value, bx + 5, by + 16);
  });
  y += 28;

  // ── Spending by category ──────────────────────────────────────────────────
  if (categories.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("SPENDING BY CATEGORY", 14, y);
    y += 5;

    const maxAmt = categories[0][1];

    categories.forEach(([cat, amt]) => {
      const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
      const barPct = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;

      // Category name
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(cat, 14, y + 4);

      // Amount (right of bar)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(fmt(amt), PW - 14, y + 4, { align: "right" });

      // Percentage text
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text(`${pct.toFixed(1)}%`, PW - 32, y + 4, { align: "right" });

      // Progress bar
      progressBar(doc, 55, y + 1, 100, 4, barPct, false);

      y += 9;
    });
    y += 3;
  }

  // ── Budget performance table (if budgets provided) ────────────────────────
  if (budgets.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("BUDGET PERFORMANCE", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Category", "Budget", "Spent", "Remaining", "Usage"]],
      body: budgets.map(b => {
        const pct = b.budget > 0 ? (b.spent / b.budget) * 100 : 0;
        return [
          b.category,
          fmt(b.budget),
          fmt(b.spent),
          fmt(Math.max(b.budget - b.spent, 0)),
          `${pct.toFixed(1)}%`,
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "center" },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: data => {
        if (data.column.index === 4 && data.section === "body") {
          const pct = parseFloat(data.cell.text[0]);
          if (pct >= 100)      data.cell.styles.textColor = [239, 68, 68];
          else if (pct >= 80)  data.cell.styles.textColor = [249, 115, 22];
          else                 data.cell.styles.textColor = [16, 185, 129];
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ── PAGE 2: Transaction detail ────────────────────────────────────────────
  doc.addPage();
  filledRect(doc, 0, 0, PW, 14, 79, 70, 229);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Transaction Detail", 14, 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(199, 210, 254);
  doc.text(`${transactions.length} transactions · ${reportPeriod}`, PW - 14, 9, { align: "right" });

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  autoTable(doc, {
    startY: 20,
    head: [["Date", "Merchant / Description", "Category", "Type", "Amount"]],
    body: sorted.map(t => [
      t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }) : "—",
      t.merchant || t.description || "—",
      t.category || "Other",
      isIncome(t) ? "Income" : "Expense",
      fmt(Math.abs(t.amount)),
    ]),
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 65 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28, halign: "right" },
    },
    didParseCell: data => {
      if (data.column.index === 4 && data.section === "body") {
        const row = sorted[data.row.index];
        if (row) {
          data.cell.styles.textColor = isIncome(row) ? [16, 185, 129] : [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount}`,
      PW / 2, PH - 8, { align: "center" }
    );
    doc.text("Generated by FinTrack · fintrack-liart.vercel.app", 14, PH - 8);
  }

  // Save
  const slug = reportPeriod.replace(/\s+/g, "-").toLowerCase();
  doc.save(`fintrack-report-${slug}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy: exportTransactionsToPDF (backward compat with ExportMenu)
// ─────────────────────────────────────────────────────────────────────────────

export const exportTransactionsToPDF = (
  transactions: Transaction[],
  options: ExportOptions = {}
) => {
  const {
    title = "Transaction Report",
    dateRange = "All Time",
  } = options;
  exportMonthlyReport(transactions, [], title !== "Transaction Report" ? title : dateRange);
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy: exportBudgetReportToPDF (backward compat)
// ─────────────────────────────────────────────────────────────────────────────

export const exportBudgetReportToPDF = (budgets: Budget[], options: ExportOptions = {}) => {
  const { dateRange = "Current Period" } = options;
  // Generate with no transactions, only budgets
  exportMonthlyReport([], budgets, dateRange);
};
