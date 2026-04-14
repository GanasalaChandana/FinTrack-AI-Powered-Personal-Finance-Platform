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
  PiggyBank,
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

// ── Nav item data ────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: "/dashboard",    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions",   icon: ArrowLeftRight },
  { href: "/goals-budgets",label: "Goals & Budgets",icon: Target,     badgeKey: "budget" },
  { href: "/reports",      label: "Reports",        icon: BarChart3 },
  { href: "/calendar",     label: "Calendar",       icon: Calendar },
];

const NAV_TOOLS = [
  { href: "/income",       label: "Income",         icon: TrendingUp },
  { href: "/debt",         label: "Debt Payoff",    icon: CreditCard },
  { href: "/analytics",    label: "Analytics",      icon: BarChart3 },
  { href: "/net-worth",    label: "Net Worth",      icon: Wallet },
  { href: "/recurring",    label: "Recurring",      icon: RefreshCw },
  { href: "/health",       label: "Health Score",   icon: Activity },
  { href: "/insights",     label: "AI Insights",    icon: Brain },
  { href: "/receipts",     label: "Receipts",       icon: Camera },
];

export default function Navigation() {
  const [mounted,      setMounted]      = useState(false);
  const [hasToken,     setHasToken]     = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);   // icon-only mode
  const [mobileOpen,   setMobileOpen]   = useState(false);   // mobile overlay
  const [budgetAlertCount, setBudgetAlertCount] = useState(0);
  const [isPaletteOpen,    setIsPaletteOpen]    = useState(false);

  const [isAlertsOpen,          setIsAlertsOpen]          = useState(false);
  const [alerts,                setAlerts]                 = useState<Alert[]>([]);
  const [alertsUnreadCount,     setAlertsUnreadCount]      = useState(0);
  const alertsRef = useRef<HTMLDivElement>(null);

  const [isNotificationsOpen,       setIsNotificationsOpen]       = useState(false);
  const [notifications,             setNotifications]             = useState<Notification[]>([]);
  const [notificationsUnreadCount,  setNotificationsUnreadCount]  = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const pollFailures   = useRef(0);
  const MAX_FAILURES   = 4;

  const { theme, setTheme } = useThemePreference();
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const router   = useRouter();
  const pathname = usePathname() || "";

  const isPublicRoute = (p: string) => {
    const pub = ['/', '/login', '/register', '/signin', '/signup'];
    return pub.includes(p) || pub.some(pp => p.startsWith(`${pp}/`) || p.startsWith(`${pp}?`));
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const token = getToken();
    setHasToken(!!token);

    const readBudgetAlerts = () => {
      const n = parseInt(localStorage.getItem("fintrack-budget-alerts") || "0", 10);
      setBudgetAlertCount(isNaN(n) ? 0 : n);
    };
    readBudgetAlerts();
    window.addEventListener("fintrack-budget-alerts-updated", readBudgetAlerts);
    window.addEventListener("storage", readBudgetAlerts);

    const handleCmdK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (getToken()) setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleCmdK);

    if (token && !isPublicRoute(pathname)) {
      loadAlerts(); loadNotifications();
      const iv = setInterval(() => {
        if (!isPublicRoute(window.location.pathname) && getToken() && pollFailures.current < MAX_FAILURES) {
          loadAlerts(); loadNotifications();
        }
      }, 120000);
      return () => {
        clearInterval(iv);
        window.removeEventListener("fintrack-budget-alerts-updated", readBudgetAlerts);
        window.removeEventListener("storage", readBudgetAlerts);
        window.removeEventListener("keydown", handleCmdK);
      };
    }
    return () => {
      window.removeEventListener("fintrack-budget-alerts-updated", readBudgetAlerts);
      window.removeEventListener("storage", readBudgetAlerts);
      window.removeEventListener("keydown", handleCmdK);
    };
  }, [pathname]);

  // close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setIsAlertsOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setIsNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // keep CSS variable in sync with collapsed state (used by ClientLayout for content offset)
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '4rem' : '15rem');
  }, [collapsed]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadAlerts = async () => {
    try {
      if (isPublicRoute(window.location.pathname)) return;
      const token = getToken(); if (!token) return;
      const userId = localStorage.getItem("userId");
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest', ...(userId && { 'X-User-Id': userId }) },
        credentials: 'omit',
      });
      if (res.ok) {
        pollFailures.current = 0;
        const data = await res.json();
        setAlerts(data.slice(0, 5));
        setAlertsUnreadCount(data.filter((a: Alert) => !a.isRead).length);
      } else if (res.status === 401) { removeToken(); setHasToken(false); setAlerts([]); setAlertsUnreadCount(0); }
      else pollFailures.current += 1;
    } catch { pollFailures.current += 1; }
  };

  const loadNotifications = async () => {
    try {
      if (isPublicRoute(window.location.pathname)) return;
      const token = getToken(); if (!token) return;
      const userStr = localStorage.getItem("user");
      if (!userStr || userStr === '{}') return;
      const user = JSON.parse(userStr); if (!user.id) return;
      const res = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (res.ok) {
        pollFailures.current = 0;
        const data = await res.json();
        setNotifications(data.slice(0, 5)); setNotificationsUnreadCount(data.filter((n: Notification) => !n.read).length);
      } else if (res.status === 401) { removeToken(); setHasToken(false); setNotifications([]); setNotificationsUnreadCount(0); }
      else pollFailures.current += 1;
    } catch { pollFailures.current += 1; }
  };

  const handleAlertMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/alerts/${id}/read`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) { setAlerts(a => a.map(x => x.id === id ? { ...x, isRead: true } : x)); setAlertsUnreadCount(n => Math.max(0, n - 1)); }
  };

  const handleAlertDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/alerts/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) {
      const dismissed = alerts.find(a => a.id === id);
      setAlerts(a => a.filter(x => x.id !== id));
      if (dismissed && !dismissed.isRead) setAlertsUnreadCount(n => Math.max(0, n - 1));
    }
  };

  const handleNotifMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const user = JSON.parse(localStorage.getItem("user") || "{}"); if (!user.id) return;
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read?userId=${user.id}`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) { setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x)); setNotificationsUnreadCount(n => Math.max(0, n - 1)); }
  };

  const handleNotifDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken(); if (!token) return;
    const user = JSON.parse(localStorage.getItem("user") || "{}"); if (!user.id) return;
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}?userId=${user.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'omit',
    });
    if (res.ok) {
      const dismissed = notifications.find(n => n.id === id);
      setNotifications(n => n.filter(x => x.id !== id));
      if (dismissed && !dismissed.read) setNotificationsUnreadCount(n => Math.max(0, n - 1));
    }
  };

  const handleLogout = () => {
    removeToken(); setHasToken(false); setAlerts([]); setNotifications([]);
    setAlertsUnreadCount(0); setNotificationsUnreadCount(0);
    router.push("/login?mode=signin");
  };

  const alertPriorityColor = (p: string) =>
    p === 'urgent' ? 'text-red-600' : p === 'high' ? 'text-orange-600' : p === 'medium' ? 'text-yellow-600' : 'text-blue-600';

  const alertIcon   = (t: string) => ({ expense_limit: '💸', budget_limit: '💰', achievement: '🎉', unusual_activity: '🔍' }[t] ?? '🚨');
  const notifIcon   = (t: string) => ({ welcome: '👋', alert: '⚠️', info: 'ℹ️', success: '✅', warning: '⚠️' }[t.toLowerCase()] ?? '📬');

  const fmtTime = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!mounted) return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col items-center justify-center">
      <span className="text-xl font-bold text-indigo-600">FinTrack</span>
    </aside>
  );

  if (isPublicRoute(pathname) || !hasToken) return null;

  const isActive = (href: string) => pathname === href;

  // ── Sidebar content (shared between desktop + mobile overlay) ─────────────
  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">

      {/* Logo + collapse toggle */}
      <div className={`flex items-center h-16 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 ${collapsed ? 'justify-center px-3' : 'px-5 gap-3'}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)' }}>
          <PiggyBank className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight" onClick={onClose}>
            FinTrack
          </Link>
        )}
        {/* collapse btn — desktop only */}
        {!onClose && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex ml-auto p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">

        {/* Search / Cmd+K */}
        <button
          onClick={() => { setIsPaletteOpen(true); onClose?.(); }}
          className={`w-full flex items-center gap-3 mb-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-200 dark:border-gray-700 transition ${collapsed ? 'justify-center' : ''}`}
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left text-xs">Search...</span>
          )}
          {!collapsed && (
            <kbd className="text-[10px] font-mono bg-white dark:bg-gray-700 rounded px-1 py-0.5 border border-gray-200 dark:border-gray-600 text-gray-400">⌘K</kbd>
          )}
        </button>

        {/* MAIN section */}
        {!collapsed && (
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Main</p>
        )}
        {NAV_MAIN.map(({ href, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey === 'budget' ? budgetAlertCount : 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                isActive(href)
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {isActive(href) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive(href) ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'}`} />
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-orange-500 rounded-full px-1">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {collapsed && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* TOOLS section */}
        <div className={collapsed ? 'pt-3' : 'pt-4'}>
          {!collapsed && (
            <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Tools</p>
          )}
          {collapsed && <div className="mx-3 border-t border-gray-100 dark:border-gray-800 mb-2" />}
          {NAV_TOOLS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                isActive(href)
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {isActive(href) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive(href) ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'}`} />
              {!collapsed && <span className="flex-1">{label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom action bar */}
      <div className={`flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-2 ${collapsed ? 'flex flex-col gap-1 items-center' : 'space-y-0.5'}`}>

        {/* Alerts */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => { setIsAlertsOpen(o => !o); setIsNotificationsOpen(false); }}
            title="Alerts"
            className={`relative flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition ${collapsed ? 'justify-center w-10 h-10 px-0' : ''}`}
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Alerts</span>}
            {alertsUnreadCount > 0 && (
              <span className={`flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full px-1 ${collapsed ? 'absolute top-0 right-0 w-4 h-4 min-w-0 px-0' : ''}`}>
                {alertsUnreadCount > 9 ? '9+' : alertsUnreadCount}
              </span>
            )}
          </button>
          {isAlertsOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-88 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50" style={{ width: '360px' }}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Financial Alerts
                </h3>
                <Link href="/alerts" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsAlertsOpen(false)}>View all</Link>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center"><Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">No alerts</p></div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {alerts.map(alert => (
                      <div key={alert.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${!alert.isRead ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{alertIcon(alert.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{alert.title}</p>
                              <span className={`text-[10px] font-bold ${alertPriorityColor(alert.priority)}`}>{alert.priority.toUpperCase()}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(alert.createdAt)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!alert.isRead && <button onClick={e => handleAlertMarkAsRead(alert.id, e)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark read"><Check className="w-3.5 h-3.5" /></button>}
                            <button onClick={e => handleAlertDismiss(alert.id, e)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Dismiss"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => { setIsNotificationsOpen(o => !o); setIsAlertsOpen(false); }}
            title="Notifications"
            className={`relative flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition ${collapsed ? 'justify-center w-10 h-10 px-0' : ''}`}
          >
            <Mail className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Notifications</span>}
            {notificationsUnreadCount > 0 && (
              <span className={`flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-blue-500 rounded-full px-1 ${collapsed ? 'absolute top-0 right-0 w-4 h-4 min-w-0 px-0' : ''}`}>
                {notificationsUnreadCount > 9 ? '9+' : notificationsUnreadCount}
              </span>
            )}
          </button>
          {isNotificationsOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50" style={{ width: '360px' }}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <Link href="/notifications" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsNotificationsOpen(false)}>View all</Link>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center"><Mail className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">No notifications</p></div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {notifications.map(notif => (
                      <div key={notif.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{notifIcon(notif.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{notif.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(notif.createdAt)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!notif.read && <button onClick={e => handleNotifMarkAsRead(notif.id, e)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark read"><Check className="w-3.5 h-3.5" /></button>}
                            <button onClick={e => handleNotifDismiss(notif.id, e)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Dismiss"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme}`}
          className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition ${collapsed ? 'justify-center w-10 h-10 px-0' : ''}`}
        >
          <ThemeIcon className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="flex-1 text-left capitalize">{theme} mode</span>}
        </button>

        {/* Logout */}
        <button
          onClick={() => { handleLogout(); onClose?.(); }}
          className={`flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition ${collapsed ? 'justify-center w-10 h-10 px-0' : ''}`}
          title="Logout"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile: top bar ─────────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">FinTrack</Link>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setIsPaletteOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={cycleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile overlay ───────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 z-50" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 h-screen w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* ── Command Palette ─────────────────────────────────────────────────── */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onLogout={handleLogout}
        onCycleTheme={cycleTheme}
        currentTheme={theme}
      />
    </>
  );
}
