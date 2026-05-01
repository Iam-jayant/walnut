"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "pending";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
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

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nextToast = { ...toast, id };

      setToasts((current) => [nextToast, ...current].slice(0, 4));

      if (toast.variant === "success") {
        window.setTimeout(() => removeToast(id), 3000);
      }

      return id;
    },
    [removeToast]
  );

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex w-[min(360px,90vw)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg",
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
