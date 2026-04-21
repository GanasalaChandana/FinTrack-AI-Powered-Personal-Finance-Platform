"use client";

// PWAInstallBanner — slide-up banner asking the user to install the app
// Shows only when `beforeinstallprompt` fires (Chrome/Edge desktop + Android).
// On iOS it shows a manual "Add to Home Screen" tip instead.

import { useState, useEffect } from "react";
import { X, Download, Smartphone, Share } from "lucide-react";
import { usePWA } from "@/components/providers/PWAProvider";

const DISMISSED_KEY = "fintrack-pwa-banner-dismissed";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [dismissed, setDismissed]   = useState(true); // start hidden — hydrate below
  const [isIOS, setIsIOS]           = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [visible, setVisible]       = useState(false);

  useEffect(() => {
    // Detect iOS (Safari doesn't fire beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    const inStandalone = (window.navigator as any).standalone === true;
    setIsIOS(ios);

    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
    setDismissed(wasDismissed);

    // Show iOS tip if on iOS, not installed, not dismissed, and user hasn't seen it
    if (ios && !inStandalone && !wasDismissed) {
      const timer = setTimeout(() => setShowIOSTip(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Show banner with slight delay when installable
  useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isInstallable, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setShowIOSTip(false);
    setDismissed(true);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleInstall = async () => {
    await promptInstall();
    setVisible(false);
  };

  // Nothing to show
  if (isInstalled) return null;

  // ── iOS tip ────────────────────────────────────────────────────────────────
  if (isIOS && showIOSTip) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          width: "min(360px, calc(100vw - 32px))",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          border: "1px solid #e2e8f0",
          padding: "16px",
          animation: "slideUp 0.3s ease",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity:0 } to { transform: translateX(-50%) translateY(0); opacity:1 } }`}</style>
        <button
          onClick={handleDismiss}
          style={{ position: "absolute", top: "10px", right: "10px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
        >
          <X size={16} />
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ width: 40, height: 40, borderRadius: "10px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Smartphone size={20} color="white" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b", margin: "0 0 4px" }}>Install FinTrack</p>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px", lineHeight: "1.4" }}>
              Tap <Share size={12} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Chrome/Edge install banner ─────────────────────────────────────────────
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "min(420px, calc(100vw - 32px))",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(79,70,229,0.18)",
        border: "1px solid #e0e7ff",
        padding: "16px 20px",
        animation: "slideUp 0.3s ease",
      }}
    >
      <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity:0 } to { transform: translateX(-50%) translateY(0); opacity:1 } }`}</style>

      <button
        onClick={handleDismiss}
        style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px" }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* App icon */}
        <div style={{ width: 48, height: 48, borderRadius: "12px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {/* Mini bar chart */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="3" y="16" width="5" height="9" rx="1" fill="white" opacity="0.85"/>
            <rect x="11" y="11" width="5" height="14" rx="1" fill="white"/>
            <rect x="19" y="7" width="5" height="18" rx="1" fill="white" opacity="0.85"/>
            <polyline points="5.5,13 13.5,8 21.5,4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b", margin: "0 0 2px" }}>Install FinTrack</p>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            Add to your home screen for quick access
          </p>
        </div>

        <button
          onClick={handleInstall}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Download size={14} />
          Install
        </button>
      </div>
    </div>
  );
}
