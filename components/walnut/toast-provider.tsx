"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "pending";

type ToastItem = {
  id: string;
  title?: string;
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
      container: "bg-[#F1FBF7] border border-[#E5F6EE]",
      iconBg: "bg-white",
      iconStyle: "fill-[#34D399] text-white",
      Icon: CheckCircle2,
      defaultTitle: "Payment Successful",
    };
  }
  if (variant === "error") {
    return {
      container: "bg-[#FEF1F2] border border-[#FDE3E5]",
      iconBg: "bg-white",
      iconStyle: "fill-[#F87171] text-white",
      Icon: AlertCircle,
      defaultTitle: "Action Failed",
    };
  }
  // pending
  return {
    container: "bg-[#F0F8FF] border border-[#E1F0FA]",
    iconBg: "bg-white",
    iconStyle: "text-[#60A5FA]",
    Icon: Loader2,
    defaultTitle: "Processing",
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
      <div className="fixed bottom-[15vh] left-1/2 z-[100] flex w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-4 pointer-events-none">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.variant);
          const ToastIcon = styles.Icon;

          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "relative flex w-full items-start gap-4 rounded-[20px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all animate-in slide-in-from-bottom-6 fade-in duration-300 pointer-events-auto",
                styles.container
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <ToastIcon className={cn("h-6 w-6", styles.iconStyle, toast.variant === "pending" && "animate-spin")} />
              </div>
              
              <div className="flex flex-col gap-1 pr-6 pt-0.5 text-left">
                <h3 className="text-[15px] font-semibold text-slate-900">
                  {toast.title || (toast.variant === "success" && toast.message.toLowerCase().includes("payment") ? "Payment Successful" : styles.defaultTitle)}
                </h3>
                <p className="text-[14px] leading-relaxed text-slate-500">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 transition"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
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
