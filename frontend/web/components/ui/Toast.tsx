'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Check, X as XIcon, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number, action?: ToastItem['action']) => void;
    error: (message: string, duration?: number, action?: ToastItem['action']) => void;
    info: (message: string, duration?: number, action?: ToastItem['action']) => void;
    warning: (message: string, duration?: number, action?: ToastItem['action']) => void;
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (
      type: ToastType,
      message: string,
      duration = 4000,
      action?: ToastItem['action']
    ) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration, action }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: {
      success: (msg, dur, action) => addToast('success', msg, dur, action),
      error: (msg, dur, action) => addToast('error', msg, dur, action),
      info: (msg, dur, action) => addToast('info', msg, dur, action),
      warning: (msg, dur, action) => addToast('warning', msg, dur, action),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Toast Container ──────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
};

const TOAST_STYLES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    icon: string;
  }
> = {
  success: {
    bg: 'bg-success-50 dark:bg-success-900 dark:bg-opacity-20',
    border: 'border-success-200 dark:border-success-800',
    text: 'text-success-900 dark:text-success-200',
    icon: 'text-success-600 dark:text-success-400',
  },
  error: {
    bg: 'bg-error-50 dark:bg-error-900 dark:bg-opacity-20',
    border: 'border-error-200 dark:border-error-800',
    text: 'text-error-900 dark:text-error-200',
    icon: 'text-error-600 dark:text-error-400',
  },
  info: {
    bg: 'bg-primary-50 dark:bg-primary-900 dark:bg-opacity-20',
    border: 'border-primary-200 dark:border-primary-800',
    text: 'text-primary-900 dark:text-primary-200',
    icon: 'text-primary-600 dark:text-primary-400',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900 dark:bg-opacity-20',
    border: 'border-warning-200 dark:border-warning-800',
    text: 'text-warning-900 dark:text-warning-200',
    icon: 'text-warning-600 dark:text-warning-400',
  },
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        const icon = ICONS[toast.type];

        return (
          <div
            key={toast.id}
            className={`
              rounded-md border p-4
              ${style.bg} ${style.border} ${style.text}
              shadow-lg
              animate-slide-up
              pointer-events-auto
              flex items-start gap-3
            `}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={`flex-shrink-0 mt-0.5 ${style.icon}`}>{icon}</div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    onDismiss(toast.id);
                  }}
                  className="text-xs font-semibold mt-1 underline opacity-80 hover:opacity-100 transition-opacity"
                >
                  {toast.action.label}
                </button>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
