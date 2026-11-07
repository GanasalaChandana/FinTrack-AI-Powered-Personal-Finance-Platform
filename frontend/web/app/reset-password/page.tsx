"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { AuthCard, authInputCls, authButtonCls } from "@/components/auth/AuthCard";
import { authHeaders, removeToken } from "@/lib/api";

function ResetPasswordForm() {
  const token = useSearchParams()?.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-300">This reset link is incomplete. Please use the link from the email, or request a new one.</p>
        <Link href="/forgot-password" className={`${authButtonCls} inline-block`}>Request a new link</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message || "Couldn't reset the password. Please try again."); return; }
      removeToken(); // every session was signed out, this browser's too
      setDone(true);
    } catch {
      setError("Couldn't reach the server. It may be waking up — try again in a few seconds.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="text-center space-y-4" role="status">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
        <p className="text-white font-semibold">Password changed</p>
        <p className="text-sm text-gray-400">You&apos;ve been signed out everywhere. Sign in with your new password.</p>
        <Link href="/login?mode=signin" className={`${authButtonCls} inline-block`}>Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {[
        { id: "password", label: "New password", value: password, set: setPassword, auto: "new-password" },
        { id: "confirm", label: "Confirm new password", value: confirm, set: setConfirm, auto: "new-password" },
      ].map((f) => (
        <div key={f.id}>
          <label htmlFor={f.id} className="block text-sm font-medium text-gray-300 mb-2">{f.label}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input id={f.id} type={show ? "text" : "password"} autoComplete={f.auto} value={f.value}
              onChange={(e) => f.set(e.target.value)} className={authInputCls} placeholder="At least 8 characters" disabled={saving} />
            {f.id === "password" && (
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      ))}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}{error.includes("expired") && <> <Link href="/forgot-password" className="underline">Request a new link</Link>.</>}
        </p>
      )}
      <button type="submit" disabled={saving} className={authButtonCls}>
        {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span> : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
