"use client";

import { CheckCircle2, Loader2, AlertCircle, ExternalLink, ShieldCheck, Lock, Cpu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TransactionStage = "zk_encrypt" | "wallet_sign" | "mining" | "threshold_sync" | "completed" | "failed";

export interface StepItem {
  id: string;
  label: string;
  description: string;
}

interface TransactionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: TransactionStage;
  currentStepIndex: number;
  steps: StepItem[];
  txHash?: string | null;
  errorMessage?: string | null;
  title?: string;
}

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function TransactionProgressModal({
  isOpen,
  onClose,
  stage,
  currentStepIndex,
  steps,
  txHash,
  errorMessage,
  title = "Processing Privacy Transaction",
}: TransactionProgressModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-900 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 font-medium">Fully Encrypted End-to-End Execution</p>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-4 mb-6">
          {steps.map((step, idx) => {
            const isDone = idx < currentStepIndex || stage === "completed";
            const isCurrent = idx === currentStepIndex && stage !== "completed" && stage !== "failed";
            const isFailed = stage === "failed" && idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-4 p-3.5 rounded-2xl border transition-all",
                  isDone && "bg-slate-50 border-slate-200 text-slate-900",
                  isCurrent && "bg-white border-black text-black shadow-sm",
                  isFailed && "bg-rose-50 border-rose-200 text-rose-900",
                  !isDone && !isCurrent && !isFailed && "bg-slate-50 border-slate-100 text-slate-400 opacity-60"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone && (
                    <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                  )}
                  {isCurrent && (
                    <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {isFailed && (
                    <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                  )}
                  {!isDone && !isCurrent && !isFailed && (
                    <div className="w-7 h-7 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={cn("text-sm font-semibold", isDone && "text-slate-900", isCurrent && "text-black", isFailed && "text-rose-900")}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-black bg-slate-100 px-2 py-0.5 rounded-full border border-black/10">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs leading-relaxed mt-0.5", isDone ? "text-slate-600" : isCurrent ? "text-slate-700" : isFailed ? "text-rose-700" : "text-slate-400")}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Message Box */}
        {stage === "failed" && errorMessage && (
          <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 text-rose-900 mb-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> Action Required / Revert Reason
            </p>
            {errorMessage}
          </div>
        )}

        {/* Tx Hash Link */}
        {txHash && (
          <div className="mb-6 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Transaction Hash:</span>
            <a
              href={`https://sepolia.arbiscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono font-semibold text-black hover:text-slate-700 underline"
            >
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end gap-3">
          {stage === "completed" ? (
            <Button
              onClick={onClose}
              className="w-full bg-black hover:bg-black/90 text-white font-semibold rounded-2xl py-2.5 shadow-none"
            >
              Done & Continue
            </Button>
          ) : stage === "failed" ? (
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-2xl py-2.5 shadow-none"
            >
              Close & Retry
            </Button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-500">
              <Lock className="w-3.5 h-3.5 text-black" />
              Do not close window while transaction executes
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
