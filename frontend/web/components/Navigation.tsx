// components/Navigation.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Mail, LogOut, Menu, X, Check, AlertTriangle, Camera, Brain, RefreshCw, Activity, Sun, Moon, Monitor } from "lucide-react";
import { getToken, removeToken } from "@/lib/api";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface Alert {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useThemePreference();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);
  const alertsDropdownRef = useRef<HTMLDivElement>(null);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const notificationsDropdownRef = useRef<HTMLDivElement>(null);

  // Backoff state — tracks consecutive poll failures to avoid hammering a sleeping backend
  const pollFailures = useRef(0);
  const MAX_POLL_FAILURES = 4; // skip polling after 4 consecutive failures (~8 min)

  const router = useRouter();
  const pathname = usePathname() || "";

  const isPublicRoute = (path: string) => {
    const publicPaths = ['/', '/login', '/register', '/signin', '/signup'];
    if (publicPaths.includes(path)) return true;
    return publicPaths.some(publicPath => path.startsWith(`${publicPath}/`) || path.startsWith(`${publicPath}?`));
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const token = getToken();
      const tokenExists = !!token;
      setHasToken(tokenExists);
      const shouldLoadData = tokenExists && !isPublicRoute(pathname);
      if (shouldLoadData) {
        loadAlerts();
        loadNotifications();
        const interval = setInterval(() => {
          const currentPath = window.location.pathname;
          if (!isPublicRoute(currentPath) && getToken()) {
            // Skip polling while backend appears to be down (backoff)
            if (pollFailures.current < MAX_POLL_FAILURES) {
              loadAlerts();
              loadNotifications();
            }
          }
        }, 120000); // poll every 2 minutes — reduces load on free-tier Render dyno
        return () => clearInterval(interval);
      }
    }
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAlerts = async () => {
    try {
      const currentPath = window.location.pathname;
      if (isPublicRoute(currentPath)) return;
      const token = getToken();
      if (!token) return;
      const userId = localStorage.getItem("userId");
      const response = await fetch(`${API_BASE_URL}/api/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest',
          ...(userId && { 'X-User-Id': userId }),
        },
        credentials: 'omit',
      });
      if (response.ok) {
        pollFailures.current = 0; // reset backoff on success
        const data = await response.json();
        setAlerts(data.slice(0, 5));
        setAlertsUnreadCount(data.filter((a: Alert) => !a.isRead).length);
      } else if (response.status === 401) {
        removeToken();
        setHasToken(false);
        setAlerts([]);
        setAlertsUnreadCount(0);
      } else {
        pollFailures.current += 1;
      }
    } catch {
      // Network error (backend asleep / offline)
      pollFailures.current += 1;
    }
  };

  const handleAlertMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/alerts/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (response.ok) {
        setAlerts(alerts.map(a => a.id === id ? { ...a, isRead: true } : a));
        setAlertsUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Silent fail
    }
  };

  const handleAlertDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (response.ok) {
        const dismissed = alerts.find(a => a.id === id);
        setAlerts(alerts.filter(a => a.id !== id));
        if (dismissed && !dismissed.isRead) {
          setAlertsUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch {
      // Silent fail
    }
  };

  const getAlertPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'expense_limit': return '💸';
      case 'budget_limit': return '💰';
      case 'achievement': return '🎉';
      case 'unusual_activity': return '🔍';
      default: return '🚨';
    }
  };

  const loadNotifications = async () => {
    try {
      const currentPath = window.location.pathname;
      if (isPublicRoute(currentPath)) return;
      const token = getToken();
      if (!token) return;
      const userStr = localStorage.getItem("user");
      if (!userStr || userStr === '{}') return;
      const user = JSON.parse(userStr);
      if (!user.id) return;
      const response = await fetch(`${API_BASE_URL}/api/notifications/user/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (response.ok) {
        pollFailures.current = 0; // reset backoff on success
        const data = await response.json();
        setNotifications(data.slice(0, 5));
        setNotificationsUnreadCount(data.filter((n: Notification) => !n.read).length);
      } else if (response.status === 401) {
        removeToken();
        setHasToken(false);
        setNotifications([]);
        setNotificationsUnreadCount(0);
      } else {
        pollFailures.current += 1;
      }
    } catch {
      // Network error (backend asleep / offline)
      pollFailures.current += 1;
    }
  };

  const handleNotificationMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      if (!token) return;
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.id) return;
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read?userId=${user.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (response.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
        setNotificationsUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Silent fail
    }
  };

  const handleNotificationDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      if (!token) return;
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.id) return;
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}?userId=${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (response.ok) {
        const dismissed = notifications.find(n => n.id === id);
        setNotifications(notifications.filter(n => n.id !== id));
        if (dismissed && !dismissed.read) {
          setNotificationsUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch {
      // Silent fail
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'welcome': return '👋';
      case 'alert': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      default: return '📬';
    }
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const itemDate = new Date(date);
    const diffMs = now.getTime() - itemDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleLogout = () => {
    removeToken();
    setHasToken(false);
    setAlerts([]);
    setNotifications([]);
    setAlertsUnreadCount(0);
    setNotificationsUnreadCount(0);
    router.push("/login?mode=signin");
  };

  if (!mounted) {
    return (
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center">
            <span className="text-2xl font-bold">FinTrack</span>
          </div>
        </div>
      </nav>
    );
  }

  if (isPublicRoute(pathname)) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  const navLink = (href: string, label: string, icon?: React.ReactNode) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive(href)
          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          : "text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link href={hasToken ? "/dashboard" : "/"} className="text-xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            FinTrack
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {hasToken && (
              <>
                {navLink("/dashboard", "Dashboard")}
                {navLink("/transactions", "Transactions")}
                {navLink("/goals-budgets", "Goals & Budgets")}
                {navLink("/reports", "Reports")}
                {navLink("/receipts", "Receipts", <Camera className="w-3.5 h-3.5" />)}
                {navLink("/health", "Health", <Activity className="w-3.5 h-3.5" />)}
                {navLink("/insights", "Insights", <Brain className="w-3.5 h-3.5" />)}
                {navLink("/recurring", "Recurring", <RefreshCw className="w-3.5 h-3.5" />)}
              </>
            )}
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-1">
            {hasToken ? (
              <>
                {/* Alerts */}
                <div className="relative" ref={alertsDropdownRef}>
                  <button
                    onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                    className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                    title="Financial Alerts"
                  >
                    <Bell className="w-5 h-5" />
                    {alertsUnreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {alertsUnreadCount > 9 ? '9+' : alertsUnreadCount}
                      </span>
                    )}
                  </button>
                  {isAlertsOpen && (
                    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />Financial Alerts
                        </h3>
                        <Link href="/alerts" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsAlertsOpen(false)}>View all</Link>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {alerts.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No alerts</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {alerts.map((alert) => (
                              <div key={alert.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${!alert.isRead ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                <div className="flex items-start gap-3">
                                  <span className="text-xl">{getAlertIcon(alert.type)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{alert.title}</p>
                                      <span className={`text-[10px] font-bold ${getAlertPriorityColor(alert.priority)}`}>{alert.priority.toUpperCase()}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{alert.message}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(alert.createdAt)}</p>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {!alert.isRead && <button onClick={(e) => handleAlertMarkAsRead(alert.id, e)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Mark as read"><Check className="w-3.5 h-3.5" /></button>}
                                    <button onClick={(e) => handleAlertDismiss(alert.id, e)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Dismiss"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {alerts.length > 0 && (
                        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                          <Link href="/alerts" className="block text-center text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsAlertsOpen(false)}>See all alerts →</Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="relative" ref={notificationsDropdownRef}>
                  <button
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                    title="Notifications"
                  >
                    <Mail className="w-5 h-5" />
                    {notificationsUnreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                        {notificationsUnreadCount > 9 ? '9+' : notificationsUnreadCount}
                      </span>
                    )}
                  </button>
                  {isNotificationsOpen && (
                    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        <Link href="/notifications" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsNotificationsOpen(false)}>View all</Link>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Mail className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {notifications.map((notification) => (
                              <div key={notification.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                <div className="flex items-start gap-3">
                                  <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{notification.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(notification.createdAt)}</p>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {!notification.read && <button onClick={(e) => handleNotificationMarkAsRead(notification.id, e)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Mark as read"><Check className="w-3.5 h-3.5" /></button>}
                                    <button onClick={(e) => handleNotificationDismiss(notification.id, e)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Dismiss"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
                          <Link href="/notifications" className="block text-center text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium" onClick={() => setIsNotificationsOpen(false)}>See all notifications →</Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

                {/* Theme Toggle */}
                <button
                  onClick={cycleTheme}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title={`Theme: ${theme} — click to cycle`}
                >
                  <ThemeIcon className="w-5 h-5" />
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login?mode=signin" className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition">Log In</Link>
                <Link href="/login?mode=signup" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Sign Up</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 space-y-1">
            {hasToken ? (
              <>
                {[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/transactions", label: "Transactions" },
                  { href: "/goals-budgets", label: "Goals & Budgets" },
                  { href: "/reports", label: "Reports" },
                  { href: "/receipts", label: "Receipt Scanner", icon: <Camera className="w-4 h-4" /> },
                  { href: "/health", label: "Health Score", icon: <Activity className="w-4 h-4" /> },
                  { href: "/insights", label: "AI Insights", icon: <Brain className="w-4 h-4" /> },
                  { href: "/recurring", label: "Recurring", icon: <RefreshCw className="w-4 h-4" /> },
                ].map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive(href)
                        ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {icon}
                    {label}
                    {href === "/alerts" && alertsUnreadCount > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alertsUnreadCount}</span>}
                    {href === "/notifications" && notificationsUnreadCount > 0 && <span className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{notificationsUnreadCount}</span>}
                  </Link>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                  <button
                    onClick={cycleTheme}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
                  >
                    <ThemeIcon className="w-4 h-4" />
                    Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 py-2">
                <Link href="/login?mode=signin" className="block px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">Log In</Link>
                <Link href="/login?mode=signup" className="block px-3 py-2.5 text-sm font-medium bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}