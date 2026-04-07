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
  // Grocery / big box
  /walmart/i, /target/i, /costco/i, /safeway/i, /kroger/i,
  /whole foods/i, /trader joe/i, /aldi/i, /publix/i, /wegmans/i,
  /sprouts/i, /food lion/i, /stop.?&.?shop/i, /giant eagle/i,
  /harris teeter/i, /meijer/i, /winn.?dixie/i, /save.?mart/i,
  // Online / delivery
  /amazon/i, /instacart/i, /doordash/i, /grubhub/i, /uber eats/i,
  /postmates/i,
  // Coffee
  /starbucks/i, /dunkin/i, /peet/i, /dutch bros/i, /tim horton/i,
  // Fast food / restaurants
  /mcdonald/i, /subway/i, /chick.fil/i, /chipotle/i, /domino/i,
  /pizza hut/i, /taco bell/i, /wendy/i, /panera/i, /in.n.out/i,
  /burger king/i, /sonic drive/i, /popeyes/i, /five guys/i,
  /shake shack/i, /jack in the box/i, /arby/i, /dairy queen/i,
  /wingstop/i, /olive garden/i, /applebee/i, /denny/i, /ihop/i,
  // Electronics / tech
  /best buy/i, /apple store/i, /microsoft/i, /b&h photo/i,
  /fry.s electronics/i,
  // Home / hardware
  /home depot/i, /lowes?/i, /ikea/i, /ace hardware/i, /true value/i,
  /menards/i, /floor.?&.?decor/i,
  // Pharmacy / health
  /cvs/i, /walgreens/i, /rite aid/i, /duane reade/i, /bartell/i,
  // Gas / auto
  /shell/i, /chevron/i, /exxon/i, /mobil/i, /bp\b/i, /circle k/i,
  /speedway/i, /wawa\b/i, /raceway/i, /arco\b/i, /valero/i,
  /sunoco/i, /marathon gas/i, /quiktrip/i, /casey.?s/i,
  // Office / supplies
  /staples/i, /office depot/i, /officemax/i,
  // Retail / fashion
  /macy/i, /nordstrom/i, /gap\b/i, /old navy/i, /h&m/i, /zara/i,
  /dollar tree/i, /dollar general/i, /five below/i, /ross\b/i,
  /t\.?j\.? max/i, /marshalls/i, /burlington/i, /bath.?&.?body/i,
  /victoria.?s secret/i, /forever 21/i, /uniqlo/i,
];

/** Receipt boilerplate lines that are NOT merchant names */
const BOILERPLATE = [
  /^(receipt|invoice|ticket|bill|statement|transaction)$/i,
  /^(thank you|thanks for shopping|welcome|have a (great|nice|good) day)$/i,
  /^(customer (copy|receipt)|store (copy|receipt))$/i,
  /^(cash register|register|cashier|clerk|operator|server)$/i,
  /^(order|order #|order no|order number)$/i,
  /^(visit us at|follow us|find us|like us)$/i,
  /^(approved|declined|authorized|void)$/i,
  /^(subtotal|sub-total|sub total|total|balance due|amount due|change|cash|credit|debit|tip|tax)$/i,
  /^(save the receipt|keep this receipt|no refunds)$/i,
  /^www\./i,        // websites
  /^[#*=\-_]{3,}/, // divider lines
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
  if (line.length < 3 || line.length > 60) return false;
  // Reject if more than half the chars are digits (prices, phone numbers)
  const digits = (line.match(/\d/g) || []).length;
  if (digits / line.length > 0.4) return false;
  // Reject street addresses
  if (/\d+\s+\w+\s+(st|ave|rd|blvd|dr|ln|way|ct|pl|suite|ste)\b/i.test(line)) return false;
  // Reject phone numbers
  if (/\d{3}[\s\-\.]\d{3,4}/.test(line)) return false;
  // Reject date-like strings
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(line)) return false;
  // Reject single characters/symbols
  const letters = line.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 2) return false;
  // Reject common boilerplate
  if (BOILERPLATE.some((p) => p.test(line.trim()))) return false;
  return true;
}

/** Convert ALL CAPS text to Title Case for readability */
function toTitleCase(str: string): string {
  const lowers = new Set([
    'a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as',
  ]);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i === 0 || !lowers.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(' ');
}

function extractMerchant(lines: string[]): string {
  // Search first 8 lines for merchant; first 3 lines get priority
  const topLines  = lines.slice(0, 3);
  const moreLines = lines.slice(3, 8);

  // 1. Known merchant match in top 3 — best confidence
  for (const line of topLines) {
    for (const pattern of MERCHANT_PATTERNS) {
      if (pattern.test(line)) {
        const cleaned = cleanMerchantLine(line);
        return formatMerchant(cleaned);
      }
    }
  }

  // 2. Known merchant match in lines 4-8
  for (const line of moreLines) {
    for (const pattern of MERCHANT_PATTERNS) {
      if (pattern.test(line)) {
        const cleaned = cleanMerchantLine(line);
        return formatMerchant(cleaned);
      }
    }
  }

  // 3. First all-caps line in top 3 (receipts always print store name in caps at top)
  for (const line of topLines) {
    const cleaned = cleanMerchantLine(line);
    if (!isLikelyMerchant(cleaned)) continue;
    const letters = cleaned.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase()) {
      return formatMerchant(cleaned);
    }
  }

  // 4. First all-caps line in lines 4-8
  for (const line of moreLines) {
    const cleaned = cleanMerchantLine(line);
    if (!isLikelyMerchant(cleaned)) continue;
    const letters = cleaned.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase()) {
      return formatMerchant(cleaned);
    }
  }

  // 5. Fallback: longest valid line in first 8
  let best = '';
  for (const line of [...topLines, ...moreLines]) {
    const cleaned = cleanMerchantLine(line);
    if (isLikelyMerchant(cleaned) && cleaned.length > best.length) {
      best = cleaned;
    }
  }
  if (best) return formatMerchant(best);

  return 'Unknown Merchant';
}

/** Final cleanup: trim, collapse spaces, Title-case if ALL CAPS */
function formatMerchant(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  // If entirely upper-case letters, convert to Title Case
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return toTitleCase(trimmed);
  }
  return trimmed;
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