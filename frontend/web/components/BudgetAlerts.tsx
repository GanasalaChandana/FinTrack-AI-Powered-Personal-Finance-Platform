"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { AlertTriangle, XCircle } from "lucide-react";
import { alertService, type BudgetAlert } from "@/lib/api/services/alert.service";
import { isAuthenticated as hasSession } from "@/lib/api";
import { isPublicPath } from "@/lib/publicRoutes";

// 🛡️ Helper to check public/auth routes
function isPublicRoute(path: string | null): boolean {
  if (!path) return true;

  return isPublicPath(path);
}

export function BudgetAlerts() {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ Ensure client-only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ Auth + polling logic (CLIENT ONLY)
  useEffect(() => {
    if (!mounted) return;
    if (isPublicRoute(pathname)) return;

    const token = hasSession();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
    fetchAlerts();

    const interval = setInterval(() => {
      if (!isPublicRoute(window.location.pathname) && hasSession()) {
        fetchAlerts();
      }
    }, 30000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on mount / route change only; the loader is recreated every render
  }, [mounted, pathname]);

  const fetchAlerts = async () => {
    try {
      const token = hasSession();
      if (!token) return;

      const newAlerts = await alertService.getAlerts();

      newAlerts.forEach((alert) => {
        if (!alerts.find((a) => a.id === alert.id)) {
          showAlertToast(alert);
        }
      });

      setAlerts(newAlerts);
    } catch {
      // silent fail
    }
  };

  const showAlertToast = (alert: BudgetAlert) => {
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 p-4">
            <div className="flex items-start">
              <div className="pt-0.5">{getAlertIcon(alert.type)}</div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {alert.category} Budget Alert
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {getAlertMessage(alert)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  ${alert.currentSpent.toFixed(2)} / $
                  {alert.budgetAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              toast.dismiss(t.id);
              handleAcknowledge(alert.id);
            }}
            className="px-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Dismiss
          </button>
        </div>
      ),
      { duration: 10000, position: "top-right" }
    );
  };

  const getAlertMessage = (alert: BudgetAlert): string => {
    switch (alert.type) {
      case "WARNING_80":
      case "WARNING_90":
        return `You've spent ${alert.percentage.toFixed(0)}% of your budget`;
      case "EXCEEDED_100":
        return `You've exceeded your budget by ${(alert.percentage - 100).toFixed(
          0
        )}%`;
      default:
        return "Budget threshold reached";
    }
  };

  const getAlertIcon = (type: BudgetAlert["type"]) => {
    switch (type) {
      case "WARNING_80":
        return <AlertTriangle className="h-6 w-6 text-yellow-400" />;
      case "WARNING_90":
        return <AlertTriangle className="h-6 w-6 text-orange-400" />;
      case "EXCEEDED_100":
        return <XCircle className="h-6 w-6 text-red-400" />;
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await alertService.acknowledgeAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      toast.error("Failed to acknowledge alert");
    }
  };

  // 🛡️ ABSOLUTE hydration safety
  if (!mounted) return null;
  if (isPublicRoute(pathname)) return null;
  if (!isAuthenticated) return null;

  // ✅ NOTHING is rendered
  return null;
}
