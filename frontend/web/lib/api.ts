// lib/api.ts - Updated for monolith (single backend on port 8080)

// =====================
// Types
// =====================

export interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  [key: string]: any;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface Transaction {
  id?: string;
  date: string;
  description: string;
  merchant?: string;
  category: string;
  type: "income" | "expense" | "INCOME" | "EXPENSE";
  amount: number;
  userId?: string;
  recurring?: boolean;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  tags?: string; // comma-separated string from backend e.g. "business,vacation"
  [key: string]: any;
}

export interface Budget {
  id?: string;
  category: string;
  budget: number;
  spent: number;
  icon: string;
  color: string;
  month?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface BudgetSummary {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentage: number;
  budgets: Budget[];
}

export interface Goal {
  id?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface Alert {
  id?: string;
  type: "budget_exceeded" | "goal_milestone" | "unusual_spending" | "bill_reminder" | "low_balance" | "achievement";
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  read: boolean;
  actionUrl?: string;
  metadata?: {
    budgetId?: string;
    goalId?: string;
    transactionId?: string;
    amount?: number;
    category?: string;
    [key: string]: any;
  };
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================
// Base URL helpers
// =====================

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  return url.replace(/\/$/, "");
}

function getTransactionsUrl(): string {
  return getBaseUrl();
}

function buildApiUrl(endpoint: string, useTransactionsService: boolean = false): string {
  const baseUrl = useTransactionsService ? getTransactionsUrl() : getBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

// =====================
// Auth token helpers
// =====================

const PRIMARY_TOKEN_KEY = "authToken";
const LEGACY_TOKEN_KEY = "ft_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token =
    localStorage.getItem(PRIMARY_TOKEN_KEY) ||
    localStorage.getItem(LEGACY_TOKEN_KEY) ||
    sessionStorage.getItem(PRIMARY_TOKEN_KEY) ||
    getCookieToken();
  return token || null;
}

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find((row) => row.startsWith(`${PRIMARY_TOKEN_KEY}=`));
  return tokenCookie ? tokenCookie.split("=")[1] : null;
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRIMARY_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
  sessionStorage.setItem(PRIMARY_TOKEN_KEY, token);
  // Add Secure flag on HTTPS (production). SameSite=Lax prevents CSRF.
  const isSecure = window.location.protocol === "https:";
  document.cookie = `${PRIMARY_TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PRIMARY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  localStorage.removeItem("isDemo");
  sessionStorage.removeItem(PRIMARY_TOKEN_KEY);
  document.cookie = `${PRIMARY_TOKEN_KEY}=; path=/; max-age=0`;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("user", JSON.stringify(user));
  if (user.id) {
    localStorage.setItem("userId", user.id.toString());
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// =====================
// Generic API helper
// =====================

const pendingRequests = new Map<string, Promise<any>>();

// Prevents multiple simultaneous refresh attempts
let isRefreshingToken = false;
let tokenRefreshPromise: Promise<boolean> | null = null;

/** Tries to silently refresh the JWT. Returns true on success, false on failure. */
async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshingToken && tokenRefreshPromise) return tokenRefreshPromise;

  isRefreshingToken = true;
  tokenRefreshPromise = (async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) {
          setToken(data.token);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshingToken = false;
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  useTransactionsService: boolean = false
): Promise<T> {
  const url = buildApiUrl(endpoint, useTransactionsService);
  const token = getToken();
  const user = getUser();

  const requestKey = `${options.method || "GET"}-${endpoint}-${JSON.stringify(options.body || "")}`;

  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (user?.id) {
    headers["X-User-Id"] = user.id.toString();
  }

  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, config);

      const contentType = response.headers.get("content-type") || "";
      let data: any = undefined;

      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return {} as T;
      }

      const text = await response.text();

      if (text && contentType.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch (err) {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
          }
          throw new Error("Invalid JSON from server");
        }
      } else if (text) {
        data = text;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Attempt a silent token refresh before giving up
          const refreshed = await tryRefreshToken();
          if (refreshed) {
            // Token renewed — retry the original request once with the new token
            pendingRequests.delete(requestKey);
            return apiRequest<T>(endpoint, options, useTransactionsService);
          }
          // Refresh failed or backend has no /refresh endpoint → log out
          removeToken();
          if (typeof window !== "undefined") {
            setTimeout(() => { window.location.href = "/login"; }, 100);
          }
        }

        const errorMessage =
          (data && typeof data === "object" && (data.message || data.error)) ||
          (typeof data === "string" && data) ||
          `HTTP error! status: ${response.status}`;

        throw new Error(errorMessage);
      }

      return data as T;
    } catch (error: any) {
      console.error(`API ERROR [${endpoint}]:`, error.message);
      throw error;
    } finally {
      pendingRequests.delete(requestKey);
    }
  })();

  pendingRequests.set(requestKey, requestPromise);
  return requestPromise;
}

// =====================
// Transactions API
// =====================

export const transactionsAPI = {
  getAll: async (filters?: Record<string, string | number>): Promise<Transaction[]> => {
    const params = new URLSearchParams(
      filters
        ? Object.entries(filters).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {})
        : {}
    );

    const endpoint = params.toString() ? `/api/transactions?${params}` : "/api/transactions";

    try {
      const data = await apiRequest<Transaction[] | any>(endpoint, { method: "GET" }, true);

      let transactions: Transaction[];

      if (Array.isArray(data)) {
        transactions = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.transactions)) transactions = data.transactions;
        else if (Array.isArray(data.data))    transactions = data.data;
        else if (Array.isArray(data.content)) transactions = data.content;
        else if (Array.isArray(data.items))   transactions = data.items;
        else if (Array.isArray(data.result))  transactions = data.result;
        else {
          console.error("Unexpected transactions response format:", JSON.stringify(data).slice(0, 300));
          return [];
        }
      } else {
        return [];
      }

      transactions = transactions.map((t) => ({
        ...t,
        type: (t.type ?? "expense").toLowerCase() as "income" | "expense",
        amount: Math.abs(t.amount),
      }));

      return transactions;
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  },

  getById: async (id: string): Promise<Transaction> => {
    return apiRequest<Transaction>(`/api/transactions/${id}`, { method: "GET" }, true);
  },

  create: async (transaction: Omit<Transaction, "id">): Promise<Transaction> => {
    return apiRequest<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    }, true);
  },

  update: async (id: string, transaction: Partial<Transaction>): Promise<Transaction> => {
    return apiRequest<Transaction>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(transaction),
    }, true);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/transactions/${id}`, { method: "DELETE" }, true);
  },

  /** Delete ALL transactions for the current user. Used before CSV import to avoid mixing demo data. */
  clearAll: async (): Promise<void> => {
    await apiRequest<{ message: string }>("/api/transactions/all", { method: "DELETE" }, true);
  },

  exportCsv: async (): Promise<Blob> => {
    const url = buildApiUrl("/api/transactions/export", true);
    const token = getToken();
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to export transactions");
    return response.blob();
  },
};

// =====================
// Auth API
// =====================

export const authAPI = {
  register: async (userData: {
    email: string;
    password: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  }): Promise<AuthResponse> => {
    let firstName = userData.firstName;
    let lastName = userData.lastName;
    if (!firstName && userData.name) {
      const parts = userData.name.trim().split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || parts[0];
    }

    const payload = {
      email: userData.email,
      password: userData.password,
      username: userData.username || userData.email.split("@")[0],
      firstName: firstName || "",
      lastName: lastName || "",
    };

    const response = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }, false);
    if (response.token) setToken(response.token);
    if (response.user) setUser(response.user);
    return response;
  },

  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }, false);
    if (response.token) setToken(response.token);
    if (response.user) setUser(response.user);
    return response;
  },

  logout: async (): Promise<void> => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" }, false);
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      removeToken();
    }
  },

  getCurrentUser: (): Promise<User> =>
    apiRequest<User>("/api/auth/me", { method: "GET" }, false),

  refreshToken: async (): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>("/api/auth/refresh", { method: "POST" }, false);
    if (response.token) setToken(response.token);
    return response;
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await apiRequest<User>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(userData),
    }, false);
    if (response) setUser(response);
    return response;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    return apiRequest("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }, false);
  },

  resetData: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>("/api/users/reset-data", {
      method: "POST",
    }, false);
  },

  demoLogin: async (): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>("/api/auth/demo", {
      method: "POST",
    }, false);
    if (response.token) setToken(response.token);
    if (response.user) setUser(response.user);
    // Mark this session as a demo so the banner shows
    if (typeof window !== "undefined") {
      localStorage.setItem("isDemo", "true");
    }
    return response;
  },
};

// =====================
// Budgets API
// =====================

export const budgetsAPI = {
  getAll: async (month?: string): Promise<Budget[]> => {
    const params = month ? `?month=${month}` : "";
    try {
      const data = await apiRequest<Budget[] | any>(`/api/budgets${params}`, { method: "GET" }, false);

      let budgets: Budget[] = [];

      if (Array.isArray(data)) {
        budgets = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.budgets))      budgets = data.budgets;
        else if (Array.isArray(data.data))    budgets = data.data;
        else if (Array.isArray(data.content)) budgets = data.content;
        else if (Array.isArray(data.items))   budgets = data.items;
      }

      if (budgets.length === 0) {
        try {
          const summary = await apiRequest<BudgetSummary>("/api/budgets/summary", { method: "GET" }, false);
          if (summary?.budgets && Array.isArray(summary.budgets) && summary.budgets.length > 0) {
            budgets = summary.budgets;
          }
        } catch (summaryErr) {
          console.error("Budget summary fallback failed:", summaryErr);
        }
      }

      return budgets.map((b) => ({
        ...b,
        budget: typeof b.budget === "string" ? parseFloat(b.budget) || 0 : (b.budget ?? 0),
        spent:  typeof b.spent  === "string" ? parseFloat(b.spent)  || 0 : (b.spent  ?? 0),
      }));
    } catch (error: any) {
      console.error("Error fetching budgets:", error);
      return [];
    }
  },

  getById: (id: string): Promise<Budget> =>
    apiRequest<Budget>(`/api/budgets/${id}`, { method: "GET" }, false),

  create: (budget: Omit<Budget, "id">): Promise<Budget> =>
    apiRequest<Budget>("/api/budgets", { method: "POST", body: JSON.stringify(budget) }, false),

  update: (id: string, budget: Partial<Budget>): Promise<Budget> =>
    apiRequest<Budget>(`/api/budgets/${id}`, { method: "PUT", body: JSON.stringify(budget) }, false),

  delete: (id: string): Promise<{ message: string }> =>
    apiRequest(`/api/budgets/${id}`, { method: "DELETE" }, false),

  clearAll: async (): Promise<void> => {
    await apiRequest<{ message: string }>("/api/budgets/all", { method: "DELETE" }, false);
  },

  updateSpent: (id: string, spent: number): Promise<Budget> =>
    apiRequest<Budget>(`/api/budgets/${id}/spent`, {
      method: "PATCH",
      body: JSON.stringify({ spent }),
    }, false),

  getSummary: (month?: string): Promise<BudgetSummary> => {
    const params = month ? `?month=${month}` : "";
    return apiRequest<BudgetSummary>(`/api/budgets/summary${params}`, { method: "GET" }, false);
  },
};

// =====================
// Goals API  ← NEW
// =====================

export const goalsAPI = {
  getAll: async (): Promise<Goal[]> => {
    try {
      const data = await apiRequest<Goal[] | any>("/api/goals", { method: "GET" }, false);
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        if (Array.isArray(data.goals))   return data.goals;
        if (Array.isArray(data.data))    return data.data;
        if (Array.isArray(data.content)) return data.content;
        if (Array.isArray(data.items))   return data.items;
      }
      return [];
    } catch (error) {
      console.error("Error fetching goals:", error);
      return [];
    }
  },

  getById: (id: string): Promise<Goal> =>
    apiRequest<Goal>(`/api/goals/${id}`, { method: "GET" }, false),

  create: (goal: Omit<Goal, "id">): Promise<Goal> =>
    apiRequest<Goal>("/api/goals", { method: "POST", body: JSON.stringify(goal) }, false),

  update: (id: string, goal: Partial<Goal>): Promise<Goal> =>
    apiRequest<Goal>(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify(goal) }, false),

  delete: (id: string): Promise<{ message: string }> =>
    apiRequest(`/api/goals/${id}`, { method: "DELETE" }, false),

  clearAll: async (): Promise<void> => {
    await apiRequest<{ message: string }>("/api/goals/all", { method: "DELETE" }, false);
  },
};

// =====================
// Alerts API
// =====================

export const alertsAPI = {
  getAll: async (): Promise<Alert[]> => {
    try {
      const data = await apiRequest<Alert[] | any>("/api/alerts", { method: "GET" }, false);
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        if (Array.isArray(data.alerts))  return data.alerts;
        if (Array.isArray(data.data))    return data.data;
        if (Array.isArray(data.content)) return data.content;
      }
      return [];
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      return [];
    }
  },

  getUnread: async (): Promise<Alert[]> => {
    try {
      const data = await apiRequest<Alert[] | any>("/api/alerts/unread", { method: "GET" }, false);
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray(data.alerts)) return data.alerts;
      return [];
    } catch (error) {
      console.error("Error fetching unread alerts:", error);
      return [];
    }
  },

  getById: (id: string): Promise<Alert> =>
    apiRequest<Alert>(`/api/alerts/${id}`, { method: "GET" }, false),

  create: (alert: Omit<Alert, "id">): Promise<Alert> =>
    apiRequest<Alert>("/api/alerts", { method: "POST", body: JSON.stringify(alert) }, false),

  markAsRead: (id: string): Promise<Alert> =>
    apiRequest<Alert>(`/api/alerts/${id}/read`, { method: "PATCH" }, false),

  markAllAsRead: (): Promise<{ message: string; count: number }> =>
    apiRequest("/api/alerts/mark-all-read", { method: "PATCH" }, false),

  delete: (id: string): Promise<{ message: string }> =>
    apiRequest(`/api/alerts/${id}`, { method: "DELETE" }, false),

  deleteAll: (): Promise<{ message: string; count: number }> =>
    apiRequest("/api/alerts", { method: "DELETE" }, false),
};

// =====================
// Notifications API
// =====================

export const notificationsAPI = {
  getAllForUser: async (userId: string): Promise<Notification[]> => {
    try {
      const data = await apiRequest<Notification[] | any>(
        `/api/notifications/user/${userId}`,
        { method: "GET" },
        false
      );
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray(data.notifications)) return data.notifications;
      return [];
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  },

  markAsRead: (id: string, userId: string): Promise<Notification> =>
    apiRequest<Notification>(`/api/notifications/${id}/read?userId=${userId}`, { method: "PATCH" }, false),

  markAllAsRead: (userId: string): Promise<{ message: string }> =>
    apiRequest(`/api/notifications/user/${userId}/read-all`, { method: "PATCH" }, false),

  delete: (id: string, userId: string): Promise<{ message: string }> =>
    apiRequest(`/api/notifications/${id}?userId=${userId}`, { method: "DELETE" }, false),
};

// =====================
// Reports API
// =====================

export const reportsAPI = {
  getOverview: (startDate?: string, endDate?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const endpoint = params.toString() ? `/api/reports/overview?${params}` : "/api/reports/overview";
    return apiRequest(endpoint, { method: "GET" }, false);
  },

  getByCategory: (startDate?: string, endDate?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const endpoint = params.toString() ? `/api/reports/category?${params}` : "/api/reports/category";
    return apiRequest(endpoint, { method: "GET" }, false);
  },

  getTrends: (period: "daily" | "weekly" | "monthly" | "yearly" = "monthly"): Promise<any> =>
    apiRequest(`/api/reports/trends?period=${period}`, { method: "GET" }, false),
};

// =====================
// Health API
// =====================

export const healthAPI = {
  check: (): Promise<{ status: string; timestamp: string }> =>
    apiRequest("/actuator/health", { method: "GET" }, false),

  ping: (): Promise<{ message: string }> =>
    apiRequest("/api/health/ping", { method: "GET" }, false),
};

// =====================
// Generic API wrapper
// =====================

const api = {
  get: <T = any>(endpoint: string, options?: RequestInit, useTransactionsService?: boolean): Promise<T> =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }, useTransactionsService),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit, useTransactionsService?: boolean): Promise<T> =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }, useTransactionsService),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit, useTransactionsService?: boolean): Promise<T> =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }, useTransactionsService),

  delete: <T = any>(endpoint: string, options?: RequestInit, useTransactionsService?: boolean): Promise<T> =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }, useTransactionsService),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit, useTransactionsService?: boolean): Promise<T> =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }, useTransactionsService),
};

export default api;