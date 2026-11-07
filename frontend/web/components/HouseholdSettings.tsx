"use client";

import { useCallback, useEffect, useState } from "react";
import { Home, Loader2, Mail, UserMinus, X, LogOut, Trash2, Crown } from "lucide-react";
import { apiRequest, getUser } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";
import { dateLocale } from "@/lib/userPrefs";

interface Member { userId: string; name: string | null; email: string; role: "OWNER" | "MEMBER" }
interface Invite { id: string; email: string; expiresAt: string }
export interface Household { id: string; name: string; youAreOwner: boolean; members: Member[]; invites: Invite[] }

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition";
const input = "w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500";

/** Settings → Household: share budgets with the people you live with. */
export function HouseholdSettings({ notify }: { notify: (msg: string, type?: "success" | "error") => void }) {
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const me = getUser()?.id;

  const load = useCallback(async () => {
    try {
      const h = await apiRequest<Household | null>("/api/households/me"); // 204 (no household) comes back as {}
      setHousehold(h?.id ? h : null);
    }
    catch { setHousehold(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); notify(ok); await load(); return true; }
    catch (e) { notify(errorMessage(e) ?? "Something went wrong", "error"); return false; }
    finally { setBusy(null); }
  };

  const create = () => run("create", () => apiRequest("/api/households", { method: "POST", body: JSON.stringify({ name: name.trim() || "Our household" }) }), "Household created");
  const invite = async () => {
    if (!email.trim()) return;
    if (await run("invite", () => apiRequest("/api/households/me/invites", { method: "POST", body: JSON.stringify({ email: email.trim() }) }), `Invitation sent to ${email.trim()}`)) setEmail("");
  };

  const card = "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6";
  const header = (
    <div className="flex items-center gap-2 mb-2">
      <Home className="w-5 h-5 text-indigo-500" />
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Household</h2>
    </div>
  );

  if (household === undefined) {
    return <div className={card}>{header}<div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div></div>;
  }

  if (household === null) {
    return (
      <div className={card}>
        {header}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Share budgets with a partner or family. Everyone&apos;s spending counts toward shared budgets, while each
          person&apos;s transactions stay private. To join someone else&apos;s household, open the invitation link they emailed you.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input className={`${input} flex-1 min-w-[12rem]`} placeholder="Household name, e.g. The Smiths" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Household name" />
          <button onClick={() => void create()} disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy === "create" && <Loader2 className="w-4 h-4 animate-spin" />} Create household
          </button>
        </div>
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });

  return (
    <div className={card}>
      {header}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <span className="font-semibold text-gray-800 dark:text-gray-100">{household.name}</span> · Turn on
        &ldquo;Share with household&rdquo; when creating or editing a budget. Transactions always stay private.
      </p>

      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Members</h3>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-4">
        {household.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
                {m.name || m.email}{m.userId === me && <span className="text-xs font-normal text-gray-400">(you)</span>}
                {m.role === "OWNER" && <Crown className="w-3.5 h-3.5 text-amber-500" aria-label="Owner" />}
              </p>
              {m.name && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</p>}
            </div>
            {household.youAreOwner && m.role !== "OWNER" && (
              <button disabled={busy !== null} className={`${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
                onClick={() => confirm(`Remove ${m.name || m.email} from the household? Budgets they shared become personal again.`)
                  && void run(m.userId, () => apiRequest(`/api/households/me/members/${m.userId}`, { method: "DELETE" }), "Member removed")}>
                <UserMinus className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {household.youAreOwner && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Invite someone</h3>
          <form className="flex gap-2 flex-wrap mb-3" onSubmit={(e) => { e.preventDefault(); void invite(); }}>
            <input type="email" required className={`${input} flex-1 min-w-[12rem]`} placeholder="their@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" />
            <button type="submit" disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy === "invite" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send invite
            </button>
          </form>
          {household.invites.length > 0 && (
            <ul className="mb-4 space-y-1">
              {household.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex-1 truncate">{i.email} <span className="text-xs text-gray-400">· pending, expires {fmtDate(i.expiresAt)}</span></span>
                  <button disabled={busy !== null} className={`${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700`}
                    onClick={() => void run(i.id, () => apiRequest(`/api/households/me/invites/${i.id}`, { method: "DELETE" }), "Invitation cancelled")}>
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
        {household.youAreOwner ? (
          <button disabled={busy !== null} className={`${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
            onClick={() => confirm("Delete the household? Shared budgets become personal budgets of whoever created them.")
              && void run("delete", () => apiRequest("/api/households/me", { method: "DELETE" }), "Household deleted")}>
            <Trash2 className="w-3.5 h-3.5" /> Delete household
          </button>
        ) : (
          <button disabled={busy !== null} className={`${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
            onClick={() => confirm("Leave the household? Budgets you shared become personal again.")
              && void run("leave", () => apiRequest("/api/households/me/leave", { method: "POST" }), "You left the household")}>
            <LogOut className="w-3.5 h-3.5" /> Leave household
          </button>
        )}
      </div>
    </div>
  );
}
