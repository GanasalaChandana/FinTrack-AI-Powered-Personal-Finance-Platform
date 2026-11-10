/**
 * Real per-category spending by month, from the transactions themselves, and which
 * categories went up or down between the last two complete months (the current month
 * is still in progress, so comparing it would always look like a drop).
 */
export interface TrendTxn { date: string; amount: number; type: string; category?: string | null }

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function categoryTrends(txns: TrendTxn[], months: number, today = new Date(), topN = 5) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map<string, Map<string, number>>(keys.map((k) => [k, new Map()]));
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (String(t.type).toLowerCase() !== "expense") continue;
    const m = byMonth.get(String(t.date).slice(0, 7));
    if (!m) continue;
    const cat = t.category || "Other";
    const amt = Math.abs(Number(t.amount) || 0);
    m.set(cat, (m.get(cat) ?? 0) + amt);
    totals.set(cat, (totals.get(cat) ?? 0) + amt);
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([c]) => c);
  const round = (n: number) => Math.round(n * 100) / 100;
  const rows = keys.map((k) => {
    const row: Record<string, string | number> = { month: SHORT[Number(k.slice(5)) - 1] };
    for (const c of top) row[c] = round(byMonth.get(k)!.get(c) ?? 0);
    return row;
  });

  const increasing: { name: string; pct: string }[] = [];
  const decreasing: { name: string; pct: string }[] = [];
  if (keys.length >= 3) {
    const last = byMonth.get(keys[keys.length - 2])!;
    const prev = byMonth.get(keys[keys.length - 3])!;
    for (const cat of totals.keys()) {
      const a = last.get(cat) ?? 0, b = prev.get(cat) ?? 0;
      if (b === 0 || a === 0) continue; // new or stopped categories aren't a trend
      const change = ((a - b) / b) * 100;
      if (change > 5) increasing.push({ name: cat, pct: `+${change.toFixed(1)}%` });
      else if (change < -5) decreasing.push({ name: cat, pct: `${change.toFixed(1)}%` });
    }
    const num = (s: string) => Math.abs(parseFloat(s));
    increasing.sort((x, y) => num(y.pct) - num(x.pct));
    decreasing.sort((x, y) => num(y.pct) - num(x.pct));
  }
  return { rows, top, increasing, decreasing };
}
