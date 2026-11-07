import Link from "next/link";
import { Wallet } from "lucide-react";

/** The dark card the sign-in pages share. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0f172a 0%, #4a1d96 50%, #0f172a 100%)" }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-white font-bold text-xl mb-4">
            <Wallet className="w-6 h-6 text-purple-400" /> FinTrack
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          {subtitle && <p className="text-gray-400">{subtitle}</p>}
        </div>
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 p-8">
          {children}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">
          <Link href="/login?mode=signin" className="text-purple-400 hover:text-purple-300 font-medium">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export const authInputCls =
  "w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-purple-500/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white placeholder-gray-500";
export const authButtonCls =
  "w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 transition";
