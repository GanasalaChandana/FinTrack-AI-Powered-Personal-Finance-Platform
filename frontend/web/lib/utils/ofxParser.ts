/**
 * Reads OFX / QFX bank downloads ("Quicken" / "Microsoft Money" format) into the
 * same shape the CSV import uses. Handles both OFX 1.x (SGML, tags often left
 * unclosed) and OFX 2.x (XML).
 */

export interface OfxParsed {
  headers: string[];
  rows: Record<string, string>[];
}

export const OFX_HEADERS = ["Date", "Merchant", "Description", "Amount", "Type"];

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => ENTITIES[m] ?? m);

/** Value of a simple tag in a block: `<TAG>value` (SGML) or `<TAG>value</TAG>` (XML). */
function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? decode(m[1].trim()) : "";
}

/** OFX dates look like 20261105, 20261105120000 or 20261105120000.000[-5:EST]. */
function ofxDate(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function looksLikeOfx(fileName: string, text: string): boolean {
  return /\.(ofx|qfx)$/i.test(fileName) || /<OFX>/i.test(text.slice(0, 4000));
}

export function parseOfx(text: string): OfxParsed {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (blocks.length === 0) {
    throw new Error("No transactions found in this OFX/QFX file.");
  }
  const rows: Record<string, string>[] = [];
  for (const b of blocks) {
    const date = ofxDate(field(b, "DTPOSTED") || field(b, "DTUSER"));
    const amount = field(b, "TRNAMT").replace(",", ".");
    if (!date || !amount || isNaN(Number(amount))) continue;
    // NAME is the payee; some banks nest it in <PAYEE><NAME>, others only fill MEMO
    const name = field(b, "NAME") || field(b, "PAYEEID");
    const memo = field(b, "MEMO");
    const n = Number(amount);
    rows.push({
      Date: date,
      Merchant: name || memo || "Unknown",
      Description: memo && memo !== name ? memo : name || memo,
      Amount: amount,
      // OFX signs amounts from the account's point of view: negative = money out
      Type: n < 0 ? "expense" : "income",
    });
  }
  if (rows.length === 0) throw new Error("No transactions with a date and amount were found in this file.");
  return { headers: OFX_HEADERS, rows };
}
