/**
 * Where to find a statement or transaction download at common US banks, for the import
 * window. Menus change from time to time, so the steps name what to look for rather than
 * exact pixels; the link goes to the bank's site to sign in.
 */
export interface BankGuide { id: string; name: string; url: string; pdf: string[]; csv: string[] }

export const BANK_GUIDES: BankGuide[] = [
  { id: "chase", name: "Chase", url: "https://www.chase.com",
    pdf: ["Sign in at chase.com and open the account", "Choose Statements & documents", "Download the latest statement (PDF)"],
    csv: ["Sign in and open the account", "Click the download icon (Download account activity)", "Pick CSV or Quicken (QFX) and the dates, then Download"] },
  { id: "bofa", name: "Bank of America", url: "https://www.bankofamerica.com",
    pdf: ["Sign in and open the account", "Choose Statements & Documents", "Open the latest statement and download the PDF"],
    csv: ["Sign in and open the account", "Click Download (above the transactions)", "Pick Microsoft Excel (CSV) or Quicken, choose the dates, Download"] },
  { id: "wells", name: "Wells Fargo", url: "https://www.wellsfargo.com",
    pdf: ["Sign in and go to Statements & Documents", "Pick the account and month", "Download the statement (PDF)"],
    csv: ["Sign in and open Account Activity", "Choose Download Account Activity", "Pick Comma Delimited (CSV) or Quicken, then Download"] },
  { id: "capone", name: "Capital One", url: "https://www.capitalone.com",
    pdf: ["Sign in and open the card or account", "Choose View Statements", "Download the latest statement (PDF)"],
    csv: ["Sign in and open the account", "Choose Download Transactions", "Pick CSV, choose the dates, Download"] },
  { id: "citi", name: "Citi", url: "https://www.citi.com",
    pdf: ["Sign in and open Statements", "Pick the account and month", "Download the PDF"],
    csv: ["Sign in and open the account activity", "Click Download (or Export)", "Pick CSV and the dates, then Download"] },
  { id: "amex", name: "American Express", url: "https://www.americanexpress.com",
    pdf: ["Sign in and open Statements & Activity", "Go to the Statements tab", "Download the latest statement (PDF)"],
    csv: ["Sign in and open Statements & Activity", "Click Download (download icon)", "Pick CSV, choose the dates, Download"] },
  { id: "discover", name: "Discover", url: "https://www.discover.com",
    pdf: ["Sign in and open Statements", "Pick the month", "Download the PDF"],
    csv: ["Sign in and open Activity & Statements", "Choose Download", "Pick CSV and the period, then Download"] },
  { id: "usbank", name: "U.S. Bank", url: "https://www.usbank.com",
    pdf: ["Sign in and open the account", "Choose Statements", "Download the latest statement (PDF)"],
    csv: ["Sign in and open the account", "Choose Download transactions", "Pick CSV (or QFX) and the dates, then Download"] },
  { id: "other", name: "Another bank", url: "",
    pdf: ["Sign in to your bank's website (not the app)", "Look for Statements or Documents", "Download your latest monthly statement (PDF)"],
    csv: ["Sign in to your bank's website and open the account", "Look for Download, Export or Download transactions near the list", "Pick CSV, QFX or OFX and the dates, then Download"] },
];
