// lib/utils/ocrParser.ts
import Tesseract from 'tesseract.js';

export interface ParsedReceipt {
  merchant: string;
  date: string;
  total: number;
  items: ReceiptItem[];
  category: string;
  confidence: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

// Common merchant patterns
const MERCHANT_PATTERNS = [
  /walmart/i, /target/i, /costco/i, /safeway/i, /kroger/i,
  /whole foods/i, /trader joe/i, /amazon/i, /starbucks/i,
  /mcdonald/i, /subway/i, /best buy/i, /home depot/i, /lowes?/i,
  /ikea/i, /cvs/i, /walgreens/i, /rite aid/i, /dollar tree/i,
  /dollar general/i, /aldi/i, /publix/i, /wegmans/i, /sprouts/i,
  /chipotle/i, /domino/i, /pizza hut/i, /taco bell/i, /wendy/i,
  /chick.fil/i, /panera/i, /dunkin/i, /peet/i, /in.n.out/i,
  /shell/i, /chevron/i, /exxon/i, /mobil/i, /bp\b/i, /circle k/i,
  /macy/i, /nordstrom/i, /gap\b/i, /old navy/i, /h&m/i, /zara/i,
  /apple store/i, /microsoft/i, /staples/i, /office depot/i,
];

// Price patterns
const PRICE_PATTERN = /\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
const TOTAL_PATTERNS = [
  /total[:\s]+\$?\s*(-?\d+\.?\d*)/i,
  /amount[:\s]+\$?\s*(-?\d+\.?\d*)/i,
  /balance[:\s]+\$?\s*(-?\d+\.?\d*)/i,
  /grand total[:\s]+\$?\s*(-?\d+\.?\d*)/i,
  /refund[:\s]+\$?\s*(-?\d+\.?\d*)/i,
  /return[:\s]+\$?\s*(-?\d+\.?\d*)/i,
];

// Date patterns
const DATE_PATTERNS = [
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
  /(\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/,
  /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/,
];

export const parseReceiptImage = async (imageFile: File): Promise<ParsedReceipt> => {
  try {
    // Perform OCR
    const result = await Tesseract.recognize(imageFile, 'eng', {
      logger: (m) => console.log(m),
    });

    const text = result.data.text;
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    // Extract merchant
    const merchant = extractMerchant(lines);

    // Extract date
    const date = extractDate(text);

    // Extract total
    const total = extractTotal(lines);

    // Extract items
    const items = extractItems(lines);

    // Determine category
    const category = determineCategory(merchant, items);

    // Calculate confidence
    const confidence = calculateConfidence(merchant, date, total, items);

    return {
      merchant,
      date,
      total,
      items,
      category,
      confidence,
    };
  } catch (error) {
    console.error('OCR parsing failed:', error);
    throw new Error('Failed to parse receipt. Please try again with a clearer image.');
  }
};

/** Strip OCR noise characters, keeping letters, digits, spaces, and basic punctuation */
function cleanMerchantLine(line: string): string {
  return line
    .replace(/[^a-zA-Z0-9\s&',.\-#]/g, ' ') // remove >, |, {, }, *, etc.
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns true if the line is plausibly a merchant name */
function isLikelyMerchant(line: string): boolean {
  if (line.length < 3) return false;
  // Reject if more than half the chars are digits (prices, phone numbers)
  const digits = (line.match(/\d/g) || []).length;
  if (digits / line.length > 0.5) return false;
  // Reject street addresses
  if (/\d+\s+\w+\s+(st|ave|rd|blvd|dr|ln|way|ct|pl|suite|ste)\b/i.test(line)) return false;
  // Reject phone numbers
  if (/\d{3}[\s\-\.]\d{3,4}/.test(line)) return false;
  // Reject date-like strings
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(line)) return false;
  return true;
}

function extractMerchant(lines: string[]): string {
  const searchLines = lines.slice(0, 7);

  // 1. Known merchant match (highest confidence)
  for (const line of searchLines) {
    for (const pattern of MERCHANT_PATTERNS) {
      if (pattern.test(line)) {
        return cleanMerchantLine(line);
      }
    }
  }

  // 2. All-caps line (store names are typically printed in all-caps on receipts)
  let bestAllCaps = '';
  for (const line of searchLines) {
    const cleaned = cleanMerchantLine(line);
    if (!isLikelyMerchant(cleaned)) continue;
    const letters = cleaned.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase() && cleaned.length > bestAllCaps.length) {
      bestAllCaps = cleaned;
    }
  }
  if (bestAllCaps) return bestAllCaps;

  // 3. Longest valid line in first 7 lines
  let best = '';
  for (const line of searchLines) {
    const cleaned = cleanMerchantLine(line);
    if (isLikelyMerchant(cleaned) && cleaned.length > best.length) {
      best = cleaned;
    }
  }
  if (best) return best;

  return 'Unknown Merchant';
}

function extractDate(text: string): string {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDate(match[1]);
    }
  }
  return new Date().toISOString().split('T')[0];
}

/** Convert any extracted date string to YYYY-MM-DD for the backend */
function normalizeDate(raw: string): string {
  try {
    // Try MM/DD/YY or MM/DD/YYYY or MM-DD-YY etc.
    const sep = raw.includes('/') ? '/' : '-';
    const parts = raw.split(sep);
    if (parts.length === 3) {
      let [a, b, c] = parts;
      // Two-digit year → four-digit
      if (c.length === 2) c = `20${c}`;
      // If first part looks like a 4-digit year: YYYY-MM-DD already
      if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
      // Otherwise assume MM/DD/YYYY
      return `${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`;
    }
    // Try parsing as a natural date string (e.g. "April 5, 2026")
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {
    // fall through
  }
  return new Date().toISOString().split('T')[0];
}

function extractTotal(lines: string[]): number {
  // Look for total in last 10 lines (search from the bottom up)
  const relevantLines = lines.slice(-10);

  for (const line of relevantLines) {
    for (const pattern of TOTAL_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount !== 0) {
          return amount; // allow negative totals (refunds/returns)
        }
      }
    }
  }

  // Fallback: find largest absolute price in receipt
  let maxPrice = 0;
  for (const line of lines) {
    const match = line.match(PRICE_PATTERN);
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (Math.abs(price) > Math.abs(maxPrice)) {
        maxPrice = price;
      }
    }
  }

  return maxPrice;
}

function extractItems(lines: string[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];

  for (const line of lines) {
    const priceMatch = line.match(PRICE_PATTERN);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      
      // Extract item name (text before price)
      const name = line.substring(0, line.indexOf(priceMatch[0])).trim();
      
      // Try to extract quantity
      const qtyMatch = name.match(/(\d+)\s*x\s*/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      if (name && price > 0 && price < 1000) {
        // Filter out likely totals/subtotals
        if (!/total|tax|subtotal|balance/i.test(name)) {
          items.push({
            name: name.replace(/\d+\s*x\s*/i, '').trim(),
            quantity,
            price,
          });
        }
      }
    }
  }

  return items;
}

function determineCategory(merchant: string, items: ReceiptItem[]): string {
  const merchantLower = merchant.toLowerCase();

  // Grocery stores
  if (/(walmart|target|kroger|safeway|whole foods|trader joe|costco)/i.test(merchantLower)) {
    return 'Food & Dining';
  }

  // Restaurants
  if (/(restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|subway)/i.test(merchantLower)) {
    return 'Food & Dining';
  }

  // Gas stations
  if (/(shell|chevron|exxon|mobil|gas|fuel)/i.test(merchantLower)) {
    return 'Transportation';
  }

  // Retail
  if (/(amazon|best buy|home depot|lowes|macy)/i.test(merchantLower)) {
    return 'Shopping';
  }

  // Pharmacy
  if (/(cvs|walgreens|pharmacy|rite aid)/i.test(merchantLower)) {
    return 'Healthcare';
  }

  return 'Other';
}

function calculateConfidence(
  merchant: string,
  date: string,
  total: number,
  items: ReceiptItem[]
): number {
  let confidence = 0;

  // Merchant found: +30%
  if (merchant && merchant !== 'Unknown Merchant') {
    confidence += 0.3;
  }

  // Valid date: +20%
  if (date && date !== new Date().toISOString().split('T')[0]) {
    confidence += 0.2;
  }

  // Valid total: +30%
  if (total > 0) {
    confidence += 0.3;
  }

  // Items found: +20%
  if (items.length > 0) {
    confidence += 0.2;
  }

  return Math.min(confidence, 1);
}

// Preprocess image for better OCR results
export const preprocessImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const contrast = 1.5;
    const adjusted = ((avg - 128) * contrast) + 128;
    
    data[i] = adjusted;     // R
    data[i + 1] = adjusted; // G
    data[i + 2] = adjusted; // B
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};