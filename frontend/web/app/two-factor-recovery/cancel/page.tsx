"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { AuthCard, authButtonCls } from "@/components/auth/AuthCard";
import { authHeaders } from "@/lib/api";

/** From the "two-factor will be turned off" email: cancels the request. */
function CancelRecovery() {
  const token = useSearchParams()?.get("token") ?? "";
  const [state, setState] = useState<{ status: "working" | "done" | "error"; text?: string }>({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) { setState({ status: "error", text: "This link is incomplete. Use the link from the email." }); return; }
    fetch("/api/auth/two-factor-recovery/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        setState(r.ok ? { status: "done" } : { status: "error", text: d.message || "Couldn't cancel. Please try again." });
      })
      .catch(() => setState({ status: "error", text: "Couldn't reach the server. It may be waking up; reload in a few seconds." }));
  }, [token]);

  if (state.status === "working") {
    return <p className="flex items-center justify-center gap-2 text-gray-300"><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</p>;
  }
  if (state.status === "done") {
    return (
      <div className="text-center space-y-4" role="status">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
        <p className="text-white font-semibold">Cancelled: two-factor sign-in stays on</p>
        <p className="text-sm text-gray-400">
          If you didn&apos;t ask for this, someone knows your password. Change it now using &ldquo;Forgot password?&rdquo; on the sign-in page.
        </p>
        <Link href="/forgot-password" className={`${authButtonCls} inline-block`}>Change my password</Link>
      </div>
    );
  }
  return (
    <div className="text-center space-y-4" role="alert">
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
      <p className="text-gray-300">{state.text}</p>
      <Link href="/login?mode=signin" className={`${authButtonCls} inline-block`}>Go to sign in</Link>
    </div>
  );
}

export default function CancelRecoveryPage() {
  return (
    <AuthCard title="Two-factor sign-in" subtitle="Cancel the request to turn it off">
      <Suspense fallback={null}><CancelRecovery /></Suspense>
    </AuthCard>
  );
}
