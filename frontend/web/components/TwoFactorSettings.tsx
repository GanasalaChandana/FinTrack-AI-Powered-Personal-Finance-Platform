"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff, Loader2, Copy, Download, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";

interface Status { enabled: boolean; backupCodesLeft: number }
interface Setup { secret: string; otpauthUrl: string }

const input = "w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60";
const secondary = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";

/** Settings → Security: two-factor sign-in with an authenticator app. */
export function TwoFactorSettings({ notify }: { notify: (msg: string, type?: "success" | "error") => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "disable" | "regenerate">("idle");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await apiRequest<Status>("/api/users/me/2fa")); } catch { setStatus(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { notify(errorMessage(e) ?? "Something went wrong", "error"); } finally { setBusy(false); }
  };

  const start = () => act(async () => {
    const s = await apiRequest<Setup>("/api/users/me/2fa/setup", { method: "POST" });
    setSetup(s);
    setQr(await QRCode.toDataURL(s.otpauthUrl, { width: 200, margin: 1 }));
    setCode("");
  });

  const enable = () => act(async () => {
    const r = await apiRequest<{ backupCodes: string[] }>("/api/users/me/2fa/enable", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
    setBackupCodes(r.backupCodes);
    setSetup(null); setCode("");
    notify("Two-factor sign-in is on");
    await load();
  });

  const disable = () => act(async () => {
    await apiRequest("/api/users/me/2fa/disable", { method: "POST", body: JSON.stringify({ password, code: code.trim() }) });
    setMode("idle"); setPassword(""); setCode(""); setBackupCodes(null);
    notify("Two-factor sign-in is off");
    await load();
  });

  const regenerate = () => act(async () => {
    const r = await apiRequest<{ backupCodes: string[] }>("/api/users/me/2fa/backup-codes", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
    setBackupCodes(r.backupCodes);
    setMode("idle"); setCode("");
    notify("New backup codes created; the old ones no longer work");
    await load();
  });

  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(backupCodes!.join("\n")); notify("Backup codes copied"); }
    catch { notify("Couldn't copy; select the codes and copy them", "error"); }
  };
  const downloadCodes = () => {
    const blob = new Blob([`FinTrack backup codes\nEach code works once.\n\n${backupCodes!.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fintrack-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-center gap-2">
        {status?.enabled ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldOff className="w-5 h-5 text-gray-400" />}
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Two-factor sign-in</h2>
        {status?.enabled && <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">On</span>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        When signing in with your password, also enter a code from an authenticator app such as Google Authenticator,
        Microsoft Authenticator, Authy or 1Password. Someone who learns your password still can&apos;t get in.
      </p>

      {status === null && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

      {backupCodes && (
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Save your backup codes</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
            If you lose your phone, each of these lets you sign in once. They won&apos;t be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-gray-900 dark:text-gray-100 mb-3" aria-label="Backup codes">
            {backupCodes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <button className={secondary} onClick={() => void copyCodes()}><Copy className="w-3.5 h-3.5" /> Copy</button>
            <button className={secondary} onClick={downloadCodes}><Download className="w-3.5 h-3.5" /> Download</button>
            <button className={secondary} onClick={() => setBackupCodes(null)}>I&apos;ve saved them</button>
          </div>
        </div>
      )}

      {status && !status.enabled && !setup && (
        <button className={primary} disabled={busy} onClick={() => void start()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Set up two-factor sign-in
        </button>
      )}

      {setup && (
        <div className="space-y-4">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this QR code, or enter the key below by hand.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL */}
            {qr && <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg border border-gray-200 bg-white" />}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Setup key</p>
              <code className="block break-all rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" data-testid="totp-secret">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </div>
          </div>
          <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); void enable(); }}>
            <input className={`${input} max-w-[10rem] tracking-widest`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Code from the app" />
            <button type="submit" className={primary} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Turn on
            </button>
            <button type="button" className={secondary} onClick={() => { setSetup(null); setCode(""); }}>Cancel</button>
          </form>
        </div>
      )}

      {status?.enabled && mode === "idle" && (
        <div className="space-y-3">
          <p className={`text-sm ${status.backupCodesLeft <= 2 ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-300"}`}>
            {status.backupCodesLeft} backup code{status.backupCodesLeft === 1 ? "" : "s"} left.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button className={secondary} onClick={() => { setMode("regenerate"); setCode(""); }}><KeyRound className="w-3.5 h-3.5" /> New backup codes</button>
            <button className={`${secondary} text-red-600 dark:text-red-400`} onClick={() => { setMode("disable"); setCode(""); }}><ShieldOff className="w-3.5 h-3.5" /> Turn off</button>
          </div>
        </div>
      )}

      {status?.enabled && mode !== "idle" && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void (mode === "disable" ? disable() : regenerate()); }}>
          {mode === "disable" && (
            <input type="password" className={input} placeholder="Your password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Your password" />
          )}
          <input className={input} placeholder={mode === "disable" ? "Code from the app, or a backup code" : "Code from the app"}
            autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authentication code" />
          <div className="flex gap-2">
            <button type="submit" className={mode === "disable" ? primary.replace("indigo", "red").replace("indigo", "red") : primary} disabled={busy || !code.trim()}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mode === "disable" ? "Turn off two-factor" : "Create new codes"}
            </button>
            <button type="button" className={secondary} onClick={() => { setMode("idle"); setCode(""); setPassword(""); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
