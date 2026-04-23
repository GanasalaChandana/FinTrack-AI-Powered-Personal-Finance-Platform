"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Edit2, Check, X,
  Wallet, CreditCard, Home, Car, Briefcase, PiggyBank, DollarSign,
  Building, BarChart3, Target, Flag, Sparkles,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = "Cash" | "Savings" | "Investment" | "Property" | "Vehicle" | "Other";
type LiabilityType = "Credit Card" | "Student Loan" | "Car Loan" | "Mortgage" | "Personal Loan" | "Other";

interface Asset {
  id: string;
  name: string;
  value: number;
  type: AssetType;
}

interface Liability {
  id: string;
  name: string;
  value: number;
  type: LiabilityType;
}

interface NetWorthSnapshot {
  date: string;      // YYYY-MM-DD
  netWorth: number;
  assets: number;
  liabilities: number;
}

interface NetWorthData {
  assets: Asset[];
  liabilities: Liability[];
  snapshots: NetWorthSnapshot[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "fintrack-net-worth";

const ASSET_TYPES: AssetType[] = ["Cash", "Savings", "Investment", "Property", "Vehicle", "Other"];
const LIABILITY_TYPES: LiabilityType[] = ["Credit Card", "Student Loan", "Car Loan", "Mortgage", "Personal Loan", "Other"];

const ASSET_ICONS: Record<AssetType, React.ElementType> = {
  Cash: DollarSign, Savings: PiggyBank, Investment: TrendingUp,
  Property: Home, Vehicle: Car, Other: Briefcase,
};
const LIABILITY_ICONS: Record<LiabilityType, React.ElementType> = {
  "Credit Card": CreditCard, "Student Loan": Building, "Car Loan": Car,
  Mortgage: Home, "Personal Loan": Briefcase, Other: Wallet,
};

const ASSET_COLORS: Record<AssetType, string> = {
  Cash: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  Savings: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  Investment: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  Property: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  Vehicle: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  Other: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadData(): NetWorthData {
  if (typeof window === "undefined") return { assets: [], liabilities: [], snapshots: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { assets: [], liabilities: [], snapshots: [] };
}

function saveData(data: NetWorthData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function takeSnapshot(data: NetWorthData): NetWorthData {
  const today = todayStr();
  const totalAssets = data.assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = data.liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Replace today's snapshot or append
  const existing = data.snapshots.findIndex((s) => s.date === today);
  const snapshot: NetWorthSnapshot = { date: today, netWorth, assets: totalAssets, liabilities: totalLiabilities };
  const snapshots = existing >= 0
    ? data.snapshots.map((s, i) => (i === existing ? snapshot : s))
    : [...data.snapshots, snapshot].slice(-24); // keep last 24 months

  return { ...data, snapshots };
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface ItemRowProps {
  id: string;
  name: string;
  value: number;
  type: string;
  Icon: React.ElementType;
  colorClass: string;
  onDelete: (id: string) => void;
  onEdit: (id: string, name: string, value: number, type: string) => void;
}

function ItemRow({ id, name, value, type, Icon, colorClass, onDelete, onEdit }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editValue, setEditValue] = useState(value.toString());

  const commit = () => {
    const v = parseFloat(editValue);
    if (!editName.trim() || isNaN(v) || v < 0) return;
    onEdit(id, editName.trim(), v, type);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="flex-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Name"
        />
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-28 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-5 pr-2 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0"
          />
        </div>
        <button onClick={commit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 group transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{type}</p>
      </div>
      <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{fmt(value)}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => { setEditName(name); setEditValue(value.toString()); setEditing(true); }}
          className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(id)}
          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

interface AddFormProps {
  types: string[];
  label: string;
  accent: string;
  onAdd: (name: string, value: number, type: string) => void;
}

function AddForm({ types, label, accent, onAdd }: AddFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState(types[0]);

  const submit = () => {
    const v = parseFloat(value);
    if (!name.trim() || isNaN(v) || v <= 0) return;
    onAdd(name.trim(), v, type);
    setName(""); setValue(""); setType(types[0]); setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors ${accent}`}
      >
        <Plus className="w-4 h-4" /> Add {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="col-span-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={`${label} name (e.g. Checking Account)`}
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-7 pr-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0.00"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={submit}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">
          Add
        </button>
        <button onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Custom tooltip for chart ─────────────────────────────────────────────────

const NWTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const nw = payload.find((p: any) => p.dataKey === "netWorth");
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-600 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const NW_TARGET_KEY = "fintrack-nw-target";

export default function NetWorthPage() {
  const router = useRouter();
  const [data, setData] = useState<NetWorthData>({ assets: [], liabilities: [], snapshots: [] });
  const [mounted, setMounted] = useState(false);

  // Milestone target
  const [target, setTarget] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("ft_token");
    if (!token) { router.replace("/register?mode=signin"); return; }
    const loaded = loadData();
    const withSnapshot = takeSnapshot(loaded);
    setData(withSnapshot);
    saveData(withSnapshot);

    // Load saved target
    const savedTarget = localStorage.getItem(NW_TARGET_KEY);
    if (savedTarget) {
      const t = parseFloat(savedTarget);
      if (!isNaN(t) && t > 0) { setTarget(t); setTargetInput(String(t)); }
    }

    setMounted(true);
  }, [router]);

  const persist = useCallback((next: NetWorthData) => {
    const withSnapshot = takeSnapshot(next);
    setData(withSnapshot);
    saveData(withSnapshot);
  }, []);

  // ── Asset CRUD ──
  const addAsset = (name: string, value: number, type: string) =>
    persist({ ...data, assets: [...data.assets, { id: uid(), name, value, type: type as AssetType }] });

  const deleteAsset = (id: string) =>
    persist({ ...data, assets: data.assets.filter((a) => a.id !== id) });

  const editAsset = (id: string, name: string, value: number, type: string) =>
    persist({ ...data, assets: data.assets.map((a) => a.id === id ? { ...a, name, value, type: type as AssetType } : a) });

  // ── Liability CRUD ──
  const addLiability = (name: string, value: number, type: string) =>
    persist({ ...data, liabilities: [...data.liabilities, { id: uid(), name, value, type: type as LiabilityType }] });

  const deleteLiability = (id: string) =>
    persist({ ...data, liabilities: data.liabilities.filter((l) => l.id !== id) });

  const editLiability = (id: string, name: string, value: number, type: string) =>
    persist({ ...data, liabilities: data.liabilities.map((l) => l.id === id ? { ...l, name, value, type: type as LiabilityType } : l) });

  // ── Derived ──
  const totalAssets      = useMemo(() => data.assets.reduce((s, a) => s + a.value, 0), [data.assets]);
  const totalLiabilities = useMemo(() => data.liabilities.reduce((s, l) => s + l.value, 0), [data.liabilities]);
  const netWorth         = totalAssets - totalLiabilities;
  const debtRatio        = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Trend: compare last two snapshots
  const snapshots = data.snapshots;
  const prevSnap  = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const nwChange  = prevSnap ? netWorth - prevSnap.netWorth : null;
  const nwChangePct = prevSnap && prevSnap.netWorth !== 0
    ? ((netWorth - prevSnap.netWorth) / Math.abs(prevSnap.netWorth)) * 100
    : null;

  // Chart data + 6-month projection + milestone
  const fullChartData = useMemo(() => {
    const base: {
      label: string;
      netWorth?: number;
      assets?: number;
      liabilities?: number;
      projected?: number;
    }[] = snapshots.map((s) => ({
      label: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      netWorth: s.netWorth,
      assets: s.assets,
      liabilities: s.liabilities,
    }));

    if (snapshots.length >= 2) {
      const first = snapshots[0];
      const last  = snapshots[snapshots.length - 1];
      const avgMonthlyChange = (last.netWorth - first.netWorth) / Math.max(1, snapshots.length - 1);
      // Only project if there's a positive trend (or user has a target to work toward)
      if (avgMonthlyChange !== 0 || target !== null) {
        const rate = avgMonthlyChange !== 0 ? avgMonthlyChange : 0;
        for (let i = 1; i <= 6; i++) {
          const d = new Date(last.date + "T00:00:00");
          d.setMonth(d.getMonth() + i);
          base.push({
            label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            projected: Math.round(last.netWorth + rate * i),
          });
        }
      }
    }
    return base;
  }, [snapshots, target]);

  // Milestone progress
  const milestone = useMemo(() => {
    if (!target) return null;
    const gap = target - netWorth;
    const achieved = netWorth >= target;
    const progress = target !== 0 ? Math.min(100, Math.max(0, (netWorth / target) * 100)) : 0;

    let monthsToGoal: number | null = null;
    if (!achieved && snapshots.length >= 2) {
      const first = snapshots[0];
      const last  = snapshots[snapshots.length - 1];
      const avgMonthlyChange = (last.netWorth - first.netWorth) / Math.max(1, snapshots.length - 1);
      if (avgMonthlyChange > 0) monthsToGoal = Math.ceil(gap / avgMonthlyChange);
    }
    return { gap, achieved, progress, monthsToGoal };
  }, [target, netWorth, snapshots]);

  // Legacy alias (used below for length guard)
  const chartData = fullChartData;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wallet className="w-8 h-8 text-indigo-600" />
            Net Worth Tracker
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track your assets, liabilities, and overall financial health</p>
        </div>

        {/* ── Big net worth number + stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Net Worth hero */}
          <div className={`md:col-span-1 rounded-2xl p-6 text-white shadow-lg ${
            netWorth >= 0
              ? "bg-gradient-to-br from-indigo-600 to-purple-600"
              : "bg-gradient-to-br from-red-600 to-rose-600"
          }`}>
            <p className="text-sm font-medium opacity-80 mb-1">Net Worth</p>
            <p className="text-4xl font-bold mb-2">{fmt(netWorth)}</p>
            {nwChange !== null && (
              <div className="flex items-center gap-1.5 text-sm opacity-90">
                {nwChange >= 0
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />}
                <span>{nwChange >= 0 ? "+" : ""}{fmt(nwChange)}</span>
                {nwChangePct !== null && (
                  <span>({nwChangePct > 0 ? "+" : ""}{nwChangePct.toFixed(1)}%)</span>
                )}
                <span className="opacity-70">since last update</span>
              </div>
            )}
          </div>

          {/* Total Assets */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assets</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAssets)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{data.assets.length} asset{data.assets.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Total Liabilities */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{fmt(totalLiabilities)}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">{data.liabilities.length} liabilit{data.liabilities.length !== 1 ? "ies" : "y"}</p>
              {totalAssets > 0 && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Debt ratio: {debtRatio.toFixed(0)}%
                </p>
              )}
            </div>
            {totalAssets > 0 && (
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${debtRatio > 70 ? "bg-red-500" : debtRatio > 40 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(debtRatio, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Net Worth Trend Chart ── */}
        {chartData.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Net Worth Over Time</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Solid lines = actual · Dashed = 6-month projection</p>
              </div>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={fullChartData} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<NWTooltip />} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 4" />
                {/* Target milestone line */}
                {target !== null && (
                  <ReferenceLine
                    y={target}
                    stroke="#f97316"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={{ value: `🎯 ${fmt(target)}`, position: "insideTopRight", fontSize: 11, fill: "#f97316", fontWeight: 700 }}
                  />
                )}
                <Line type="monotone" dataKey="assets" stroke="#10b981" strokeWidth={2}
                  name="Assets" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                <Line type="monotone" dataKey="liabilities" stroke="#ef4444" strokeWidth={2}
                  name="Liabilities" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={3}
                  name="Net Worth" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} connectNulls={false} />
                <Line type="monotone" dataKey="projected" stroke="#6366f1" strokeWidth={2}
                  strokeDasharray="6 4" name="Projected" dot={false} activeDot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs text-gray-500 dark:text-gray-400">
              {[
                { color: "#10b981", label: "Assets" },
                { color: "#ef4444", label: "Liabilities" },
                { color: "#6366f1", label: "Net Worth" },
                { color: "#6366f1", label: "Projected", dashed: true },
                ...(target !== null ? [{ color: "#f97316", label: "Milestone target", dashed: true }] : []),
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className={`inline-block h-0.5 w-5 ${item.dashed ? "border-t-2 border-dashed" : ""}`}
                    style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Milestone Target Card ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Flag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Net Worth Milestone</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Set a target to track your progress</p>
              </div>
            </div>
            {target !== null && !editingTarget && (
              <button
                onClick={() => { setTargetInput(String(target)); setEditingTarget(true); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {/* Target input form */}
          {(target === null || editingTarget) && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = parseFloat(targetInput);
                      if (!isNaN(v) && v > 0) {
                        setTarget(v);
                        localStorage.setItem(NW_TARGET_KEY, String(v));
                        setEditingTarget(false);
                      }
                    }
                  }}
                  placeholder="e.g. 100000"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => {
                  const v = parseFloat(targetInput);
                  if (!isNaN(v) && v > 0) {
                    setTarget(v);
                    localStorage.setItem(NW_TARGET_KEY, String(v));
                    setEditingTarget(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Set
              </button>
              {target !== null && editingTarget && (
                <button
                  onClick={() => {
                    setTarget(null);
                    localStorage.removeItem(NW_TARGET_KEY);
                    setTargetInput("");
                    setEditingTarget(false);
                  }}
                  className="px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Milestone progress */}
          {milestone && !editingTarget && (
            <div className="space-y-3">
              {milestone.achieved ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-3">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    🎉 Milestone achieved! You've reached your target of {fmt(target!)}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {fmt(netWorth)} <span className="text-gray-400">of</span> {fmt(target!)}
                    </span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {milestone.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all"
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{fmt(milestone.gap)} remaining</span>
                    {milestone.monthsToGoal !== null && (
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        ~{milestone.monthsToGoal} month{milestone.monthsToGoal !== 1 ? "s" : ""} at current pace
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Assets + Liabilities columns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Assets */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Assets</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">What you own</p>
              </div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAssets)}</span>
            </div>

            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {data.assets.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No assets added yet</p>
              ) : (
                data.assets.map((a) => {
                  const Icon = ASSET_ICONS[a.type];
                  return (
                    <ItemRow key={a.id} {...a} Icon={Icon} colorClass={ASSET_COLORS[a.type]}
                      onDelete={deleteAsset} onEdit={editAsset} />
                  );
                })
              )}
            </div>

            <AddForm
              types={ASSET_TYPES} label="Asset"
              accent="border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              onAdd={addAsset}
            />
          </div>

          {/* Liabilities */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Liabilities</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">What you owe</p>
              </div>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(totalLiabilities)}</span>
            </div>

            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {data.liabilities.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No liabilities added yet</p>
              ) : (
                data.liabilities.map((l) => {
                  const Icon = LIABILITY_ICONS[l.type];
                  return (
                    <ItemRow key={l.id} {...l} Icon={Icon}
                      colorClass="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      onDelete={deleteLiability} onEdit={editLiability} />
                  );
                })
              )}
            </div>

            <AddForm
              types={LIABILITY_TYPES} label="Liability"
              accent="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onAdd={addLiability}
            />
          </div>
        </div>

        {/* ── Tip ── */}
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-6">
          💡 Your data is saved locally in your browser. Update balances regularly to keep your trend accurate.
        </p>

      </div>
    </div>
  );
}
