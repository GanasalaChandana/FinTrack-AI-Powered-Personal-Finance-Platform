/**
 * Reads transactions out of a bank or credit-card statement PDF's text, into the
 * same shape the CSV/OFX import uses. Works on the common layout — one transaction
 * per line: date, description, amount (and sometimes a running balance) — and on
 * Chase card statements in particular. Scanned (image-only) PDFs have no text and
 * are reported as unreadable.
 */

export const PDF_HEADERS = ["Date", "Merchant", "Description", "Amount", "Type"];

export interface PdfParsed {
  headers: string[];
  rows: Record<string, string>[];
  /** Card payments ("Payment Thank You") left out: paying the card isn't spending or income. */
  skippedPayments: number;
}

const AMOUNT = String.raw`\(?-?\$?\s?\d{1,3}(?:,\d{3})*\.\d{2}\)?-?`;
const TXN_LINE = new RegExp(
  String.raw`^\s*(\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(?:\d{1,2}/\d{1,2}(?:/\d{2,4})?\s+)?(.+?)\s+(${AMOUNT})(?:\s+(${AMOUNT}))?\s*$`,
);
const SKIP_LINE = /\b(total|balance|minimum payment|payment due|opening\/closing|statement date|credit (access )?line|available|year-to-date|interest charge|annual percentage)\b/i;
const CARD_PAYMENT = /payment\s*(-\s*)?thank you|autopay|payment received|online payment|mobile payment/i;

type Section = "in" | "out" | null;

function sectionOf(line: string): Section | undefined {
  const l = line.trim();
  if (l.length > 60 || /\d+\.\d{2}/.test(l)) return undefined;
  if (/^(deposits|credits|deposits and (other )?(additions|credits)|payments and other credits|other credits)\b/i.test(l)) return "in";
  if (/^(withdrawals|debits|purchases?|checks paid|electronic withdrawals|atm (&|and) debit card withdrawals|fees( charged)?|other debits|cash advances?)\b/i.test(l)) return "out";
  return undefined;
}

function toNumber(raw: string): number {
  const negative = /^\(.*\)$/.test(raw.trim()) || raw.includes("-");
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return negative ? -n : n;
}

/** The statement's closing date, which gives the year for "MM/DD" transaction dates. */
function closingDate(text: string): { year: number; month: number } {
  const range = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(?:-|–|to|through)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (range) {
    const y = Number(range[6]);
    return { year: y < 100 ? 2000 + y : y, month: Number(range[4]) };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function isoDate(raw: string, closing: { year: number; month: number }): string {
  const [m, d, y] = raw.split("/").map(Number);
  let year = y ? (y < 100 ? 2000 + y : y) : closing.year;
  // A December purchase on a January statement belongs to the year before
  if (!y && m > closing.month) year -= 1;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "SQ *ARWA COFFEE LLC Irving TX" → "Arwa Coffee LLC"; "TARGET T-1032 IRVING TX" → "Target". */
export function merchantName(description: string): string {
  let s = description.replace(/^(sq|tst|sp|pp|paypal|in|py)\s*\*\s*/i, "");
  s = s.split("*")[0];
  const words = s.trim().split(/\s+/);
  const cut = words.findIndex((w, i) => i > 0 && /\d/.test(w));
  let kept = cut > 0 ? words.slice(0, cut) : words;
  // Drop a trailing "CITY ST"
  if (cut < 0 && kept.length > 3 && /^[A-Z]{2}$/.test(kept[kept.length - 1])) kept = kept.slice(0, -2);
  const name = kept.join(" ").trim() || description.trim();
  return name.replace(/\w\S*/g, (w) => (w.length <= 3 && w === w.toUpperCase() && /[A-Z]/.test(w) && !/^(THE|AND)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));
}

export function parseStatementText(text: string): PdfParsed {
  const isCard = /credit (access )?line|minimum payment due|new balance/i.test(text);
  const closing = closingDate(text);
  const rows: Record<string, string>[] = [];
  let skippedPayments = 0;
  let section: Section = null;

  for (const line of text.split(/\r?\n/)) {
    const s = sectionOf(line);
    if (s !== undefined) { section = s; continue; }
    const m = line.match(TXN_LINE);
    if (!m) continue;
    const [, date, rawDesc, rawAmount] = m;
    const description = rawDesc.replace(/\s{2,}/g, " ").trim();
    if (SKIP_LINE.test(description) || !/[a-z]/i.test(description)) continue;

    let amount = toNumber(rawAmount);
    if (isCard) {
      // Card statements: charges are positive, payments and refunds negative
      if (CARD_PAYMENT.test(description)) { skippedPayments++; continue; }
      amount = -amount;
    } else if (section === "out") {
      amount = -Math.abs(amount);
    } else if (section === "in") {
      amount = Math.abs(amount);
    }
    if (amount === 0 || isNaN(amount)) continue;

    rows.push({
      Date: isoDate(date, closing),
      Merchant: merchantName(description),
      Description: description,
      Amount: amount.toFixed(2),
      Type: amount < 0 ? "expense" : "income",
    });
  }

  if (rows.length === 0) {
    throw new Error(
      "Couldn't find transactions in this PDF. If it's a scan or photo, it has no text to read. " +
      "Try your bank's CSV or QFX download instead (usually under Account activity → Download).",
    );
  }
  return { headers: PDF_HEADERS, rows, skippedPayments };
}

/** Rebuilds the PDF's lines (pdf.js gives text pieces with positions) and parses them. */
export async function parsePdfStatement(file: File): Promise<PdfParsed> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return parseStatementText(await pdfLines(doc));
}

type TextItem = { str: string; transform: number[] };
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> };

export async function pdfLines(doc: PdfDoc): Promise<string> {
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as TextItem[]) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // same baseline, give or take a point
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parts]) => out.push(parts.sort((a, b) => a.x - b.x).map((q) => q.s.trim()).join("  ")));
  }
  return out.join("\n");
}
