'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  User,
  Lock,
  Globe,
  DollarSign,
  Tag,
  Download,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

/* ===================== Types ===================== */
type TabKey = 'profile' | 'security' | 'preferences' | 'categories' | 'data';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface Preferences {
  currency: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeZone: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

/* ===================== Helpers ===================== */
const isTab = (v: string | null): v is TabKey =>
  v === 'profile' || v === 'security' || v === 'preferences' || v === 'categories' || v === 'data';

/* ===================== Main Content Component ===================== */
export default function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // hydration-safe
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // tab state + ?tab=
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  useEffect(() => {
    if (!mounted) return;
    const t = searchParams?.get('tab') ?? null;
    if (isTab(t)) setActiveTab(t);
  }, [mounted, searchParams]);

  const goTab = (t: TabKey) => {
    setActiveTab(t);
    const base = searchParams ?? new URLSearchParams();
    const sp = new URLSearchParams(Array.from(base.entries()));
    sp.set('tab', t);
    router.replace(`/settings?${sp.toString()}`, { scroll: false });
  };

  /* ----------------- State ----------------- */
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // EMPTY defaults (user fills later)
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [preferences, setPreferences] = useState<Preferences>({
    currency: '',
    dateFormat: 'MM/DD/YYYY',
    timeZone: '',
    language: 'en',
    theme: 'light',
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState<Omit<Category, 'id'>>({
    name: '',
    color: '#3b82f6',
    icon: '📦',
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const currencies: Currency[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  ];

  /* ----------------- Handlers ----------------- */
  const handleProfileUpdate = () => showToast('Profile saved!');
  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword)
      return showToast('Passwords do not match', 'error');
    if (passwordData.newPassword && passwordData.newPassword.length < 8)
      return showToast('Password must be at least 8 characters', 'error');
    showToast('Password changed!');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };
  const handlePreferencesUpdate = () => showToast('Preferences saved!');
  const handleAddCategory = () => {
    if (!newCategory.name.trim()) return showToast('Name required', 'error');
    setCategories((p) => [...p, { id: Date.now(), ...newCategory }]);
    setNewCategory({ name: '', color: '#3b82f6', icon: '📦' });
  };
  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    setCategories((p) => p.map((c) => (c.id === editingCategory.id ? editingCategory : c)));
    setEditingCategory(null);
  };
  const handleDeleteCategory = (id: number) =>
    setCategories((p) => p.filter((c) => c.id !== id));
  const handleExportData = () => showToast('Export started');
  const handleDeleteAccount = () => {
    const confirmed = window.confirm('Are you sure you want to delete your account? This cannot be undone.');
    if (confirmed) showToast('Account deletion initiated');
  };

  /* Skeleton to prevent hydration mismatch */
  if (!mounted)
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm mb-6 h-16" />
          <div className="bg-white rounded-lg shadow-sm h-[60vh]" />
        </div>
      </div>
    );

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account and preferences</p>
          </div>
          <div className="flex border-b overflow-x-auto">
            {(
              [
                { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4 inline mr-2" /> },
                { key: 'security', label: 'Security', icon: <Lock className="w-4 h-4 inline mr-2" /> },
                { key: 'preferences', label: 'Preferences', icon: <Globe className="w-4 h-4 inline mr-2" /> },
                { key: 'categories', label: 'Categories', icon: <Tag className="w-4 h-4 inline mr-2" /> },
                { key: 'data', label: 'Data & Privacy', icon: <Download className="w-4 h-4 inline mr-2" /> },
              ] as { key: TabKey; label: string; icon: React.ReactNode }[]
            ).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => goTab(key)}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === key
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(
                [
                  { key: 'firstName', label: 'First Name' },
                  { key: 'lastName', label: 'Last Name' },
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Phone', type: 'tel' },
                  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
                  { key: 'address', label: 'Address' },
                  { key: 'city', label: 'City' },
                  { key: 'country', label: 'Country' },
                  { key: 'postalCode', label: 'Postal Code' },
                ] as { key: keyof ProfileData; label: string; type?: string }[]
              ).map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                  <input
                    type={type ?? 'text'}
                    value={profileData[key]}
                    onChange={(e) => setProfileData({ ...profileData, [key]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleProfileUpdate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-semibold">Security</h2>
            {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((f) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                  {f.replace('Password', ' Password')}
                </label>
                <div className="relative">
                  <input
                    type={
                      f === 'currentPassword'
                        ? (showPassword ? 'text' : 'password')
                        : f === 'newPassword'
                        ? (showNewPassword ? 'text' : 'password')
                        : (showConfirmPassword ? 'text' : 'password')
                    }
                    value={passwordData[f]}
                    onChange={(e) => setPasswordData({ ...passwordData, [f]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <button
                    onClick={() =>
                      f === 'currentPassword'
                        ? setShowPassword((s) => !s)
                        : f === 'newPassword'
                        ? setShowNewPassword((s) => !s)
                        : setShowConfirmPassword((s) => !s)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {(f === 'currentPassword' && showPassword) ||
                    (f === 'newPassword' && showNewPassword) ||
                    (f === 'confirmPassword' && showConfirmPassword) ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            <div className="pt-4 border-t">
              <div className="flex gap-3 p-4 bg-blue-50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Password Requirements</h4>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• At least 8 characters</li>
                    <li>• Include uppercase/lowercase</li>
                    <li>• Include a number & special char</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handlePasswordChange}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Change Password
              </button>
            </div>
          </div>
        )}

        {/* PREFERENCES */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-semibold">Preferences</h2>
            <div>
              <label className="block text-sm mb-2 font-medium">Currency</label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select currency</option>
                {[
                  { code: 'USD', symbol: '$', name: 'US Dollar' },
                  { code: 'EUR', symbol: '€', name: 'Euro' },
                  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
                ].map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 font-medium">Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    dateFormat: e.target.value as Preferences['dateFormat'],
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 font-medium">Time Zone</label>
              <input
                type="text"
                placeholder="e.g. America/Los_Angeles"
                value={preferences.timeZone}
                onChange={(e) => setPreferences({ ...preferences, timeZone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 font-medium">Language</label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handlePreferencesUpdate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Custom Categories</h2>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Category name"
                value={editingCategory ? editingCategory.name : newCategory.name}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, name: e.target.value })
                    : setNewCategory({ ...newCategory, name: e.target.value })
                }
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Icon (emoji)"
                value={editingCategory ? editingCategory.icon : newCategory.icon}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, icon: e.target.value })
                    : setNewCategory({ ...newCategory, icon: e.target.value })
                }
                className="w-24 text-center border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="color"
                value={editingCategory ? editingCategory.color : newCategory.color}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, color: e.target.value })
                    : setNewCategory({ ...newCategory, color: e.target.value })
                }
                className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              {editingCategory ? (
                <>
                  <button
                    onClick={handleUpdateCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              )}
            </div>

            {categories.length === 0 ? (
              <p className="text-gray-500">No categories yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {categories.map((c) => (
                  <div key={c.id} className="p-4 border rounded-lg flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${c.color}20` }}
                      >
                        {c.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-gray-500">{c.color}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingCategory(c)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DATA */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Data Export</h2>
              <p className="text-gray-600 mb-4">Download your data as JSON.</p>
              <button
                onClick={handleExportData}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export All Data
              </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-red-200">
              <h2 className="text-xl font-semibold text-red-900 mb-4">Danger Zone</h2>
              <p className="text-gray-600 mb-4">
                Once you delete your account, there is no going back. This action is permanent and cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}