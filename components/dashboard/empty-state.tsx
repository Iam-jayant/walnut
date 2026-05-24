"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyStateOnboarding() {
  return (
    <div className="border border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-sm">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        
        <h2 className="font-display text-2xl font-semibold text-slate-900 mb-3">
          Welcome to Walnut Protocol
        </h2>
        
        <p className="text-slate-600 mb-8 max-w-lg mx-auto">
          Get started with confidential lending in three simple steps. Your financial data stays encrypted on-chain.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Approve USDC</h3>
            <p className="text-sm text-slate-600">
              Grant the protocol permission to access your USDC tokens for deposits.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Deposit Collateral</h3>
            <p className="text-sm text-slate-600">
              Deposit USDC as collateral. Your balance is encrypted and private.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Borrow cUSDC</h3>
            <p className="text-sm text-slate-600">
              Borrow confidential USDC against your collateral with encrypted debt tracking.
            </p>
          </div>
        </div>

        <Link href="/app/deposit">
          <Button 
            size="lg"
            className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Get Started - Deposit Collateral
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>

        <p className="text-xs text-slate-500 mt-6">
          New to FHE? Learn more about{" "}
          <Link href="/privacy" className="text-slate-700 hover:text-slate-900 underline">
            how encryption works
          </Link>
        </p>
      </div>
    </div>
  );
}
