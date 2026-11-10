"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/utils/errors";
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/push";

/** Settings → Notifications: push notifications on this device. */
export function PushNotificationsCard({ notify }: { notify: (msg: string, type?: "success" | "error") => void }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"toggle" | "test" | null>(null);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === "supported") currentSubscription().then((sub) => setOn(!!sub)).catch(() => setOn(false));
    else setOn(false);
  }, []);

  const toggle = async () => {
    setBusy("toggle");
    try {
      if (on) {
        await disablePush();
        setOn(false);
        notify("Push notifications are off on this device");
      } else {
        await enablePush();
        setOn(true);
        notify("Push notifications are on for this device");
      }
    } catch (e) {
      notify(errorMessage(e) ?? "Couldn't change push notifications", "error");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await apiRequest<{ sent: number }>("/api/push/test", { method: "POST" });
      notify(r.sent > 0 ? `Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}` : "No devices received it. Try turning push off and on again.",
        r.sent > 0 ? "success" : "error");
    } catch (e) {
      notify(errorMessage(e) ?? "Couldn't send a test", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-3">
      <div className="flex items-center gap-2">
        {on ? <BellRing className="w-5 h-5 text-indigo-500" /> : <BellOff className="w-5 h-5 text-gray-400" />}
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Push notifications on this device</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Budget alerts and large-transaction warnings appear on this phone or computer, even when FinTrack isn&apos;t open.
        They follow the &ldquo;Budget alerts&rdquo; and &ldquo;Large transactions&rdquo; switches below. Turn it on separately on each device.
      </p>

      {support === "ios-needs-install" && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
          On iPhone and iPad, add FinTrack to your Home Screen first (Share → Add to Home Screen), then open it from there and turn this on.
        </p>
      )}
      {support === "unsupported" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">This browser doesn&apos;t support push notifications.</p>
      )}

      {support === "supported" && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => void toggle()} disabled={busy !== null || on === null} role="switch" aria-checked={!!on}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
              on ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600"
                 : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
            {busy === "toggle" && <Loader2 className="w-4 h-4 animate-spin" />}
            {on ? "Turn off on this device" : "Turn on for this device"}
          </button>
          {on && (
            <button onClick={() => void test()} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-60">
              {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send a test
            </button>
          )}
        </div>
      )}
    </div>
  );
}
