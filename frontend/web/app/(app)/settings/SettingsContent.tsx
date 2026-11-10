'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { type LucideIcon, Home, Landmark, User, Lock, Globe, Tag, Download, Trash2, Save, Eye, EyeOff, Shield, Loader2, CheckCircle, Bell, Sun, Moon, Monitor, FileJson, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { apiRequest, getUser, removeToken, type Transaction } from '@/lib/api';
import { errorMessage } from "@/lib/utils/errors";
import { CategoryModelCard } from '@/components/CategoryModelCard';
import { BankConnections } from '@/components/BankConnections';
import { HouseholdSettings } from '@/components/HouseholdSettings';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';
import { userCurrency, currencySymbol } from "@/lib/userPrefs";
import { setSynced } from "@/lib/userData";

/* ===================== Types ===================== */
type TabKey = 'profile' | 'security' | 'preferences' | 'categories' | 'notifications' | 'banks' | 'household';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface Preferences {
  currency: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  language: string;
  theme: 'light' | 'dark' | 'system';
}

interface NotificationPrefs {
  budgetAlerts: boolean;
  weeklyDigest: boolean;
  goalMilestones: boolean;
  largeTransactions: boolean;
  largeTransactionThreshold: number;
  monthlyReport: boolean;
  unusualSpending: boolean;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

const PREFS_KEY  = 'fintrack:settings-preferences';
const CATS_KEY   = 'fintrack:settings-categories';
const NOTIF_KEY  = 'fintrack:settings-notifications';

/** The backend's notification settings (see NotificationSettingsDto). */
interface ServerNotificationSettings {
  budgetAlertsEnabled: boolean;
  transactionAlertsEnabled: boolean;
  weeklyDigest: boolean;
  goalMilestones: boolean;
  monthlyReport: boolean;
  unusualSpending: boolean;
  largeTransactionThreshold: number;
}

const fromServer = (r: ServerNotificationSettings): NotificationPrefs => ({
  budgetAlerts: r.budgetAlertsEnabled,
  largeTransactions: r.transactionAlertsEnabled,
  weeklyDigest: r.weeklyDigest,
  goalMilestones: r.goalMilestones,
  monthlyReport: r.monthlyReport,
  unusualSpending: r.unusualSpending,
  largeTransactionThreshold: Number(r.largeTransactionThreshold),
});

const toServer = (n: NotificationPrefs): ServerNotificationSettings => ({
  budgetAlertsEnabled: n.budgetAlerts,
  transactionAlertsEnabled: n.largeTransactions,
  weeklyDigest: n.weeklyDigest,
  goalMilestones: n.goalMilestones,
  monthlyReport: n.monthlyReport,
  unusualSpending: n.unusualSpending,
  largeTransactionThreshold: n.largeTransactionThreshold,
});

const DEFAULT_NOTIFS: NotificationPrefs = {
  budgetAlerts:             true,
  weeklyDigest:             false,
  goalMilestones:           true,
  largeTransactions:        true,
  largeTransactionThreshold: 500,
  monthlyReport:            true,
  unusualSpending:          true,
};

const isTab = (v: string | null): v is TabKey =>
  v === 'profile' || v === 'security' || v === 'preferences' || v === 'categories' || v === 'notifications' || v === 'banks' || v === 'household';

/* ===================== Main Component ===================== */
export default function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mounted, setMounted]     = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const t = searchParams?.get('tab') ?? null;
    if (isTab(t)) setActiveTab(t);
  }, [mounted, searchParams]);

  const goTab = (t: TabKey) => {
    setActiveTab(t);
    const sp = new URLSearchParams(Array.from((searchParams ?? new URLSearchParams()).entries()));
    sp.set('tab', t);
    router.replace(`/settings?${sp.toString()}`, { scroll: false });
  };

  /* ── Toast ─────────────────────────────────────────────────── */
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Profile ────────────────────────────────────────────────── */
  const [profile, setProfile]               = useState<ProfileData>({ firstName: '', lastName: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving]   = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await apiRequest<Partial<ProfileData>>('/api/users/profile');
      setProfile({
        firstName: data.firstName ?? '',
        lastName:  data.lastName  ?? '',
        email:     data.email     ?? '',
      });
    } catch { /* silently fail */ }
    finally { setProfileLoading(false); }
  }, []);

  useEffect(() => { if (mounted) void loadProfile(); }, [mounted, loadProfile]);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      const updated = await apiRequest<Partial<ProfileData>>('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName }),
      });
      setProfile((p) => ({
        ...p,
        firstName: updated.firstName ?? p.firstName,
        lastName:  updated.lastName  ?? p.lastName,
      }));
      showToast('Profile saved!');
    } catch (e) {
      showToast(errorMessage(e) ?? 'Failed to save profile', 'error');
    } finally { setProfileSaving(false); }
  };

  /* ── Security ───────────────────────────────────────────────── */
  const [pwData, setPwData]           = useState<PasswordData>({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw,    setShowPw]        = useState(false);
  const [showNewPw, setShowNewPw]     = useState(false);
  const [showConfPw, setShowConfPw]   = useState(false);
  const [pwSaving, setPwSaving]       = useState(false);

  const handlePasswordChange = async () => {
    if (!pwData.currentPassword)                             return showToast('Enter your current password', 'error');
    if (pwData.newPassword !== pwData.confirmPassword)       return showToast('Passwords do not match', 'error');
    if (pwData.newPassword.length < 8)                       return showToast('New password must be at least 8 characters', 'error');
    setPwSaving(true);
    try {
      // Every other session is signed out; the response sets new session cookies for this one
      await apiRequest('/api/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwData.currentPassword, newPassword: pwData.newPassword }),
      });
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully!');
    } catch (e) {
      showToast(errorMessage(e) ?? 'Failed to change password', 'error');
    } finally { setPwSaving(false); }
  };

  /* ── Preferences ────────────────────────────────────────────── */
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); } catch { return {}; }
  });
  const mergedPrefs: Preferences = Object.assign(
    { currency: userCurrency(), dateFormat: 'MM/DD/YYYY' as const, language: 'en', theme: 'system' as const },
    prefs
  );

  const handlePrefsSave = () => {
    try { setSynced(PREFS_KEY, JSON.stringify(mergedPrefs)); } catch { }
    syncCurrency(mergedPrefs.currency);
    // Apply theme immediately
    const root = document.documentElement;
    if (mergedPrefs.theme === 'dark')  { root.classList.add('dark'); root.classList.remove('light'); }
    else if (mergedPrefs.theme === 'light') { root.classList.remove('dark'); root.classList.add('light'); }
    else { root.classList.remove('dark', 'light'); } // let OS decide
    showToast('Preferences saved!');
  };

  /** Emails and alerts are written on the server, so it keeps a copy of the currency. */
  const syncCurrency = (currency: string) => {
    const uid = getUser()?.id;
    if (!uid) return;
    apiRequest(`/api/notifications/settings/${uid}`, { method: 'PUT', body: JSON.stringify({ currency }) }).catch(() => { /* best effort */ });
  };

  /* ── Notifications ──────────────────────────────────────────── */
  // Stored on the server (GET/PUT /api/notifications/settings/{userId}) so the
  // backend can respect them; "budget alerts" and "large transactions" map to its
  // budgetAlertsEnabled / transactionAlertsEnabled.
  const [notifs, setNotifs] = useState<NotificationPrefs>(DEFAULT_NOTIFS);
  const [notifsSaving, setNotifsSaving] = useState(false);

  useEffect(() => {
    const uid = getUser()?.id;
    if (!uid) return;
    apiRequest<ServerNotificationSettings & { currency?: string }>(`/api/notifications/settings/${uid}`)
      .then((r) => {
        setNotifs(fromServer(r));
        if (r.currency && r.currency !== userCurrency()) syncCurrency(userCurrency()); // emails follow this browser's choice
      })
      .catch(() => { /* keep the defaults */ });
    try { localStorage.removeItem(NOTIF_KEY); } catch { } // the old browser-only copy
  }, []);

  const handleNotifsSave = async () => {
    const uid = getUser()?.id;
    if (!uid) return showToast('Not signed in', 'error');
    setNotifsSaving(true);
    try {
      const saved = await apiRequest<ServerNotificationSettings>(`/api/notifications/settings/${uid}`, {
        method: 'PUT',
        body: JSON.stringify(toServer(notifs)),
      });
      setNotifs(fromServer(saved));
      showToast('Notification preferences saved!');
    } catch (e) {
      showToast(errorMessage(e) ?? 'Failed to save notification preferences', 'error');
    } finally { setNotifsSaving(false); }
  };

  const toggleNotif = (key: keyof NotificationPrefs) => {
    if (typeof notifs[key] === 'boolean') {
      setNotifs((n) => ({ ...n, [key]: !n[key] }));
    }
  };

  /* ── Categories ─────────────────────────────────────────────── */
  const [categories, setCategories]     = useState<Category[]>(() => {
    try { return JSON.parse(localStorage.getItem(CATS_KEY) ?? '[]'); } catch { return []; }
  });
  const [newCat, setNewCat]             = useState<Omit<Category, 'id'>>({ name: '', color: '#3b82f6', icon: '📦' });
  const [editingCat, setEditingCat]     = useState<Category | null>(null);

  const persistCats = (cats: Category[]) => {
    setCategories(cats);
    try { setSynced(CATS_KEY, JSON.stringify(cats)); } catch { }
  };

  const handleAddCategory = () => {
    if (!newCat.name.trim()) return showToast('Name required', 'error');
    persistCats([...categories, { id: Date.now(), ...newCat }]);
    setNewCat({ name: '', color: '#3b82f6', icon: '📦' });
    showToast('Category added!');
  };
  const handleUpdateCategory = () => {
    if (!editingCat) return;
    persistCats(categories.map((c) => (c.id === editingCat.id ? editingCat : c)));
    setEditingCat(null);
    showToast('Category updated!');
  };
  const handleDeleteCategory = (id: number) => {
    persistCats(categories.filter((c) => c.id !== id));
    showToast('Category deleted');
  };

  /* ── Data Export ────────────────────────────────────────────── */
  const [exporting, setExporting]   = useState(false);
  const [exportType, setExportType] = useState<'json' | 'csv'>('csv');

  const handleExport = async () => {
    setExporting(true);
    try {
      const currentUser = getUser();
      if (!currentUser?.id) { showToast('Not authenticated', 'error'); return; }

      const transactions = await apiRequest<Transaction[]>('/api/transactions');
      const owned = Array.isArray(transactions)
        ? transactions.filter((t) => !t.userId || t.userId === currentUser.id)
        : [];

      if (exportType === 'json') {
        // Plus debts, net worth, custom categories and the other data saved with the account
        const saved = await apiRequest<Record<string, unknown>>('/api/user-data').catch(() => ({}));
        const exportData = { exportedAt: new Date().toISOString(), userId: currentUser.id, transactions: owned, savedData: saved };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `fintrack-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        // CSV export
        const headers = ['Date', 'Merchant', 'Description', 'Amount', 'Category', 'Type'];
        const rows = owned.map((t) => [
          t.date ?? '',
          `"${(t.merchant ?? '').replace(/"/g, '""')}"`,
          `"${(t.description ?? '').replace(/"/g, '""')}"`,
          t.amount ?? 0,
          `"${(t.category ?? '').replace(/"/g, '""')}"`,
          t.type ?? '',
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `fintrack-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
      }

      showToast(`Export downloaded as ${exportType.toUpperCase()}!`);
    } catch (e) {
      showToast(errorMessage(e) ?? 'Export failed', 'error');
    } finally { setExporting(false); }
  };

  /* ── Delete account ─────────────────────────────────────────── */
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Delete your account? This cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    try {
      await apiRequest('/api/users/me', { method: 'DELETE' });
      removeToken();
      router.replace('/register');
    } catch (e) { showToast(errorMessage(e) ?? 'Failed to delete account', 'error'); setDeleting(false); }
  };

  /* ── Hydration guard ────────────────────────────────────────── */
  if (!mounted) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl h-16 animate-pulse" />
        <div className="bg-white dark:bg-gray-800 rounded-2xl h-64 animate-pulse" />
      </div>
    </div>
  );

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 dark:text-gray-100 transition placeholder:text-gray-400 dark:placeholder:text-gray-500';

  const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
    { key: 'profile',       label: 'Profile',       Icon: User   },
    { key: 'security',      label: 'Security',      Icon: Lock   },
    { key: 'preferences',   label: 'Preferences',   Icon: Globe  },
    { key: 'notifications', label: 'Notifications', Icon: Bell   },
    { key: 'categories',    label: 'Categories',    Icon: Tag    },
    { key: 'banks',         label: 'Bank accounts', Icon: Landmark },
    { key: 'household',     label: 'Household',     Icon: Home },
  ];

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header + Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Manage your account and preferences</p>
          </div>
          {/* Phones: a picker instead of a tab bar that hides most of its tabs off-screen */}
          <div className="sm:hidden px-4 pb-4">
            <label htmlFor="settings-section" className="sr-only">Settings section</label>
            <select id="settings-section" value={activeTab} onChange={(e) => goTab(e.target.value as TabKey)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {TABS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="hidden sm:flex overflow-x-auto px-2 scrollbar-hide">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => goTab(key)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                  activeTab === key
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── PROFILE ── */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">Profile Information</h2>
            {profileLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Avatar placeholder */}
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {(profile.firstName?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your Name'}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">{profile.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">First Name</label>
                    <input className={inputCls} value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Last Name</label>
                    <input className={inputCls} value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
                  <input className={`${inputCls} bg-slate-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed`}
                    value={profile.email} readOnly />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={handleProfileSave} disabled={profileSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60">
                    {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECURITY ── */}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Change Password</h2>
            {([
              { field: 'currentPassword' as const, label: 'Current Password', show: showPw,     toggle: () => setShowPw(s => !s)     },
              { field: 'newPassword'     as const, label: 'New Password',     show: showNewPw,   toggle: () => setShowNewPw(s => !s)   },
              { field: 'confirmPassword' as const, label: 'Confirm Password', show: showConfPw,  toggle: () => setShowConfPw(s => !s)  },
            ]).map(({ field, label, show, toggle }) => (
              <div key={field}>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} className={`${inputCls} pr-10`}
                    value={pwData[field]}
                    onChange={(e) => setPwData({ ...pwData, [field]: e.target.value })} />
                  <button type="button" onClick={toggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl">
              <Shield className="w-4 h-4 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
              <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-0.5">
                <li>• At least 8 characters</li>
                <li>• Use uppercase, lowercase, numbers, and special characters</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <button onClick={handlePasswordChange} disabled={pwSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60">
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </div>
          </div>
        )}
        {activeTab === 'security' && <TwoFactorSettings notify={(m, t) => showToast(m, t)} />}

        {/* ── PREFERENCES ── */}
        {activeTab === 'preferences' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Preferences</h2>

            {/* Theme */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                App Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { val: 'light',  label: 'Light',  Icon: Sun     },
                  { val: 'dark',   label: 'Dark',   Icon: Moon    },
                  { val: 'system', label: 'System', Icon: Monitor },
                ] as const).map(({ val, label, Icon }) => (
                  <button key={val} onClick={() => setPrefs({ ...mergedPrefs, theme: val })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      mergedPrefs.theme === val
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Currency</label>
              <select className={inputCls} value={mergedPrefs.currency}
                onChange={(e) => setPrefs({ ...mergedPrefs, currency: e.target.value })}>
                {[
                  { code: 'USD', label: '$ — US Dollar'      },
                  { code: 'EUR', label: '€ — Euro'           },
                  { code: 'INR', label: '₹ — Indian Rupee'   },
                  { code: 'GBP', label: '£ — British Pound'  },
                  { code: 'CAD', label: 'C$ — Canadian Dollar'},
                  { code: 'AUD', label: 'A$ — Australian Dollar'},
                  { code: 'JPY', label: '¥ — Japanese Yen'   },
                ].map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Changes how amounts are shown. Amounts aren&apos;t converted between currencies.</p>
            </div>

            {/* Date Format */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Date Format</label>
              <select className={inputCls} value={mergedPrefs.dateFormat}
                onChange={(e) => setPrefs({ ...mergedPrefs, dateFormat: e.target.value as Preferences['dateFormat'] })}>
                {(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="flex justify-end">
              <button onClick={handlePrefsSave}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition">
                <Save className="w-4 h-4" /> Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Notification Preferences</h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                Control which alerts and summaries you receive
              </p>
            </div>

            {/* Toggle rows */}
            {([
              {
                key: 'budgetAlerts' as const,
                label: 'Budget Alerts',
                desc: 'Notify when you approach or exceed a budget category limit',
                Icon: AlertCircle,
                color: 'text-red-500',
              },
              {
                key: 'unusualSpending' as const,
                label: 'Unusual Spending',
                desc: 'Flag transactions that are significantly higher than your average',
                Icon: AlertCircle,
                color: 'text-amber-500',
              },
              {
                key: 'goalMilestones' as const,
                label: 'Goal Milestones',
                desc: 'Celebrate when you hit 25%, 50%, 75%, and 100% of a savings goal',
                Icon: CheckCircle,
                color: 'text-emerald-500',
              },
              {
                key: 'largeTransactions' as const,
                label: 'Large Transactions',
                desc: 'Alert for any single transaction above your threshold',
                Icon: Bell,
                color: 'text-indigo-500',
              },
              {
                key: 'weeklyDigest' as const,
                label: 'Weekly Digest',
                desc: 'Summary of your spending every Sunday',
                Icon: Bell,
                color: 'text-blue-500',
              },
              {
                key: 'monthlyReport' as const,
                label: 'Monthly Report',
                desc: 'Full income, expense, and savings breakdown at month end',
                Icon: Bell,
                color: 'text-purple-500',
              },
            ]).map(({ key, label, desc, Icon, color }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => toggleNotif(key)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    notifs[key] ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={Boolean(notifs[key])}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    notifs[key] ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}

            {/* Large transaction threshold */}
            {notifs.largeTransactions && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/40 p-4">
                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-2">
                  Large Transaction Threshold
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{currencySymbol()}</span>
                  <input
                    type="number"
                    min={1}
                    value={notifs.largeTransactionThreshold}
                    onChange={(e) => setNotifs((n) => ({ ...n, largeTransactionThreshold: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-28 px-3 py-2 border border-indigo-200 dark:border-indigo-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-400 dark:text-gray-500">or more triggers an alert</span>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => void handleNotifsSave()} disabled={notifsSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60">
                {notifsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Preferences
              </button>
            </div>
          </div>
        )}

        {activeTab === 'household' && (
          <div className="space-y-6">
            <HouseholdSettings notify={(m, t) => showToast(m, t)} />
          </div>
        )}

        {activeTab === 'banks' && (
          <div className="space-y-6">
            <BankConnections notify={(m, t) => showToast(m, t)} />
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <CategoryModelCard />
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">Custom Categories</h2>
              <div className="flex gap-2 mb-6 flex-wrap">
                <input placeholder="Category name"
                  value={editingCat ? editingCat.name : newCat.name}
                  onChange={(e) => editingCat
                    ? setEditingCat({ ...editingCat, name: e.target.value })
                    : setNewCat({ ...newCat, name: e.target.value })
                  }
                  className={`${inputCls} flex-1 min-w-32`} />
                <input placeholder="Icon" title="Emoji icon"
                  value={editingCat ? editingCat.icon : newCat.icon}
                  onChange={(e) => editingCat
                    ? setEditingCat({ ...editingCat, icon: e.target.value })
                    : setNewCat({ ...newCat, icon: e.target.value })
                  }
                  className="w-16 text-center border border-gray-200 dark:border-gray-600 rounded-xl px-2 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100" />
                <input type="color"
                  value={editingCat ? editingCat.color : newCat.color}
                  onChange={(e) => editingCat
                    ? setEditingCat({ ...editingCat, color: e.target.value })
                    : setNewCat({ ...newCat, color: e.target.value })
                  }
                  className="w-10 h-10 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer p-0.5 bg-white dark:bg-gray-700" />
                {editingCat ? (
                  <>
                    <button onClick={handleUpdateCategory}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700">Update</button>
                    <button onClick={() => setEditingCat(null)}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 dark:text-gray-300 transition">Cancel</button>
                  </>
                ) : (
                  <button onClick={handleAddCategory}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700">Add</button>
                )}
              </div>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No custom categories yet. Add one above.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {categories.map((c) => (
                    <div key={c.id}
                      className="flex items-center justify-between p-3.5 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: `${c.color}20` }}>{c.icon}</div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingCat(c)}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"><Tag className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteCategory(c.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data & Privacy */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Data & Privacy</h3>

              {/* Export with format toggle */}
              <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Export Your Data</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Download all your transactions</p>

                    {/* Format picker */}
                    <div className="flex gap-2 mt-3">
                      {([
                        { val: 'csv'  as const, label: 'CSV',  Icon: FileSpreadsheet },
                        { val: 'json' as const, label: 'JSON', Icon: FileJson        },
                      ]).map(({ val, label, Icon }) => (
                        <button key={val} onClick={() => setExportType(val)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            exportType === val
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                          }`}>
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleExport} disabled={exporting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-60 self-start">
                    {exporting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                    Export {exportType.toUpperCase()}
                  </button>
                </div>
              </div>

              {/* Delete account */}
              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-400">Delete Account</p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Permanently delete your account and all data</p>
                </div>
                <button onClick={handleDeleteAccount} disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-60">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
