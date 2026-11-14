"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { LineChart, Plus, Pencil, Trash2, X, Loader2, RefreshCw, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";
import { userCurrency, dateLocale } from "@/lib/userPrefs";
import { PageHeader, PageContent } from "@/components/layouts/PageHeader";

type AssetType = "STOCK" | "ETF" | "FUND" | "CRYPTO" | "BOND" | "CASH" | "OTHER";

interface Holding {
  id: string;
  symbol: string | null;
  name: string;
  assetType: AssetType;
  quantity: number;
  costBasis: number | null;
  price: number | null;
  value: number;
  gain: number | null;
  gainPct: number | null;
  source: "MANUAL" | "PLAID";
  accountName: string | null;
  priceUpdatedAt: string | null;
}

interface Portfolio {
  holdings: Holding[];
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number | null;
}

const TYPES: { id: AssetType; label: string; color: string }[] = [
  { id: "STOCK", label: "Stocks", color: "#6366f1" },
  { id: "ETF", label: "ETFs", color: "#22c55e" },
  { id: "FUND", label: "Mutual funds", color: "#f59e0b" },
  { id: "CRYPTO", label: "Crypto", color: "#ec4899" },
  { id: "BOND", label: "Bonds", color: "#0ea5e9" },
  { id: "CASH", label: "Cash", color: "#94a3b8" },
  { id: "OTHER", label: "Other", color: "#a855f7" },
];
const typeInfo = (t: AssetType) => TYPES.find((x) => x.id === t) ?? TYPES[TYPES.length - 1];

const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat(dateLocale(), { style: "currency", currency: userCurrency() }).format(v);
const qty = (v: number) => new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 6 }).format(v);

interface FormState { id?: string; symbol: string; name: string; assetType: AssetType; quantity: string; costBasis: string; price: string; accountName: string }
const EMPTY_FORM: FormState = { symbol: "", name: "", assetType: "STOCK", quantity: "", costBasis: "", price: "", accountName: "" };

export default function InvestmentsPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await apiRequest<Portfolio>("/api/investments");
      setData({ ...p, holdings: Array.isArray(p?.holdings) ? p.holdings : [] });
    } catch (e) {
      setError(errorMessage(e) ?? "Couldn't load your investments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const allocation = useMemo(() => {
    const by = new Map<AssetType, number>();
    for (const h of data?.holdings ?? []) by.set(h.assetType, (by.get(h.assetType) ?? 0) + (Number(h.value) || 0));
    return [...by.entries()].filter(([, v]) => v > 0).map(([t, v]) => ({ name: typeInfo(t).label, value: v, color: typeInfo(t).color }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const remove = async (h: Holding) => {
    if (!confirm(`Remove ${h.name}?`)) return;
    try {
      await apiRequest(`/api/investments/${h.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(errorMessage(e) ?? "Couldn't remove it.");
    }
  };

  const holdings = data?.holdings ?? [];
  const gain = Number(data?.totalGain) || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <PageContent className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <PageHeader
          title="Investments"
          description="Stocks, funds and crypto, valued at today's prices."
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => { setLoading(true); void load(); }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50">
                <RefreshCw className="w-4 h-4" /> Refresh prices
              </button>
              <button onClick={() => setForm(EMPTY_FORM)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Add holding
              </button>
            </div>
          }
        />

        {error && <p className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

        {loading && !data ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : holdings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-10 text-center">
            <LineChart className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">No investments yet</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5 max-w-md mx-auto">
              Add a holding by its symbol (like AAPL, VTI or BTC) and FinTrack keeps it at today&apos;s price,
              or connect a brokerage to bring your holdings in automatically.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => setForm(EMPTY_FORM)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Add holding
              </button>
              <Link href="/settings?tab=banks" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Landmark className="w-4 h-4" /> Connect a brokerage
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total value</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 mt-1">{money(data?.totalValue)}</p>
                <p className="text-xs text-gray-400 mt-1">{holdings.length} holding{holdings.length === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Gain / loss</p>
                <p className={`text-3xl font-extrabold mt-1 flex items-center gap-2 ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {gain >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  {gain >= 0 ? "+" : ""}{money(gain)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {data?.totalGainPct != null ? `${gain >= 0 ? "+" : ""}${data.totalGainPct}% on ${money(data.totalCost)} paid` : "Add what you paid to see gains"}
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
                <div className="h-24 w-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={26} outerRadius={44} paddingAngle={2}>
                        {allocation.map((a) => <Cell key={a.name} fill={a.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => money(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="text-xs space-y-1 min-w-0">
                  {allocation.map((a) => (
                    <li key={a.name} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                      <span className="truncate">{a.name}</span>
                      <span className="text-gray-400">{Math.round((a.value / (Number(data?.totalValue) || 1)) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Holdings */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {holdings.map((h) => (
                <div key={h.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 sm:px-5 py-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                       style={{ background: typeInfo(h.assetType).color }}>
                    {(h.symbol ?? h.name).slice(0, 4)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{h.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {h.symbol ? `${h.symbol} · ` : ""}{qty(Number(h.quantity))} × {money(h.price)}
                      {h.accountName ? ` · ${h.accountName}` : ""}
                      {h.source === "PLAID" && <span className="ml-2 rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">Imported</span>}
                    </p>
                  </div>
                  <div className="text-right ml-auto">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{money(h.value)}</p>
                    {h.gain != null && (
                      <p className={`text-xs font-semibold ${Number(h.gain) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {Number(h.gain) >= 0 ? "+" : ""}{money(h.gain)}{h.gainPct != null ? ` (${h.gainPct}%)` : ""}
                      </p>
                    )}
                  </div>
                  {h.source === "MANUAL" ? (
                    <div className="flex gap-1">
                      <button aria-label={`Edit ${h.name}`} onClick={() => setForm({
                        id: h.id, symbol: h.symbol ?? "", name: h.name, assetType: h.assetType, quantity: String(h.quantity),
                        costBasis: h.costBasis != null ? String(h.costBasis) : "", price: h.symbol ? "" : String(h.price ?? ""), accountName: h.accountName ?? "",
                      })} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700"><Pencil className="w-4 h-4" /></button>
                      <button aria-label={`Remove ${h.name}`} onClick={() => remove(h)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ) : <div className="w-[72px]" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-gray-400">
              Prices for holdings you add are market quotes, refreshed every 15 minutes (may be delayed). Imported holdings use your brokerage&apos;s prices and update when the bank syncs.
              Your total counts towards <Link href="/net-worth" className="text-indigo-500 hover:underline">net worth</Link>.
            </p>
          </>
        )}
      </PageContent>

      {form && <HoldingForm initial={form} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await load(); }} />}
    </div>
  );
}

function HoldingForm({ initial, onClose, onSaved }: { initial: FormState; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<FormState>(initial);
  const [quote, setQuote] = useState<{ price: number; name: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Look the symbol up as it's typed, to show the name and today's price
  useEffect(() => {
    const s = f.symbol.trim();
    if (!s || f.assetType === "CASH" || f.assetType === "OTHER") { setQuote(null); return; }
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const q = await apiRequest<{ price: number; name: string }>(`/api/investments/quote?symbol=${encodeURIComponent(s)}&type=${f.assetType}`);
        setQuote(q && q.price != null ? q : null);
      } catch {
        setQuote(null);
      } finally {
        setLooking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [f.symbol, f.assetType]);

  const value = quote && Number(f.quantity) > 0 ? quote.price * Number(f.quantity) : null;

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const body = JSON.stringify({
        symbol: f.symbol.trim() || null,
        name: f.name.trim() || null,
        assetType: f.assetType,
        quantity: Number(f.quantity),
        costBasis: f.costBasis.trim() ? Number(f.costBasis) : null,
        price: f.price.trim() ? Number(f.price) : null,
        accountName: f.accountName.trim() || null,
      });
      await apiRequest(f.id ? `/api/investments/${f.id}` : "/api/investments", { method: f.id ? "PUT" : "POST", body });
      onSaved();
    } catch (e) {
      setErr(errorMessage(e) ?? "Couldn't save it.");
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100";
  const label = "block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{f.id ? "Edit holding" : "Add holding"}</h2>
          <button aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="h-type">Type</label>
              <select id="h-type" className={input} value={f.assetType} onChange={(e) => set("assetType", e.target.value)}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="h-symbol">Symbol</label>
              <input id="h-symbol" className={input} placeholder={f.assetType === "CRYPTO" ? "BTC" : "AAPL"} value={f.symbol}
                     onChange={(e) => set("symbol", e.target.value.toUpperCase())} autoCapitalize="characters" />
            </div>
          </div>
          <p className="text-xs min-h-[1rem] text-gray-500 dark:text-gray-400">
            {looking ? "Looking up price…" : quote ? <>{quote.name}: <strong>{money(quote.price)}</strong> today</> :
              f.symbol.trim() ? "No market price found. Check the symbol, or leave it empty and enter a name and price." : "Leave the symbol empty for things without a market price."}
          </p>
          {(!f.symbol.trim() || !quote) && (
            <div>
              <label className={label} htmlFor="h-name">Name</label>
              <input id="h-name" className={input} placeholder="e.g. Company stock plan" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="h-qty">Quantity</label>
              <input id="h-qty" className={input} inputMode="decimal" placeholder="10" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="h-cost">Total paid (optional)</label>
              <input id="h-cost" className={input} inputMode="decimal" placeholder="1500" value={f.costBasis} onChange={(e) => set("costBasis", e.target.value)} />
            </div>
          </div>
          {!quote && (
            <div>
              <label className={label} htmlFor="h-price">Current price per unit</label>
              <input id="h-price" className={input} inputMode="decimal" placeholder="Only if there's no market price" value={f.price} onChange={(e) => set("price", e.target.value)} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="h-acct">Account (optional)</label>
            <input id="h-acct" className={input} placeholder="e.g. Robinhood, 401(k)" value={f.accountName} onChange={(e) => set("accountName", e.target.value)} />
          </div>
          {value != null && <p className="text-sm text-gray-600 dark:text-gray-300">Worth <strong>{money(value)}</strong> today.</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button>
          <button onClick={save} disabled={saving || !f.quantity.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {f.id ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
