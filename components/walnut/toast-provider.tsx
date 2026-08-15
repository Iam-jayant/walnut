"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "pending";

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  txHash?: string | null;
  durationMs?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  formatUserFriendlyError: (error: any) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function formatUserFriendlyError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  const errString = typeof error === "string" ? error : error.message || error.reason || JSON.stringify(error);

  if (errString.includes("Unregistered vault token")) {
    return "Invalid token parameter: Please use the registered wUSDC vault token for deposit and withdrawal.";
  }
  if (errString.includes("Offer not open")) {
    return "This P2P offer is no longer open or has already been matched by another counterparty.";
  }
  if (errString.includes("Only owner")) {
    return "Access Denied: This operation is restricted to the contract owner.";
  }
  if (errString.includes("user rejected") || errString.includes("User denied")) {
    return "Transaction cancelled by user in wallet.";
  }
  if (errString.includes("insufficient funds") || errString.includes("exceeds balance")) {
    return "Insufficient gas fees or token balance to perform this transaction.";
  }
  if (errString.includes("ZK proof") || errString.includes("ZK_VERIFY_FAILED")) {
    return "CoFHE ZK proof generation failed. The encryption network may be busy. Please try again.";
  }
  if (errString.includes("permit_invalid") || errString.includes("Unauthorized")) {
    return "CoFHE access key / permit expired or invalid. Please re-sign your self-permit.";
  }
  if (errString.includes("homomorphically")) {
    return "Homomorphic position check prevented this action to maintain healthy collateral ratios.";
  }

  // Extract short clean error string if possible
  const reasonMatch = errString.match(/execution reverted:? (.*?)(?:"|$|\n)/i);
  if (reasonMatch && reasonMatch[1]) {
    return `Transaction Reverted: ${reasonMatch[1].trim()}`;
  }

  return errString.length > 140 ? `${errString.slice(0, 140)}...` : errString;
}

function getToastStyles(variant: ToastVariant) {
  if (variant === "success") {
    return {
      container: "bg-[#F1FBF7] border border-[#E5F6EE]",
      iconBg: "bg-white",
      iconStyle: "fill-[#34D399] text-white",
      Icon: CheckCircle2,
      defaultTitle: "Transaction Successful",
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
    defaultTitle: "Processing Transaction",
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
      const userFriendlyMessage = toast.variant === "error" ? formatUserFriendlyError(toast.message) : toast.message;
      const nextToast = { ...toast, message: userFriendlyMessage, id };

      setToasts((current) => [nextToast, ...current].slice(0, 4));

      const durationMs =
        toast.durationMs ??
        (toast.variant === "success" ? 5500 : toast.variant === "pending" ? 8000 : 10000);

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

  const value = useMemo(
    () => ({ addToast, removeToast, formatUserFriendlyError }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-[10vh] right-6 z-[100] flex w-[min(460px,calc(100vw-2rem))] flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.variant);
          const ToastIcon = styles.Icon;

          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "relative flex w-full items-start gap-3.5 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto",
                styles.container
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <ToastIcon className={cn("h-5 w-5", styles.iconStyle, toast.variant === "pending" && "animate-spin")} />
              </div>

              <div className="flex flex-col gap-1 pr-6 pt-0.5 text-left flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {toast.title || styles.defaultTitle}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 font-medium break-words">
                  {toast.message}
                </p>
                {toast.txHash && (
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${toast.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 underline"
                  >
                    View on Arbiscan ({toast.txHash.slice(0, 6)}...{toast.txHash.slice(-4)})
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="absolute right-3.5 top-3.5 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 transition"
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
