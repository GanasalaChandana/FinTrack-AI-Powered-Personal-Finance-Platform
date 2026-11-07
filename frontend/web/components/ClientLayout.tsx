// frontend/web/components/ClientLayout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated as hasSession } from "@/lib/api";

import Navigation from "@/components/Navigation";
import { BudgetAlerts } from "@/components/BudgetAlerts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isPublicPath } from "@/lib/publicRoutes";

/**
 * Helper to check if route is public/auth
 */
function isPublicRoute(path: string | null): boolean {
  if (!path) return true;

  return isPublicPath(path);
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
    const token = hasSession();
    if (!token) {
      // Sign in, then come back here (e.g. a household invite link)
      const here = pathname && pathname !== "/" ? `&next=${encodeURIComponent(pathname + window.location.search)}` : "";
      router.replace(`/login?mode=signin&reason=auth_required${here}`);
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
        {/* Left Sidebar Navigation */}
        {!isAuthPage && isAuthenticated && <Navigation />}

        {/* Budget Alerts */}
        {!isAuthPage && isAuthenticated && <BudgetAlerts />}

        {/* Page Content — offset right of sidebar on desktop, top on mobile */}
        <main
          suppressHydrationWarning
          // Sidebar offset only from lg up (the sidebar is a drawer below that)
          className={!isAuthPage && isAuthenticated ? 'pt-14 lg:pt-0 lg:pl-[var(--sidebar-w,15rem)] transition-[padding-left] duration-300' : ''}
        >
          {children}
        </main>

        {/* Mobile nav is handled by the hamburger drawer inside Navigation */}
      </>
    </ErrorBoundary>
  );
}