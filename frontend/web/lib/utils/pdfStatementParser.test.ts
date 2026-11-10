import { describe, it, expect } from "vitest";
import { parseStatementText, merchantName } from "./pdfStatementParser";

// Lines as pdf.js rebuilds them from a Chase credit card statement (personal details removed)
const CHASE_CARD = `New Balance  $1,483.15
Minimum Payment Due  $40.00
Previous Balance  $1,350.01
Opening/Closing Date  09/04/26 - 10/03/26
Credit Access Line  $6,000
ACCOUNT ACTIVITY
PAYMENTS AND OTHER CREDITS
09/22  Payment Thank You-Mobile  -44.00
PURCHASE
09/06  STARBUCKS STORE 68636 CHILDRESS TX  5.90
09/07  TARGET T-1032 IRVING TX  27.06
09/07  CHIPOTLE 0330 IRVING TX  11.10
09/07  SQ *ARWA COFFEE LLC Irving TX  9.20
09/11  AMAZON PRIME*1K20O4HP3 Amzn.com/bill WA  16.24
09/19  THE TECH GUYS RICHARDSON TX  59.58
09/21  AMAZON MKTPL*5R0875Q62 Amzn.com/bill WA  27.04
09/25  ANTHROPIC* CLAUDE SUB ANTHROPIC.COM CA  20.00
09/29  SWADESHI PLAZA RESTAUR IRVING TX  1.02
Total fees charged in 2026  $0.00`;

describe("PDF statement reader", () => {
  it("reads a Chase card statement: purchases as expenses, card payment left out", () => {
    const r = parseStatementText(CHASE_CARD);
    expect(r.rows).toHaveLength(9);
    expect(r.skippedPayments).toBe(1);
    expect(r.rows.every((x) => x.Type === "expense")).toBe(true);
    const total = r.rows.reduce((s, x) => s + Number(x.Amount), 0);
    expect(total.toFixed(2)).toBe("-177.14"); // the statement's Purchases total
    expect(r.rows[0]).toMatchObject({ Date: "2026-09-06", Amount: "-5.90" });
    expect(r.rows.map((x) => x.Merchant)).toContain("Target");
  });

  it("uses section headings on a checking statement, and the year before for December", () => {
    const checking = `Statement period 12/15/2026 through 01/14/2027
DEPOSITS AND ADDITIONS
12/31  Payroll Deposit ACME CORP  2,750.00  3,912.40
WITHDRAWALS
12/20  Rent Payment Property Mgmt  1,450.00  1,162.40
01/03  Whole Foods Market 1234 Austin TX  84.12  3,828.28
Ending Balance  3,828.28`;
    const r = parseStatementText(checking);
    expect(r.rows.map((x) => [x.Date, x.Amount, x.Type])).toEqual([
      ["2026-12-31", "2750.00", "income"],
      ["2026-12-20", "-1450.00", "expense"],
      ["2027-01-03", "-84.12", "expense"],
    ]);
  });

  it("explains when a PDF has no readable transactions", () => {
    expect(() => parseStatementText("Scanned page\nThank you for banking with us")).toThrow(/CSV or QFX download/);
  });

  it("tidies merchant names", () => {
    expect(merchantName("SQ *ARWA COFFEE LLC Irving TX")).toBe("Arwa Coffee LLC");
    expect(merchantName("AMAZON MKTPL*5R0875Q62 Amzn.com/bill WA")).toBe("Amazon Mktpl");
    expect(merchantName("SWADESHI PLAZA RESTAUR IRVING TX")).toBe("Swadeshi Plaza Restaur");
  });
});
