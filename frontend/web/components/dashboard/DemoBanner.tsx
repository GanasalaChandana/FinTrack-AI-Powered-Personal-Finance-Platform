"use client";

import { useRouter } from "next/navigation";
import { Sparkles, X, LogIn } from "lucide-react";
import { removeToken } from "@/lib/api";

/**
 * DemoBanner — shown across the top of every app page while the user is
 * exploring the demo account.  It lives above the main layout so it's
 * always visible without scrolling.
 *
 * Shown when  localStorage.isDemo === "true".
 * Dismissed by clicking "Exit Demo" which clears all auth state and
 * redirects back to the landing page.
 */
export function DemoBanner() {
  const router = useRouter();

  function exitDemo() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isDemo");
    }
    removeToken();
    router.push("/");
  }

  function signUp() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isDemo");
    }
    removeToken();
    router.push("/login?mode=signup");
  }

  return (
    <div
      className="w-full z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium"
      style={{
        background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
        color: "white",
      }}
    >
      {/* Left: label */}
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#c4b5fd" }} />
        <span className="font-semibold tracking-wide" style={{ color: "#ede9fe" }}>
          DEMO MODE
        </span>
        <span className="hidden sm:inline" style={{ color: "rgba(255,255,255,0.7)" }}>
          — You're exploring a pre-filled demo account. Data resets on every demo login.
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={signUp}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all"
          style={{
            background: "rgba(255,255,255,0.9)",
            color: "#4f46e5",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "white")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.9)")}
        >
          <LogIn className="w-3.5 h-3.5" />
          Create free account
        </button>
        <button
          onClick={exitDemo}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.9)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
          title="Exit demo and return to landing page"
        >
          <X className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>
    </div>
  );
}

/** Returns true when the current session is a demo session. */
export function useIsDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isDemo") === "true";
}
