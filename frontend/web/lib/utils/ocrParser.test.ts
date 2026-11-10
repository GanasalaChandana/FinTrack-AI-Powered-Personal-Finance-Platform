import { describe, it, expect } from "vitest";
import { parseReceiptText } from "./ocrParser";

const receipt = `TARGET
1032 Irving TX
10/12/2026 14:31
GRAPHIC TEE        12.00
SNACK MIX           4.99
SUBTOTAL           16.99
TAX 8.25%           1.40
TOTAL              18.39
VISA TEND          18.39
CHANGE              0.00`;

describe("parseReceiptText", () => {
  it("reads the merchant, date and total, not the subtotal", () => {
    const r = parseReceiptText(receipt);
    expect(r.merchant.toLowerCase()).toContain("target");
    expect(r.date).toBe("2026-10-12");
    expect(r.total).toBe(18.39);
    expect(r.items.map((i) => i.name)).toEqual(["GRAPHIC TEE", "SNACK MIX"]);
  });

  it("handles thousands separators and 'amount due'", () => {
    expect(parseReceiptText("BEST BUY\nTV 1,199.99\nAMOUNT DUE $1,298.99").total).toBe(1298.99);
  });
});
