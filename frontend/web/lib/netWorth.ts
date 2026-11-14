/**
 * Net worth = what you own minus what you owe, from two places:
 *  - items entered by hand on the Net Worth page (saved to the account as "fintrack-net-worth")
 *  - connected accounts and investments, which update themselves (/api/net-worth/linked)
 */
import { apiRequest } from "@/lib/api";

export interface LinkedAccount { name: string; mask?: string | null; type: string; subtype?: string | null; balance: number; liability: boolean }
export interface LinkedNetWorth { accounts: LinkedAccount[]; investments: number; assets: number; liabilities: number }

export const EMPTY_LINKED: LinkedNetWorth = { accounts: [], investments: 0, assets: 0, liabilities: 0 };

export async function fetchLinkedNetWorth(): Promise<LinkedNetWorth> {
  try {
    const r = await apiRequest<LinkedNetWorth>("/api/net-worth/linked");
    return {
      accounts: Array.isArray(r?.accounts) ? r.accounts.map((a) => ({ ...a, balance: Number(a.balance) || 0 })) : [],
      investments: Number(r?.investments) || 0,
      assets: Number(r?.assets) || 0,
      liabilities: Number(r?.liabilities) || 0,
    };
  } catch {
    return EMPTY_LINKED;
  }
}

/** Hand-entered totals, or null when nothing has been entered. */
export function manualNetWorth(): { assets: number; liabilities: number } | null {
  try {
    const d = JSON.parse(localStorage.getItem("fintrack-net-worth") ?? "null") as
      { assets?: { value: number }[]; liabilities?: { value: number }[] } | null;
    const a = d?.assets ?? [], l = d?.liabilities ?? [];
    if (!a.length && !l.length) return null;
    return {
      assets: a.reduce((s, x) => s + (Number(x.value) || 0), 0),
      liabilities: l.reduce((s, x) => s + (Number(x.value) || 0), 0),
    };
  } catch {
    return null;
  }
}

/** Whether anything at all counts towards net worth yet. */
export function hasLinked(l: LinkedNetWorth): boolean {
  return l.accounts.length > 0 || l.investments > 0;
}
