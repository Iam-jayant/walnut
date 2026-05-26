"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "pending";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastStyles(variant: ToastVariant) {
  if (variant === "success") {
    return {
      container: "border-emerald-500/20 bg-slate-900/90 text-slate-100 shadow-[0_8px_32px_rgba(16,185,129,0.12)]",
      iconColor: "text-emerald-400",
      Icon: CheckCircle2,
    };
  }
  if (variant === "error") {
    return {
      container: "border-red-500/20 bg-slate-900/90 text-slate-100 shadow-[0_8px_32px_rgba(239,68,68,0.12)]",
      iconColor: "text-red-400",
      Icon: AlertTriangle,
    };
  }
  return {
    container: "border-amber-500/20 bg-slate-900/90 text-slate-100 shadow-[0_8px_32px_rgba(245,158,11,0.12)]",
    iconColor: "text-amber-400",
    Icon: Loader2,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextToast = { ...toast, id };

      setToasts((current) => [nextToast, ...current].slice(0, 4));

      const durationMs =
        toast.durationMs ??
        (toast.variant === "success" ? 4500 : toast.variant === "pending" ? 7000 : 9000);

      if (durationMs > 0) {
        const timer = window.setTimeout(() => removeToast(id), durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-50 flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.variant);
          const ToastIcon = styles.Icon;

          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-xs shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in duration-300",
                styles.container
              )}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <ToastIcon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", styles.iconColor, toast.variant === "pending" && "animate-spin")} />
                <p className="leading-snug text-slate-200 font-medium break-words">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
