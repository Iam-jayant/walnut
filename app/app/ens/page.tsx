"use client";

import { Wallet, Clock, ShieldCheck, HelpCircle } from "lucide-react";

export default function ENSPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-slate-700" />
          Private Wallet Aggregation
        </h1>
        <p className="text-sm text-muted-foreground">
          Consolidate borrow capacity across multiple wallets with FHE privacy.
        </p>
      </header>

      <div className="border border-slate-200 rounded-2xl bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-sm">
        <div className="max-w-2xl mx-auto text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 border border-slate-200 mb-6">
            <Clock className="w-8 h-8 text-slate-600 animate-pulse" />
          </div>
          
          <h2 className="font-sans text-2xl font-bold text-slate-900 mb-3">
            Wallet Aggregation Coming Soon
          </h2>
          
          <p className="text-sm text-slate-600 mb-8 max-w-lg mx-auto leading-relaxed">
            Private wallet aggregation is currently under development. You will soon be able to factor secondary wallet balances into your primary borrow capacity securely.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">EIP-712 Verification</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Authorize connections using standard typed signatures. Proves wallet control without exposing keys.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Homomorphic Summing</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Balances are added on-chain inside the FHE shield. Observers cannot see individual or total balances.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Capital Efficiency</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Enjoy elevated borrow limits across all assets while keeping them separated in independent wallets.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
        <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-slate-400" /> How Aggregation Works
        </h3>
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div>
            <p className="font-semibold text-slate-900">1. Link Owned Wallets</p>
            <p className="mt-0.5">Register secondary owned wallets. Each wallet continues to privately hold its independent collateral positions on-chain.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">2. Cryptographic Summing</p>
            <p className="mt-0.5">We invoke on-chain `FHE.add` calculations. The system sums the encrypted balances inside a secure ciphertext without exposing any plaintext numbers.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">3. Elevated Borrow Capacity</p>
            <p className="mt-0.5">Your borrow capacity increases based on the aggregated sum. You enjoy maximum capital efficiency without consolidating assets into a single hot wallet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
