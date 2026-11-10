import { describe, expect, it } from "vitest";
import { looksLikeOfx, parseOfx } from "./ofxParser";

// OFX 1.x: SGML header, leaf tags not closed
const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000.000[-5:EST]
<TRNAMT>-42.17
<FITID>2026110501
<NAME>WHOLE FOODS #123
<MEMO>Groceries &amp; more
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261101
<TRNAMT>2500.00
<FITID>2026110102
<NAME>ACME PAYROLL
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

// OFX 2.x: XML
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261103</DTPOSTED><TRNAMT>-9.99</TRNAMT><FITID>a1</FITID><NAME>NETFLIX.COM</NAME></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261104</DTPOSTED><TRNAMT>-3,50</TRNAMT><FITID>a2</FITID><MEMO>COFFEE SHOP</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

describe("parseOfx", () => {
  it("reads OFX 1.x (SGML) bank statements", () => {
    const { headers, rows } = parseOfx(SGML);
    expect(headers).toContain("Amount");
    expect(rows).toEqual([
      { Date: "2026-11-05", Merchant: "WHOLE FOODS #123", Description: "Groceries & more", Amount: "-42.17", Type: "expense" },
      { Date: "2026-11-01", Merchant: "ACME PAYROLL", Description: "ACME PAYROLL", Amount: "2500.00", Type: "income" },
    ]);
  });

  it("reads OFX 2.x (XML) credit card statements, with decimal commas and memo-only payees", () => {
    const { rows } = parseOfx(XML);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Date: "2026-11-03", Merchant: "NETFLIX.COM", Amount: "-9.99", Type: "expense" });
    expect(rows[1]).toMatchObject({ Merchant: "COFFEE SHOP", Amount: "-3.50" });
  });

  it("explains a file without transactions", () => {
    expect(() => parseOfx("<OFX></OFX>")).toThrow(/No transactions/);
  });

  it("recognises OFX/QFX files by name or content", () => {
    expect(looksLikeOfx("statement.QFX", "")).toBe(true);
    expect(looksLikeOfx("download.txt", SGML)).toBe(true);
    expect(looksLikeOfx("export.csv", "Date,Amount\n")).toBe(false);
  });
});
