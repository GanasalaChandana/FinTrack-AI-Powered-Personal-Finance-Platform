// frontend/web/components/ClientLayout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

import Navigation from "@/components/Navigation";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { BudgetAlerts } from "@/components/BudgetAlerts";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Helper to check if route is public/auth
 */
function isPublicRoute(path: string | null): boolean {
  if (!path) return true;

  const publicPaths = ["/", "/login", "/register", "/signin", "/signup", "/auth"];

  return (
    publicPaths.includes(path) ||
    publicPaths.some((p) => path.startsWith(`${p}/`) || path.startsWith(`${p}?`))
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Ensure hydration safety - wait for client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth guard (CLIENT ONLY)
  useEffect(() => {
    if (!mounted) return;

    const isAuthPage = isPublicRoute(pathname);
    if (isAuthPage) {
      // It's a public page, no auth needed
      setIsAuthenticated(false);
      return;
    }

    // For protected pages, check token
    const token = getToken();
    if (!token) {
      console.log("🚫 ClientLayout: No token on protected page, redirecting");
      router.replace("/register?mode=signin&reason=auth_required");
      return;
    }

    setIsAuthenticated(true);
  }, [mounted, pathname, router]);

  // CRITICAL: Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div suppressHydrationWarning>
        {children}
      </div>
    );
  }

  const isAuthPage = isPublicRoute(pathname);

  return (
    <ErrorBoundary onError={(error, info) => {
      console.error('Application error:', error, info);
    }}>
      <>
        {/* Theme Switcher - Only show on protected pages */}
        {!isAuthPage && isAuthenticated && (
          <div className="fixed right-4 top-4 z-50">
            <ThemeSwitcher />
          </div>
        )}

        {/* Top Navigation */}
        {!isAuthPage && isAuthenticated && <Navigation />}

        {/* Budget Alerts */}
        {!isAuthPage && isAuthenticated && <BudgetAlerts />}

        {/* Page Content */}
        <main suppressHydrationWarning>{children}</main>

        {/* Bottom Mobile Navigation */}
        {!isAuthPage && isAuthenticated && <MobileBottomNav />}
      </>
    </ErrorBoundary>
  );
}