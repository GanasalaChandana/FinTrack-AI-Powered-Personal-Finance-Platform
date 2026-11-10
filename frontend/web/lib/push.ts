/**
 * Web Push in the browser: turning notifications on and off for this device.
 * The service worker (public/sw.js) shows the notifications.
 */
import { apiRequest } from "@/lib/api";

export type PushSupport =
  | "supported"
  | "unsupported"     // old browser, or not https
  | "ios-needs-install"; // iPhone/iPad: only works from the Home Screen app

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !window.isSecureContext) {
    return "unsupported";
  }
  return "supported";
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // Registered by PWAProvider; register here too in case that hasn't happened yet
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** This device's subscription, if push is on here. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks for permission, subscribes this device and tells the server. */
export async function enablePush(): Promise<void> {
  if (pushSupport() !== "supported") throw new Error("This browser can't receive notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
      : "Notifications weren't allowed. If your browser shows \"Notifications blocked\" in the address bar, click it and choose Allow, then try again.");
  }
  const { publicKey } = await apiRequest<{ publicKey: string }>("/api/push/config");
  const key = keyBytes(publicKey);
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older server key can't receive anything: replace it
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await apiRequest("/api/push/subscriptions", { method: "POST", body: JSON.stringify(sub.toJSON()) });
}

/** Turns push off on this device. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await apiRequest("/api/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}

/** On sign-out: stop this device receiving the previous user's alerts (best effort, no server call). */
export function unsubscribeLocally(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistration("/")
    .then((reg) => reg?.pushManager.getSubscription())
    .then((sub) => sub?.unsubscribe())
    .catch(() => undefined);
}
