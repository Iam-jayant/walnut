"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

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

function variantClasses(variant: ToastVariant) {
  if (variant === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (variant === "error") return "border-red-200 bg-red-50 text-red-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
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
      <div className="fixed bottom-5 left-1/2 z-50 flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
              variantClasses(toast.variant)
            )}
          >
            <p className="leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-full p-1 text-current/70 transition hover:text-current"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
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
