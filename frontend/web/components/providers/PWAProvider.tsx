"use client";

// PWAProvider — registers the service worker and exposes install-prompt state
// Wrap this around the app in layout.tsx (client boundary)

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface PWAContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue>({
  isInstallable: false,
  isInstalled: false,
  promptInstall: async () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled]       = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            console.log("[SW] registered, scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[SW] registration failed:", err);
          });
      });
    }

    // Detect already-installed (standalone mode)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return (
    <PWAContext.Provider
      value={{
        isInstallable: !!deferredPrompt && !isInstalled,
        isInstalled,
        promptInstall,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
