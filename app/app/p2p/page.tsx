"use client";

import { Users, Clock, ShieldCheck, HelpCircle } from "lucide-react";

export default function P2PPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-slate-700" />
          Private P2P Marketplace
        </h1>
        <p className="text-sm text-muted-foreground">
          Encrypted peer-to-peer loan matching and secure FHE-based settlements.
        </p>
      </header>

      <div className="border border-slate-200 rounded-2xl bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-sm">
        <div className="max-w-2xl mx-auto text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 border border-slate-200 mb-6">
            <Clock className="w-8 h-8 text-slate-600 animate-pulse" />
          </div>
          
          <h2 className="font-sans text-2xl font-bold text-slate-900 mb-3">
            P2P Lending Coming Soon
          </h2>
          
          <p className="text-sm text-slate-600 mb-8 max-w-lg mx-auto leading-relaxed">
            The Private peer-to-peer marketplace is currently under development. To prevent front-running yield strategies, loan terms will be fully encrypted on-chain.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Encrypted Listings</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Lenders post offers by encrypting APR, loan size, and tenor. Terms are stored as ciphertexts.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Enclave-Based Settle</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Privara coordinator verifies FHE inputs privately, decrypts terms under secure enclave, and settles.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-800 font-bold text-xs mb-3 font-mono">
                3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Strategy Privacy</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Lender yield and interest strategies remain confidential on-chain, preventing duplication.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
        <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-slate-400" /> How P2P Lending Works
        </h3>
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div>
            <p className="font-semibold text-slate-900">1. Lender Posts Offer</p>
            <p className="mt-0.5">Lender encrypts APR, loan size, and tenor. Offer is posted on-chain with all terms fully hidden from block explorers.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">2. Borrower Matches</p>
            <p className="mt-0.5">Borrowers browse the encrypted list. When they click Match, the on-chain loan matching registry is triggered.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">3. Privara Settlement</p>
            <p className="mt-0.5">The Privara interest settlement agent decodes inputs privately, triggers the transfer, and finishes the settlement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
