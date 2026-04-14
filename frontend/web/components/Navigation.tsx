// components/Navigation.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell, Mail, LogOut, Menu, X, Check, AlertTriangle,
  Camera, Brain, RefreshCw, Activity, Sun, Moon, Monitor,
  BarChart3, Wallet, Search, Calendar, CreditCard, TrendingUp,
  LayoutDashboard, ArrowLeftRight, Target, ChevronLeft, ChevronRight,
  PiggyBank, DollarSign,
} from "lucide-react";
import { getToken, removeToken } from "@/lib/api";
import { useThemePreference } from "@/lib/hooks/useThemePreference";
import { CommandPalette } from "@/components/CommandPalette";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface Alert {
  id: string; userId: string; type: string; title: string;
  message: string; priority: string; isRead: boolean; createdAt: string;
}
interface Notification {
  id: string; userId: string; title: string; message: string;
  type: string; read: boolean; createdAt: string;
}

// ── Nav sections ─────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard },
  { href: "/transactions",  label: "Transactions",   icon: ArrowLeftRight },
  { href: "/goals-budgets", label: "Goals & Budgets",icon: Target, badgeKey: "budget" },
  { href: "/reports",       label: "Reports",        icon: BarChart3 },
  { href: "/calendar",      label: "Calendar",       icon: Calendar },
];

const NAV_TOOLS = [
  { href: "/income",        label: "Income",         icon: DollarSign },
  { href: "/debt",          label: "Debt Payoff",    icon: CreditCard },
  { href: "/analytics",     label: "Analytics",      icon: BarChart3 },
  { href: "/net-worth",     label: "Net Worth",      icon: Wallet },
  { href: "/recurring",     label: "Recurring",      icon: RefreshCw },
  { href: "/health",        label: "Health Score",   icon: Activity },
  { href: "/insights",      label: "AI Insights",    icon: Brain },
  { href: "/receipts",      label: "Receipts",       icon: Camera },
];

// ── Reusable nav link ─────────────────────────────────────────────────────────

function NavItem({
  href, label, icon: Icon, badge, collapsed, active, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  badge?: number; collapsed: boolean; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`
        relative flex items-center gap-3 rounded-lg text-[13px] font-medium
        transition-all duration-150 select-none
        ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5'}
        ${active
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}
      `}
    >
      {/* active bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
      )}

      <Icon className={`flex-shrink-0 ${collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4'} ${active ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`} />

      {!collapsed && <span className="flex-1 truncate">{label}</span>}

      {/* badge */}
      {!collapsed && !!badge && badge > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-orange-500 rounded-full px-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {collapsed && !!badge && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] bg-orange-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
      )}
    </Link>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 mx-auto w-5 border-t border-gray-200 dark:border-gray-700/60" />;
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 select-none">
      {label}
    </p>
  );
}

// ── Dropdown popup (alerts / notifications) ───────────────────────────────────

function Popup({ children, width = 360 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden z-[60]"
      style={{ width }}
    >
      {children}
    </div>
  );
}

// ── Bottom action button ──────────────────────────────────────────────────────

function BottomBtn({
  icon: Icon, label, badge, badgeColor = 'bg-red-500', collapsed, onClick, danger, title, sublabel,
}: {
  icon: React.ElementType; label: string; badge?: number; badgeColor?: string;
  collapsed: boolean; onClick: () => void; danger?: boolean; title?: string; sublabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? (title ?? label) : title}
      className={`
        relative flex items-center gap-3 rounded-lg text-[13px] font-medium w-full
        transition-all duration-150
        ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5'}
        ${danger
          ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}
      `}
    >
      <Icon className={`flex-shrink-0 ${collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4'}`} />
      {!collapsed && (
        <span className="flex-1 text-left leading-none">
          {label}
          {sublabel && <span className="block text-[10px] text-gray-400 dark:text-gray-600 font-normal mt-0.5 capitalize">{sublabel}</span>}
        </span>
      )}
      {!collapsed && !!badge && badge > 0 && (
        <span className={`flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white ${badgeColor} rounded-full px-1`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {collapsed && !!badge && badge > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 w-[7px] h-[7px] ${badgeColor} rounded-full ring-2 ring-white dark:ring-gray-900`} />
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Navigation() {
  const [mounted,      setMounted]      = useState(false);
  const [hasToken,     setHasToken]     = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(0);
  const [isPaletteOpen,setIsPaletteOpen]= useState(false);

  const [isAlertsOpen,         setIsAlertsOpen]         = useState(false);
  const [alerts,               setAlerts]               = useState<Alert[]>([]);
  const [alertsUnread,         setAlertsUnread]         = useState(0);
  const alertsRef = useRef<HTMLDivElement>(null);

  const [isNotifsOpen,         setIsNotifsOpen]         = useState(false);
  const [notifs,               setNotifs]               = useState<Notification[]>([]);
  const [notifsUnread,         setNotifsUnread]         = useState(0);
  const notifsRef = useRef<HTMLDivElement>(null);

  const pollFailures = useRef(0);

  const { theme, setTheme } = useThemePreference();
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  const router   = useRouter();
  const pathname = usePathname() || '';

  const isPublic = (p: string) => {
    const pub = ['/', '/login', '/register', '/signin', '/signup'];
    return pub.includes(p) || pub.some(pp => p.startsWith(`${pp}/`) || p.startsWith(`${pp}?`));
  };

  // ── mount + listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    const token = getToken();
    setHasToken(!!token);

    const readBudget = () => {
      const n = parseInt(localStorage.getItem('fintrack-budget-alerts') || '0', 10);
      setBudgetAlerts(isNaN(n) ? 0 : n);
    };
    readBudget();
    window.addEventListener('fintrack-budget-alerts-updated', readBudget);
    window.addEventListener('storage', readBudget);

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (getToken()) setIsPaletteOpen(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);

    if (token && !isPublic(pathname)) {
      loadAlerts(); loadNotifs();
      const iv = setInterval(() => {
        if (!isPublic(window.location.pathname) && getToken() && pollFailures.current < 4) {
          loadAlerts(); loadNotifs();
        }
      }, 120_000);
      return () => {
        clearInterval(iv);
        window.removeEventListener('fintrack-budget-alerts-updated', readBudget);
        window.removeEventListener('storage', readBudget);
        window.removeEventListener('keydown', onKey);
      };
    }
    return () => {
      window.removeEventListener('fintrack-budget-alerts-updated', readBudget);
      window.removeEventListener('storage', readBudget);
      window.removeEventListener('keydown', onKey);
    };
  }, [pathname]);

  // close dropdowns on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setIsAlertsOpen(false);
      if (notifsRef.current  && !notifsRef.current.contains(e.target as Node))  setIsNotifsOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // close mobile drawer on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  // sync sidebar width as CSS var so ClientLayout padding tracks it
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '4rem' : '15rem');
  }, [collapsed]);

  // ── data ─────────────────────────────────────────────────────────────────
  const loadAlerts = async () => {
    try {
      if (isPublic(window.location.pathname)) return;
      const token = getToken(); if (!token) return;
      const userId = localStorage.getItem('userId');
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest', ...(userId && { 'X-User-Id': userId }) },
        credentials: 'omit',
      });
      if (res.ok) {
        pollFailures.current = 0;
        const d = await res.json();
        setAlerts(d.slice(0, 5));
        setAlertsUnread(d.filter((a: Alert) => !a.isRead).length);
      } else if (res.status === 401) { removeToken(); setHasToken(false); }
      else pollFailures.current++;
    } catch { pollFailures.current++; }
  };

  const loadNotifs = async () => {
    try {
      if (isPublic(window.location.pathname)) return;
      const token = getToken(); if (!token) return;
      const u = JSON.parse(localStorage.getItem('user') || '{}'); if (!u.id) return;
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${u.id}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (res.ok) {
        pollFailures.current = 0;
        const d = await res.json();
        setNotifs(d.slice(0, 5));
        setNotifsUnread(d.filter((n: Notification) => !n.read).length);
      } else if (res.status === 401) { removeToken(); setHasToken(false); }
      else pollFailures.current++;
    } catch { pollFailures.current++; }
  };

  const markAlertRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/alerts/${id}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) { setAlerts(a => a.map(x => x.id === id ? { ...x, isRead: true } : x)); setAlertsUnread(n => Math.max(0, n - 1)); }
  };

  const dismissAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/alerts/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) {
      const d = alerts.find(a => a.id === id);
      setAlerts(a => a.filter(x => x.id !== id));
      if (d && !d.isRead) setAlertsUnread(n => Math.max(0, n - 1));
    }
  };

  const markNotifRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const u = JSON.parse(localStorage.getItem('user') || '{}'); if (!u.id) return;
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read?userId=${u.id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) { setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x)); setNotifsUnread(n => Math.max(0, n - 1)); }
  };

  const dismissNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const u = JSON.parse(localStorage.getItem('user') || '{}'); if (!u.id) return;
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}?userId=${u.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) {
      const d = notifs.find(n => n.id === id);
      setNotifs(n => n.filter(x => x.id !== id));
      if (d && !d.read) setNotifsUnread(n => Math.max(0, n - 1));
    }
  };

  const logout = () => {
    removeToken(); setHasToken(false); setAlerts([]); setNotifs([]);
    setAlertsUnread(0); setNotifsUnread(0);
    router.push('/login?mode=signin');
  };

  const alertPriColor = (p: string) =>
    p === 'urgent' ? 'text-red-500' : p === 'high' ? 'text-orange-500' : p === 'medium' ? 'text-yellow-500' : 'text-blue-500';
  const alertEmoji   = (t: string) => ({ expense_limit: '💸', budget_limit: '💰', achievement: '🎉', unusual_activity: '🔍' }[t] ?? '🚨');
  const notifEmoji   = (t: string) => ({ welcome: '👋', alert: '⚠️', info: 'ℹ️', success: '✅', warning: '⚠️' }[t?.toLowerCase()] ?? '📬');
  const timeAgo      = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ── early returns ─────────────────────────────────────────────────────────
  if (!mounted) return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 items-center justify-center">
      <span className="text-base font-bold text-indigo-600">FinTrack</span>
    </aside>
  );
  if (isPublic(pathname) || !hasToken) return null;

  const active = (href: string) => pathname === href;

  // ── sidebar body ─────────────────────────────────────────────────────────
  const Sidebar = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Logo row ── */}
      <div className={`flex items-center h-[60px] px-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 ${collapsed && !onClose ? 'justify-center' : 'gap-2.5'}`}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)' }}
        >
          <PiggyBank className="w-3.5 h-3.5 text-white" />
        </div>

        {(!collapsed || onClose) && (
          <Link
            href="/dashboard"
            onClick={onClose}
            className="text-base font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent"
          >
            FinTrack
          </Link>
        )}

        {/* collapse toggle (desktop only) */}
        {!onClose && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors ${collapsed ? 'mx-auto' : 'ml-auto'}`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* close btn (mobile overlay) */}
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div className={`px-3 pt-3 pb-1 ${collapsed && !onClose ? 'flex justify-center' : ''}`}>
        <button
          onClick={() => { setIsPaletteOpen(true); onClose?.(); }}
          title="Search (Ctrl+K)"
          className={`
            flex items-center gap-2 rounded-lg border transition-colors
            bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700
            text-gray-400 dark:text-gray-500
            hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:text-indigo-500
            ${collapsed && !onClose ? 'w-10 h-9 justify-center px-0' : 'w-full px-3 py-2'}
          `}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          {(!collapsed || onClose) && (
            <>
              <span className="flex-1 text-left text-xs">Search...</span>
              <kbd className="hidden sm:inline text-[10px] font-mono bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-400 dark:text-gray-500">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Nav scroll ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">

        {/* MAIN */}
        <SectionLabel label="Main" collapsed={collapsed && !onClose} />
        {NAV_MAIN.map(({ href, label, icon, badgeKey }) => (
          <NavItem
            key={href} href={href} label={label} icon={icon}
            badge={badgeKey === 'budget' ? budgetAlerts : 0}
            collapsed={collapsed && !onClose}
            active={active(href)}
            onClick={onClose}
          />
        ))}

        {/* TOOLS */}
        <SectionLabel label="Tools" collapsed={collapsed && !onClose} />
        {NAV_TOOLS.map(({ href, label, icon }) => (
          <NavItem
            key={href} href={href} label={label} icon={icon}
            collapsed={collapsed && !onClose}
            active={active(href)}
            onClick={onClose}
          />
        ))}
      </nav>

      {/* ── Bottom actions ── */}
      <div className="flex-shrink-0 px-3 pt-2 pb-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">

        {/* Alerts */}
        <div className="relative" ref={alertsRef}>
          <BottomBtn
            icon={Bell} label="Alerts" badge={alertsUnread} badgeColor="bg-red-500"
            collapsed={collapsed && !onClose}
            onClick={() => { setIsAlertsOpen(o => !o); setIsNotifsOpen(false); }}
          />
          {isAlertsOpen && (
            <Popup>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Financial Alerts
                </span>
                <Link href="/alerts" onClick={() => setIsAlertsOpen(false)} className="text-xs text-indigo-500 hover:underline font-medium">View all</Link>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {alerts.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" /> No alerts
                  </div>
                ) : alerts.map(a => (
                  <div key={a.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!a.isRead ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                    <span className="text-base mt-0.5">{alertEmoji(a.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{a.title}</p>
                        <span className={`text-[10px] font-bold ${alertPriColor(a.priority)}`}>{a.priority.toUpperCase()}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 mt-0.5">
                      {!a.isRead && <button onClick={e => markAlertRead(a.id, e)} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors" title="Mark read"><Check className="w-3 h-3" /></button>}
                      <button onClick={e => dismissAlert(a.id, e)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Dismiss"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Popup>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifsRef}>
          <BottomBtn
            icon={Mail} label="Notifications" badge={notifsUnread} badgeColor="bg-blue-500"
            collapsed={collapsed && !onClose}
            onClick={() => { setIsNotifsOpen(o => !o); setIsAlertsOpen(false); }}
          />
          {isNotifsOpen && (
            <Popup>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                <Link href="/notifications" onClick={() => setIsNotifsOpen(false)} className="text-xs text-indigo-500 hover:underline font-medium">View all</Link>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" /> No notifications
                  </div>
                ) : notifs.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!n.read ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
                    <span className="text-base mt-0.5">{notifEmoji(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate mb-0.5">{n.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 mt-0.5">
                      {!n.read && <button onClick={e => markNotifRead(n.id, e)} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors" title="Mark read"><Check className="w-3 h-3" /></button>}
                      <button onClick={e => dismissNotif(n.id, e)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Dismiss"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Popup>
          )}
        </div>

        {/* Theme */}
        <BottomBtn
          icon={ThemeIcon}
          label="Theme"
          sublabel={theme}
          collapsed={collapsed && !onClose}
          onClick={cycleTheme}
          title={`Theme: ${theme} — click to cycle`}
        />

        {/* Logout */}
        <div className="pt-1 border-t border-gray-100 dark:border-gray-800" />
        <BottomBtn
          icon={LogOut} label="Logout"
          collapsed={collapsed && !onClose}
          onClick={() => { logout(); onClose?.(); }}
          danger
        />
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside className={`
        hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40
        bg-white dark:bg-gray-900
        border-r border-gray-100 dark:border-gray-800
        shadow-[1px_0_0_0_rgba(0,0,0,0.04)]
        transition-[width] duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}>
        <Sidebar />
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center gap-3 px-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="text-base font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
          FinTrack
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setIsPaletteOpen(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={cycleTheme} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ───────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 h-screen w-72 z-50 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col shadow-2xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* ── Command Palette ────────────────────────────────────────────────── */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onLogout={logout}
        onCycleTheme={cycleTheme}
        currentTheme={theme}
      />
    </>
  );
}
