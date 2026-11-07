"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { AuthCard, authInputCls, authButtonCls } from "@/components/auth/AuthCard";
import { authHeaders } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) { setError("Too many attempts. Please wait a minute and try again."); return; }
      if (!res.ok) { setError("Something went wrong. Please try again."); return; }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. It may be waking up — try again in a few seconds.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthCard title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <div className="text-center space-y-3" role="status">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-white font-semibold">Check your inbox</p>
          <p className="text-sm text-gray-400">
            If an account exists for <span className="text-gray-200">{email.trim()}</span>, a reset link is on its way.
            It works for 30 minutes. Check your spam folder if you don&apos;t see it.
          </p>
          <p className="text-xs text-gray-500">Signed up with Google? You can also just sign in with Google.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className={authInputCls} placeholder="you@example.com" disabled={sending} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={sending} className={authButtonCls}>
            {sending ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending…</span> : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
