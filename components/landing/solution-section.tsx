"use client";

import { useState, useRef, useCallback } from "react";
import { Gavel, Shield, TrendingUp, Link2, Wallet, Lock } from 'lucide-react';

export function SolutionSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number>();

  // Throttle mouse move for better performance
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Store values before async callback
    const clientX = e.clientX;
    const clientY = e.clientY;
    const section = sectionRef.current;

    rafRef.current = requestAnimationFrame(() => {
      if (!section) return;

      const rect = section.getBoundingClientRect();
      setMousePosition({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    });
  }, []);

  return (
    <section 
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="relative bg-transparent py-24 px-6 overflow-hidden"
    >
      {/* Global Cyan Glow */}
      <div 
        className="absolute pointer-events-none transition-opacity duration-200"
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
          width: '600px',
          height: '600px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(10, 217, 220, 0.12), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div className="max-w-7xl mx-auto">
        {/* Headline */}
        <div className="mb-16 text-center">
          <h2 className="font-sans text-5xl font-bold text-black mb-4 tracking-tight">
            What is{' '}
            <span className="font-bold bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] bg-clip-text text-transparent">
              Walnut
            </span>
            ?
          </h2>
          <p className="text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A confidential lending protocol where your collateral, debt, and liquidation threshold stay encrypted on-chain — while a complete lending workflow still runs. Built on Fhenix CoFHE.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* BIG CARD - Sealed-Bid Liquidations (7 cols, 2 rows) */}
          <div
            className="col-span-7 row-span-2 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-8 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <Gavel className="w-8 h-8 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-base font-semibold text-black leading-tight">
                  Sealed-Bid Liquidations
                </h3>
              </div>
              <p className="text-[13px] text-gray-700 mb-4 leading-relaxed">
                Liquidators submit <span className="font-semibold">encrypted bids</span>. Walnut privately selects the lowest penalty using <span className="font-semibold">FHE computation</span> without revealing any bid publicly. Only the winning liquidator is revealed at settlement.
              </p>
              <p className="text-[13px] text-gray-700 mb-4 leading-relaxed">
                Borrowers receive the best available liquidation outcome while <span className="font-semibold">MEV bots see nothing</span>.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  FHE.select
                </span>
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  onlyCoFHE
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* MEDIUM CARD - Encrypted Health Factor (5 cols, 2 rows) */}
          <div
            className="col-span-5 row-span-2 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-8 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-8 h-8 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-base font-semibold text-black leading-tight">
                  Encrypted Health Factor
                </h3>
              </div>
              <p className="text-[13px] text-gray-700 mb-4 leading-relaxed">
                Health factor calculations run on <span className="font-semibold">encrypted collateral and debt</span> using <span className="font-semibold">FHE arithmetic</span>. Liquidation checks execute privately through <span className="font-semibold">CoFHE callbacks</span> without exposing user positions on-chain.
              </p>
              <p className="text-[13px] text-gray-700 mb-4 leading-relaxed">
                No plaintext values are stored or emitted.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  FHE.div
                </span>
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  FHE.requestDecrypt
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* THREE EQUAL CARDS (4 cols each) */}
          {/* Card 1 - Credit Scoring */}
          <div
            className="col-span-4 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-6 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-7 h-7 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-[15px] font-semibold text-black leading-tight">
                  Encrypted Credit Scoring
                </h3>
              </div>
              <p className="text-[11px] text-gray-700 mb-3 leading-relaxed">
                Repayment history stays encrypted while Walnut privately computes <span className="font-semibold">credit tiers and borrowing power</span>. Users prove reliability without exposing financial history.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  euint128
                </span>
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  Tiered LTV
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* Card 2 - P2P Terms */}
          <div
            className="col-span-4 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-6 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Link2 className="w-7 h-7 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-[15px] font-semibold text-black leading-tight">
                  P2P Encrypted Terms
                </h3>
              </div>
              <p className="text-[11px] text-gray-700 mb-3 leading-relaxed">
                Loan terms including <span className="font-semibold">APR, size, and duration</span> remain encrypted between lender and borrower. Third parties never see agreement details before or after settlement.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  FHE.allow
                </span>
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  Private APR
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* Card 3 - ENS Aggregation */}
          <div
            className="col-span-4 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-6 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="w-7 h-7 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-[15px] font-semibold text-black leading-tight">
                  ENS Wallet Aggregation
                </h3>
              </div>
              <p className="text-[11px] text-gray-700 mb-3 leading-relaxed">
                Aggregate collateral across multiple wallets under one <span className="font-semibold">ENS identity</span> without publicly linking addresses together.
              </p>
              <p className="text-[11px] text-gray-700 mb-3 leading-relaxed">
                Higher capital efficiency. <span className="font-semibold">Zero wallet exposure</span>.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  FHE.add
                </span>
                <span className="px-2 py-1 bg-black/5 border border-black/20 rounded-md text-[9px] font-mono text-black font-medium">
                  ENS
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* WIDE BOTTOM CARD - CoFHE Architecture (12 cols) */}
          <div
            className="col-span-12 relative group"
          >
            {/* Glass card with gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0AD9DC]/20 via-transparent to-[#0AD9DC]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-full bg-white/90 backdrop-blur-2xl rounded-2xl p-8 border-2 border-gray-200/80 shadow-xl shadow-black/10 transition-all duration-300 group-hover:border-[#0AD9DC]/50 group-hover:shadow-2xl group-hover:shadow-[#0AD9DC]/20">
              <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-8 h-8 text-black flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-sans text-base font-semibold text-black leading-tight">
                  Async CoFHE Callback Architecture
                </h3>
              </div>
              <p className="text-[13px] text-gray-700 mb-4 leading-relaxed">
                Sensitive protocol actions execute through <span className="font-semibold">CoFHE-gated callbacks</span> using encrypted computation and selective decryption. Plaintext values exist only during callback execution and are <span className="font-semibold">never stored on-chain</span>.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  FHE.requestDecrypt
                </span>
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  onlyCoFHE
                </span>
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  FHE.select
                </span>
                <span className="px-3 py-1.5 bg-black/5 border border-black/20 rounded-md text-[10px] font-mono text-black font-medium">
                  Permit ACL
                </span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
