// components/CSVImportModal.tsx — Smart bank CSV importer
// Step 1: Upload  →  Step 2: Map columns  →  Step 3: Preview & import
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Upload, FileText, AlertCircle, Download, CheckCircle,
  ChevronRight, ChevronLeft, Loader2, Sparkles, Info,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Public types (unchanged — dashboard passes these)
// ─────────────────────────────────────────────────────────────────────────────

export interface CSVRow {
  [key: string]: string | number;
}

export interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: CSVRow[]) => Promise<void>;
  requiredHeaders?: string[];   // kept for back-compat, no longer strict
  title?: string;
  description?: string;
  maxFileSize?: number;
  sampleData?: CSVRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface Parsed {
  headers: string[];
  rows: Record<string, string>[];
}

interface ColumnMap {
  date: string;
  merchant: string;
  description: string;
  amount: string;
  type: string;
  category: string;
}

interface MappedRow {
  date: string;
  merchant: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Robust CSV parser (handles quoted commas, CRLF, BOM)
// ─────────────────────────────────────────────────────────────────────────────

function parseCSVRobust(text: string): Parsed {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const lines = clean.split("\n").filter(l => l.trim());
  if (lines.length === 0) throw new Error("CSV file is empty.");
  if (lines.length < 2) throw new Error("CSV has no data rows (only a header).");

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i]);
    if (vals.every(v => v === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }

  return { headers, rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detect column mapping
// ─────────────────────────────────────────────────────────────────────────────

const ALIASES: Record<keyof ColumnMap, string[]> = {
  date:        ["date","transaction date","trans date","post date","settlement date","value date","posted","booked date","trn date"],
  merchant:    ["merchant","payee","name","description","reference","memo","narration","beneficiary","to"],
  description: ["description","details","transaction description","memo","note","narration","remarks"],
  amount:      ["amount","transaction amount","debit","credit","value","sum","total","net amount","payment"],
  type:        ["type","transaction type","credit/debit","debit/credit","cr/dr","dr/cr","direction"],
  category:    ["category","tag","label","group","type"],
};

function autoDetectMapping(headers: string[]): ColumnMap {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const best = (field: keyof ColumnMap): string => {
    for (const alias of ALIASES[field]) {
      const match = headers.find(h => norm(h) === alias);
      if (match) return match;
    }
    // partial match
    for (const alias of ALIASES[field]) {
      const match = headers.find(h => norm(h).includes(alias) || alias.includes(norm(h)));
      if (match) return match;
    }
    return "";
  };
  return {
    date:        best("date"),
    merchant:    best("merchant"),
    description: best("description"),
    amount:      best("amount"),
    type:        best("type"),
    category:    best("category"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-categorize by merchant/description keywords
// ─────────────────────────────────────────────────────────────────────────────

const CAT_RULES: Array<{ kw: string[]; cat: string }> = [
  { kw:["starbucks","dunkin","tim hortons","coffee","tea","café","cafe","mcdonald","burger king","kfc","taco bell","wendy","subway","chipotle","domino","pizza","sushi","ramen","panda express","chili","applebee","ihop","waffle house","cheesecake factory","olive garden","red lobster","outback","doordash","grubhub","ubereats","postmates","deliveroo","instacart grocery","restaurant","diner","bistro","grill","eatery","bakery","buffet","noodle","shawarma"],cat:"Food & Dining"},
  { kw:["netflix","spotify","hulu","disney+","disney plus","hbo","apple tv","peacock","paramount","amazon prime video","youtube premium","twitch","xbox","playstation","steam","nintendo","game","cinema","amc","regal","theater","theatre","concert","ticketmaster","stubhub","live nation"],cat:"Entertainment"},
  { kw:["shell","chevron","exxon","bp","mobil","sunoco","valero","marathon","speedway","pilot","loves","wawa","gas station","fuel","petrol","uber","lyft","grab","taxi","transit","mta","bart","cta","metro","bus pass","train","amtrak","parking","lot","garage","ez-pass","fastrak","toll"],cat:"Transportation"},
  { kw:["amazon","walmart","target","costco","sam's club","best buy","ebay","etsy","aliexpress","shein","h&m","zara","gap","old navy","banana republic","nordstrom","macy","kohls","tj maxx","ross","marshalls","homegoods","bed bath","ikea","wayfair","overstock","chewy","petco","petsmart"],cat:"Shopping"},
  { kw:["comcast","xfinity","at&t","verizon","t-mobile","spectrum","cox","centurylink","frontier","internet","cable","electric","electricity","utility","pgande","pge","con ed","duke energy","national grid","water bill","gas bill","waste","trash","phone bill","cell phone"],cat:"Bills & Utilities"},
  { kw:["cvs","walgreens","rite aid","duane reade","pharmacy","doctor","physician","hospital","clinic","urgent care","dentist","optometrist","vision","lens","health insurance","medical","lab","quest diagnostics","radiology","therapy","counseling","mental health"],cat:"Healthcare"},
  { kw:["rent","mortgage","hoa","homeowners association","property management","landlord","realtor","zillow","apartment","lease"],cat:"Housing"},
  { kw:["planet fitness","la fitness","anytime fitness","gold's gym","equinox","soulcycle","peloton","crunch fitness","orange theory","crossfit","ymca","gym","fitness","yoga","pilates","workout"],cat:"Health & Fitness"},
  { kw:["udemy","coursera","linkedin learning","skillshare","masterclass","edx","school","university","college","tuition","student loan","textbook","book","course","class","workshop","training"],cat:"Education"},
  { kw:["airbnb","vrbo","hotel","marriott","hilton","hyatt","ihg","best western","holiday inn","expedia","booking.com","hotels.com","kayak","southwest","delta","united","american airlines","jetblue","spirit","frontier airlines","allegiant","flight","airline","travel"],cat:"Travel"},
  { kw:["salary","payroll","direct deposit","ach deposit","paycheck","employer","wage","compensation"],cat:"Salary"},
  { kw:["freelance","consulting","invoice","client payment","upwork","fiverr","toptal"],cat:"Freelance"},
  { kw:["dividend","interest earned","investment return","robinhood","fidelity","vanguard","schwab","etrade"],cat:"Investment"},
];

function autoCategorize(merchant: string, desc: string): string {
  const text = `${merchant} ${desc}`.toLowerCase();
  for (const { kw, cat } of CAT_RULES) {
    if (kw.some(k => text.includes(k))) return cat;
  }
  return "Other";
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply mapping & derive type / category
// ─────────────────────────────────────────────────────────────────────────────

function applyMapping(rows: Record<string, string>[], map: ColumnMap): MappedRow[] {
  return rows.map(row => {
    const merchant    = (row[map.merchant] ?? row[map.description] ?? "").trim();
    const description = (row[map.description] ?? row[map.merchant] ?? "").trim();
    const date        = (row[map.date] ?? "").trim();
    const rawAmt      = parseFloat((row[map.amount] ?? "0").replace(/[,$\s]/g, "")) || 0;
    const rawType     = (row[map.type] ?? "").toLowerCase();
    const rawCat      = (row[map.category] ?? "").trim();

    // Infer type from amount sign or Type column
    let type: "income" | "expense";
    if (rawType.includes("credit") || rawType.includes("income") || rawType === "cr") {
      type = "income";
    } else if (rawType.includes("debit") || rawType.includes("expense") || rawType === "dr") {
      type = "expense";
    } else {
      // Chase exports negative for expenses, positive for income
      type = rawAmt >= 0 ? "income" : "expense";
    }

    const amount   = Math.abs(rawAmt);
    const category = rawCat || autoCategorize(merchant, description);

    return { date, merchant, description, amount, type, category };
  }).filter(r => r.date && r.amount > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample CSV download
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_CSV = `Date,Merchant,Description,Amount,Type,Category
2024-01-01,Employer Inc,Monthly Salary,5500,income,Salary
2024-01-05,Whole Foods,Grocery Shopping,-145,expense,Food & Dining
2024-01-08,Comcast,Internet Bill,-80,expense,Bills & Utilities
2024-01-14,Netflix,Streaming Subscription,-15.99,expense,Entertainment
2024-01-15,Shell,Gas Fill-up,-58,expense,Transportation
2024-01-20,Starbucks,Morning Coffee,-22,expense,Food & Dining
`;

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "fintrack-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type Step = "upload" | "map" | "preview";

const REQUIRED_FIELDS: Array<{ key: keyof ColumnMap; label: string; required: boolean }> = [
  { key: "date",        label: "Date",         required: true  },
  { key: "merchant",    label: "Merchant/Payee",required: true  },
  { key: "amount",      label: "Amount",        required: true  },
  { key: "type",        label: "Income/Expense",required: false },
  { key: "category",    label: "Category",      required: false },
  { key: "description", label: "Description",   required: false },
];

const CATEGORY_OPTIONS = [
  "Food & Dining","Transportation","Shopping","Entertainment","Bills & Utilities",
  "Healthcare","Housing","Health & Fitness","Education","Travel",
  "Salary","Freelance","Investment","Other",
];

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen, onClose, onImport,
  title = "Import Bank Transactions",
  description = "Upload a CSV export from any bank — we'll detect the columns automatically.",
  maxFileSize = 10,
  sampleData,      // kept for compat, we use our own sample
}) => {
  const [step,       setStep]       = useState<Step>("upload");
  const [parsed,     setParsed]     = useState<Parsed | null>(null);
  const [colMap,     setColMap]     = useState<ColumnMap>({ date:"",merchant:"",description:"",amount:"",type:"",category:"" });
  const [mapped,     setMapped]     = useState<MappedRow[]>([]);
  const [error,      setError]      = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [fileName,   setFileName]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setStep("upload"); setParsed(null);
      setColMap({ date:"",merchant:"",description:"",amount:"",type:"",category:"" });
      setMapped([]); setError(null); setFileName("");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file."); return;
    }
    if (file.size / 1024 / 1024 > maxFileSize) {
      setError(`File must be under ${maxFileSize} MB.`); return;
    }
    try {
      const text   = await file.text();
      const result = parseCSVRobust(text);
      const detectedMap = autoDetectMapping(result.headers);
      setParsed(result);
      setColMap(detectedMap);
      setFileName(file.name);
      setStep("map");
    } catch (e: any) {
      setError(e.message ?? "Could not parse the file.");
    }
  }, [maxFileSize]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  // ── Proceed from mapping step ──────────────────────────────────────────────

  const proceedToPreview = () => {
    if (!parsed) return;
    if (!colMap.date || !colMap.merchant || !colMap.amount) {
      setError("Please map at least: Date, Merchant/Payee, and Amount."); return;
    }
    setError(null);
    const rows = applyMapping(parsed.rows, colMap);
    if (rows.length === 0) {
      setError("No valid rows found after mapping. Check your column selections."); return;
    }
    setMapped(rows);
    setStep("preview");
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    try {
      const payload: CSVRow[] = mapped.map(r => ({
        Date: r.date, Merchant: r.merchant, Description: r.description,
        Amount: r.amount, Type: r.type, Category: r.category,
      }));
      await onImport(payload);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  // ── Category override per row ───────────────────────────────────────────────

  const setRowCategory = (i: number, cat: string) =>
    setMapped(prev => prev.map((r, idx) => idx === i ? { ...r, category: cat } : r));

  if (!isOpen) return null;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const STEP_LABELS = ["Upload", "Map Columns", "Preview & Import"];
  const stepIdx     = step === "upload" ? 0 : step === "map" ? 1 : 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && !importing && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{description}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step progress ───────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < stepIdx ? "bg-indigo-600 text-white" :
                  i === stepIdx ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-400" :
                  "bg-gray-100 dark:bg-gray-800 text-gray-400"
                }`}>
                  {i < stepIdx ? <CheckCircle className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === stepIdx ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-px ${i < stepIdx ? "bg-indigo-400" : "bg-gray-200 dark:bg-gray-700"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── Step 1: Upload ─────────────────────────────────────────── */}
          {step === "upload" && (
            <>
              {/* Drop zone */}
              <div
                onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                     style={{ background: dragActive ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)" }}>
                  <FileText className="w-7 h-7 text-indigo-500" />
                </div>
                <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  {dragActive ? "Drop your CSV here" : "Drag & drop your bank CSV"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse · max {maxFileSize} MB</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                       onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {/* Bank format info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Works with any bank</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      We automatically detect column names from Chase, Bank of America, Wells Fargo, Mint,
                      and 100+ other banks. If the auto-detection isn't perfect, you can manually map
                      columns in the next step.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["Chase","Bank of America","Wells Fargo","Mint","Citi","Capital One","Any bank CSV"].map(b=>(
                        <span key={b} className="text-[10px] font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-full">{b}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample download */}
              <button onClick={downloadSampleCSV}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <Download className="w-4 h-4" />
                Download sample CSV to see the expected format
              </button>
            </>
          )}

          {/* ── Step 2: Map columns ─────────────────────────────────────── */}
          {step === "map" && parsed && (
            <>
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{fileName}</p>
                  <p className="text-xs text-gray-500">{parsed.rows.length} rows · {parsed.headers.length} columns detected</p>
                </div>
                <button onClick={() => setStep("upload")} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium shrink-0">
                  Change file
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Column mapping</p>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background:"rgba(99,102,241,0.1)", color:"#6366f1" }}>
                    Auto-detected
                  </span>
                </div>
                <div className="space-y-2.5">
                  {REQUIRED_FIELDS.map(({ key, label, required }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {label}
                          {required && <span className="text-red-400 ml-0.5">*</span>}
                        </p>
                      </div>
                      <select
                        value={colMap[key]}
                        onChange={e => setColMap(prev => ({ ...prev, [key]: e.target.value }))}
                        className={`flex-1 text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                          colMap[key]
                            ? "border-emerald-400 dark:border-emerald-600"
                            : "border-gray-200 dark:border-gray-600"
                        }`}
                      >
                        <option value="">— not mapped —</option>
                        {parsed.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {colMap[key]
                        ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <div className="w-4 h-4 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw header preview */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Detected columns in your file:</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.headers.map(h => (
                    <span key={h} className="text-xs px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 font-mono">{h}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Preview ─────────────────────────────────────────── */}
          {step === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {mapped.length} rows ready to import
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Categories auto-detected — click to change
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {["Date","Merchant","Amount","Type","Category"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                      {mapped.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">{row.date}</td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-[140px] truncate">{row.merchant || row.description}</td>
                          <td className={`px-3 py-2 font-semibold whitespace-nowrap ${row.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {row.type === "income" ? "+" : "-"}${row.amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              row.type === "income"
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.category}
                              onChange={e => setRowCategory(i, e.target.value)}
                              className="text-[11px] px-1.5 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[130px]"
                            >
                              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {mapped.length > 50 && (
                  <div className="px-3 py-2 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                    Showing first 50 of {mapped.length} rows. All {mapped.length} will be imported.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 bg-white dark:bg-gray-900">
          {step === "map" && (
            <>
              <button onClick={() => setStep("upload")}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={proceedToPreview}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                Preview data <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("map")} disabled={importing}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleImport} disabled={importing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  : <><CheckCircle className="w-4 h-4" /> Import {mapped.length} transactions</>}
              </button>
            </>
          )}
          {step === "upload" && (
            <button onClick={onClose}
                    className="ml-auto px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
