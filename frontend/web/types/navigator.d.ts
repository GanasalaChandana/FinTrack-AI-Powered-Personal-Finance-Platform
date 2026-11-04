// Non-standard browser APIs the PWA code feature-detects
interface Navigator {
  /** iOS Safari: true when launched from the home screen */
  standalone?: boolean;
}

interface Window {
  /** Old IE/Edge marker used to tell real iOS apart from IE's fake UA */
  MSStream?: unknown;
}

/** Chrome's install prompt event (not in the DOM lib) */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
