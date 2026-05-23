"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const WAVE_UPDATE_KEY = "walnut_wave3_update_seen";

export function WaveUpdateModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenUpdate = localStorage.getItem(WAVE_UPDATE_KEY);
    if (!hasSeenUpdate) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WAVE_UPDATE_KEY, "true");
    setIsOpen(false);
  };

  const handleRemindLater = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-black/10 bg-gradient-to-br from-white to-gray-50 px-6 py-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
              Advanced Features
            </span>
            <span className="text-xs text-muted-foreground">April 2026</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-medium text-foreground">Platform Update</span>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Walnut Protocol
          </h2>
          <p className="mt-1 text-lg text-muted-foreground">Production-Ready Private Lending</p>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {/* What's New Section */}
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-foreground">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                What's New in Advanced Features
              </h3>
            </div>

            <div className="space-y-4">
              {/* Feature 1 */}
              <div className="flex gap-3 rounded-lg border border-black/5 bg-white p-4 transition-colors hover:bg-gray-50/50">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 font-semibold text-foreground">Encrypted Credit Scoring System</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Dynamic LTV adjustments (70%-90%) based on encrypted repayment history across 5 credit tiers. 
                    All credit computations happen on encrypted data without exposing user behavior.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-3 rounded-lg border border-black/5 bg-white p-4 transition-colors hover:bg-gray-50/50">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 font-semibold text-foreground">Peer-to-Peer Private Lending</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Lenders post offers with encrypted APR, size, and tenor. Terms remain private until matched. 
                    Selective disclosure ensures only matched parties can view loan details.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-3 rounded-lg border border-black/5 bg-white p-4 transition-colors hover:bg-gray-50/50">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 font-semibold text-foreground">Privara Settlement Integration</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Privacy-preserving settlement layer for complex multi-party transactions. 
                    Enables private loan settlements without exposing transaction details on-chain.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-3 rounded-lg border border-black/5 bg-white p-4 transition-colors hover:bg-gray-50/50">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 font-semibold text-foreground">Production-Grade Infrastructure</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Migrated to CoFHE SDK v0.5.1 on Arbitrum Sepolia. Enhanced permit management, 
                    improved error handling, and optimized decryption flows for better UX.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Evolution from core lending */}
          <div className="rounded-lg border border-black/10 bg-gradient-to-br from-gray-50 to-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-foreground">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Evolution from Core Lending
              </h3>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Core lending established the complete private lending lifecycle with on-chain constraints, 
              sealed-bid auctions, and ENS multi-wallet support. Advanced features built on that foundation by adding:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-accent-foreground">→</span>
                <span>Encrypted credit scoring with dynamic risk-based LTV</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-accent-foreground">→</span>
                <span>P2P lending marketplace with selective disclosure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-accent-foreground">→</span>
                <span>Privara integration for private multi-party settlements</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-accent-foreground">→</span>
                <span>Production-ready SDK migration and infrastructure improvements</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/10 bg-gray-50/50 px-6 py-4">
          <button
            onClick={handleRemindLater}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Remind me later
          </button>
          <Button
            onClick={handleClose}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Got it, don't show again
          </Button>
        </div>
      </div>
    </div>
  );
}
