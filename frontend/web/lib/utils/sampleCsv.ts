/**
 * A sample bank export for trying the CSV import: about two months of typical
 * transactions dated relative to today, so they appear on the dashboard right away.
 */
const ROWS: [number, string, string, number, string][] = [
  // [days ago, merchant, description, amount, category]
  [1, "Starbucks", "Morning coffee", -6.45, "Food & Dining"],
  [2, "Whole Foods", "Groceries", -84.12, "Food & Dining"],
  [3, "Shell", "Gas", -48.3, "Transportation"],
  [5, "Netflix", "Streaming subscription", -15.49, "Entertainment"],
  [6, "Chipotle", "Lunch", -12.85, "Food & Dining"],
  [8, "Amazon", "Household supplies", -36.97, "Shopping"],
  [10, "Comcast", "Internet bill", -80, "Bills & Utilities"],
  [12, "Employer Inc", "Paycheck", 2750, "Salary"],
  [13, "Uber", "Ride home", -18.6, "Transportation"],
  [15, "Property Mgmt", "Rent", -1450, "Housing"],
  [17, "Trader Joe's", "Groceries", -62.4, "Food & Dining"],
  [20, "CVS Pharmacy", "Pharmacy", -21.18, "Health & Fitness"],
  [22, "Spotify", "Music subscription", -11.99, "Entertainment"],
  [26, "Employer Inc", "Paycheck", 2750, "Salary"],
  [28, "Target", "Clothing", -54.99, "Shopping"],
  [31, "Whole Foods", "Groceries", -91.75, "Food & Dining"],
  [34, "Shell", "Gas", -45.1, "Transportation"],
  [36, "Netflix", "Streaming subscription", -15.49, "Entertainment"],
  [40, "Comcast", "Internet bill", -80, "Bills & Utilities"],
  [41, "Employer Inc", "Paycheck", 2750, "Salary"],
  [45, "Property Mgmt", "Rent", -1450, "Housing"],
  [48, "Olive Garden", "Dinner out", -58.2, "Food & Dining"],
  [52, "Planet Fitness", "Gym membership", -24.99, "Health & Fitness"],
  [55, "Employer Inc", "Paycheck", 2750, "Salary"],
];

export function sampleCsv(today = new Date()): string {
  const lines = ["Date,Merchant,Description,Amount,Type,Category"];
  for (const [ago, merchant, desc, amount, category] of ROWS) {
    const d = new Date(today);
    d.setDate(d.getDate() - ago);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    lines.push([date, merchant, desc, amount.toFixed(2), amount > 0 ? "income" : "expense", category].join(","));
  }
  return lines.join("\n") + "\n";
}

export function downloadSampleCsv(): void {
  const blob = new Blob([sampleCsv()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fintrack-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}
