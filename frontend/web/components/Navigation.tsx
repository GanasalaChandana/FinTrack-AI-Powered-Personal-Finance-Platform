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

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href={hasToken ? "/dashboard" : "/"} className="text-2xl font-bold text-indigo-600">
            FinTrack
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {hasToken ? (
              <>
                <Link href="/dashboard" className={`${isActive("/dashboard") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600`}>Dashboard</Link>
                <Link href="/transactions" className={`${isActive("/transactions") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600`}>Transactions</Link>
                <Link href="/goals-budgets" className={`${isActive("/goals-budgets") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600`}>Goals & Budgets</Link>
                <Link href="/reports" className={`${isActive("/reports") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600`}>Reports</Link>
                <Link href="/receipts" className={`${isActive("/receipts") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600 flex items-center gap-1`}><Camera className="w-4 h-4" />Receipts</Link>
                <Link href="/health" className={`${isActive("/health") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600 flex items-center gap-1`}><Activity className="w-4 h-4" />Health</Link>
                <Link href="/insights" className={`${isActive("/insights") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600 flex items-center gap-1`}><Brain className="w-4 h-4" />Insights</Link>
                <Link href="/recurring" className={`${isActive("/recurring") ? "text-indigo-600 font-bold" : "text-gray-700"} hover:text-indigo-600 flex items-center gap-1`}><RefreshCw className="w-4 h-4" />Recurring</Link>
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-300">
                  <div className="relative" ref={alertsDropdownRef}>
                    <button onClick={() => setIsAlertsOpen(!isAlertsOpen)} className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition" title="Financial Alerts">
                      <Bell className="w-5 h-5" />
                      {alertsUnreadCount > 0 && <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">{alertsUnreadCount > 9 ? '9+' : alertsUnreadCount}</span>}
                    </button>
                    {isAlertsOpen && (
                      <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" />Financial Alerts</h3>
                          <Link href="/alerts" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium" onClick={() => setIsAlertsOpen(false)}>View all</Link>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {alerts.length === 0 ? (
                            <div className="p-8 text-center"><Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" /><p className="text-gray-600 text-sm">No alerts</p></div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {alerts.map((alert) => (
                                <div key={alert.id} className={`p-4 hover:bg-gray-50 transition ${!alert.isRead ? 'bg-red-50' : ''}`}>
                                  <div className="flex items-start gap-3">
                                    <div className="text-2xl">{getAlertIcon(alert.type)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                                        <span className={`text-xs font-semibold ${getAlertPriorityColor(alert.priority)}`}>{alert.priority.toUpperCase()}</span>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{alert.message}</p>
                                      <p className="text-xs text-gray-500 mt-1">{formatTime(alert.createdAt)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      {!alert.isRead && <button onClick={(e) => handleAlertMarkAsRead(alert.id, e)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark as read"><Check className="w-4 h-4" /></button>}
                                      <button onClick={(e) => handleAlertDismiss(alert.id, e)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Dismiss"><X className="w-4 h-4" /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {alerts.length > 0 && <div className="p-3 border-t border-gray-200 bg-gray-50"><Link href="/alerts" className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium" onClick={() => setIsAlertsOpen(false)}>See all alerts →</Link></div>}
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={notificationsDropdownRef}>
                    <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition" title="Notifications">
                      <Mail className="w-5 h-5" />
                      {notificationsUnreadCount > 0 && <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">{notificationsUnreadCount > 9 ? '9+' : notificationsUnreadCount}</span>}
                    </button>
                    {isNotificationsOpen && (
                      <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                          <Link href="/notifications" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium" onClick={() => setIsNotificationsOpen(false)}>View all</Link>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center"><Mail className="w-12 h-12 text-gray-400 mx-auto mb-2" /><p className="text-gray-600 text-sm">No notifications</p></div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {notifications.map((notification) => (
                                <div key={notification.id} className={`p-4 hover:bg-gray-50 transition ${!notification.read ? 'bg-blue-50' : ''}`}>
                                  <div className="flex items-start gap-3">
                                    <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                                      <p className="text-xs text-gray-500 mt-1">{formatTime(notification.createdAt)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      {!notification.read && <button onClick={(e) => handleNotificationMarkAsRead(notification.id, e)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark as read"><Check className="w-4 h-4" /></button>}
                                      <button onClick={(e) => handleNotificationDismiss(notification.id, e)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Dismiss"><X className="w-4 h-4" /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {notifications.length > 0 && <div className="p-3 border-t border-gray-200 bg-gray-50"><Link href="/notifications" className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium" onClick={() => setIsNotificationsOpen(false)}>See all notifications →</Link></div>}
                      </div>
                    )}
                  </div>
                  <button onClick={cycleTheme} className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-300 dark:hover:text-indigo-400 dark:hover:bg-indigo-950 rounded-lg transition" title={`Theme: ${theme} (click to cycle)`}>
                    <ThemeIcon className="w-5 h-5" />
                  </button>
                  <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"><LogOut className="w-4 h-4" /> Logout</button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login?mode=signin" className="text-gray-700 hover:text-indigo-600">Log In</Link>
                <Link href="/login?mode=signup" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">Sign Up</Link>
              </>
            )}
          </div>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-gray-700">{isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-xl">
          <div className="px-4 py-4 space-y-2">
            {hasToken ? (
              <>
                <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/dashboard") ? "bg-indigo-100" : ""}`}>Dashboard</Link>
                <Link href="/transactions" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/transactions") ? "bg-indigo-100" : ""}`}>Transactions</Link>
                <Link href="/goals-budgets" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/goals-budgets") ? "bg-indigo-100" : ""}`}>Goals & Budgets</Link>
                <Link href="/reports" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/reports") ? "bg-indigo-100" : ""}`}>Reports</Link>
                <Link href="/receipts" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/receipts") ? "bg-indigo-100" : ""} flex items-center gap-2`}><Camera className="w-4 h-4" />Receipt Scanner</Link>
                <Link href="/health" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/health") ? "bg-indigo-100" : ""} flex items-center gap-2`}><Activity className="w-4 h-4" />Health Score</Link>
                <Link href="/insights" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/insights") ? "bg-indigo-100" : ""} flex items-center gap-2`}><Brain className="w-4 h-4" />AI Insights</Link>
                <Link href="/recurring" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/recurring") ? "bg-indigo-100" : ""} flex items-center gap-2`}><RefreshCw className="w-4 h-4" />Recurring</Link>
                <Link href="/alerts" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/alerts") ? "bg-indigo-100" : ""} flex items-center gap-2`}><Bell className="w-4 h-4" />Financial Alerts{alertsUnreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{alertsUnreadCount}</span>}</Link>
                <Link href="/notifications" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 rounded-lg ${isActive("/notifications") ? "bg-indigo-100" : ""} flex items-center gap-2`}><Mail className="w-4 h-4" />Notifications{notificationsUnreadCount > 0 && <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{notificationsUnreadCount}</span>}</Link>
                <div className="pt-2 border-t border-gray-300 space-y-1">
                  <button onClick={cycleTheme} className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                    <ThemeIcon className="w-4 h-4" />
                    Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"><LogOut className="w-4 h-4" /> Logout</button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login?mode=signin" className="block px-4 py-3">Log In</Link>
                <Link href="/login?mode=signup" className="block px-4 py-3 bg-indigo-600 text-white text-center rounded-lg">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}