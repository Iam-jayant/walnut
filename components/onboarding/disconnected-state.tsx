"use client";

import { Lock, Scale, Shield, ArrowRight } from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function DisconnectedState() {
  const { openConnectModal } = useConnectModal();
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>
      
      <div 
        className="relative z-10 w-full max-w-6xl"
        onMouseMove={handleMouseMove}
      >
        {/* Glass morphism container */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-white/40 via-white/20 to-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          {/* Cursor-sensitive spotlight effect */}
          <div 
            className="absolute inset-0 opacity-[0.15] pointer-events-none transition-all duration-300 rounded-3xl"
            style={{
              background: `radial-gradient(400px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(0, 0, 0, 0.4), transparent 40%)`
            }}
          />
          
          {/* Cyan accent glow in corner */}
          <div 
            className="absolute bottom-0 right-0 w-[300px] h-[300px] opacity-[0.90] pointer-events-none rounded-3xl"
            style={{
              background: 'radial-gradient(circle at center, rgba(10, 217, 220, 0.8), transparent 30%)',
              filter: 'blur(60px)',
            }}
          />
          
          {/* Inner glass card */}
          <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl p-8 lg:p-12 overflow-hidden border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="relative z-10 grid lg:grid-cols-[60fr_40fr] gap-8 lg:gap-12 items-center">
              {/* LEFT SIDE */}
              <div className="flex flex-col items-start space-y-2">
                {/* Logo */}
                <div className="flex items-center gap-3">
                  <img 
                    src="/walnut-logo.svg" 
                    alt="Walnut Protocol" 
                    className="h-[72px] w-auto object-contain"
                  />
                </div>

                {/* Headline */}
                <div className="space-y-1">
                  <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-black leading-tight">
                    Private lending,
                    <br />
                    finally.
                  </h1>
                  <p className="text-base text-black/70 max-w-lg leading-relaxed">
                    Deposit USDC. Borrow cUSDC. Your position is nobody's business but yours.
                  </p>
                </div>
                
                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white/90 hover:border-[#0AD9DC]/30 hover:bg-[#0AD9DC]/5 transition-all group">
                    <Lock className="w-3.5 h-3.5 text-black/70 group-hover:text-[#0AD9DC]" />
                    <span className="text-xs font-semibold text-black">Encrypted positions</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white/90 hover:border-[#0AD9DC]/30 hover:bg-[#0AD9DC]/5 transition-all group">
                    <Scale className="w-3.5 h-3.5 text-black/70 group-hover:text-[#0AD9DC]" />
                    <span className="text-xs font-semibold text-black">Sealed-bid liquidations</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white/90 hover:border-[#0AD9DC]/30 hover:bg-[#0AD9DC]/5 transition-all group">
                    <Shield className="w-3.5 h-3.5 text-black/70 group-hover:text-[#0AD9DC]" />
                    <span className="text-xs font-semibold text-black">Credit-based LTV</span>
                  </div>
                </div>

                {/* Connect Button */}
                <div className="w-full max-w-md space-y-3 pt-2">
                  <Button
                    onClick={openConnectModal}
                    className="group w-full h-12 text-base font-semibold bg-black text-white hover:bg-black/90 rounded-full shadow-lg hover:shadow-xl transition-all relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Connect Wallet
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-[#0AD9DC]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                  <p className="text-xs text-center text-black/60">
                    No account needed. Your wallet is your identity.
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE - Dashboard Preview */}
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="relative space-y-3 p-6 rounded-2xl bg-white/60 backdrop-blur-sm border border-black/10">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold text-black/80">Your private dashboard</p>
                      <div className="px-2 py-1 rounded-full bg-black/5 text-[10px] font-medium text-black/60">
                        Preview
                      </div>
                    </div>
                    
                    {/* Preview Cards Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Collateral Card */}
                      <div className="col-span-2 border border-black/10 rounded-xl bg-white/80 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0AD9DC]" />
                          <div className="text-[10px] font-mono uppercase tracking-wider text-black/60">
                            Collateral
                          </div>
                        </div>
                        <div className="font-mono text-2xl font-bold text-black/30">
                          $••••
                        </div>
                      </div>

                      {/* Debt Card */}
                      <div className="border border-black/10 rounded-xl bg-white/80 p-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-black/60 mb-2">
                          Debt
                        </div>
                        <div className="font-mono text-lg font-bold text-black/30">
                          $••••
                        </div>
                      </div>

                      {/* Health Card */}
                      <div className="border border-black/10 rounded-xl bg-white/80 p-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-black/60 mb-2">
                          Health
                        </div>
                        <div className="font-mono text-lg font-bold text-black/30">
                          ∞
                        </div>
                      </div>

                      {/* Credit Tier Card */}
                      <div className="col-span-2 border border-black/10 rounded-xl bg-white/80 p-3">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-black/60 mb-2">
                          Credit Tier
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-lg font-bold text-black/30">
                            Tier ••
                          </div>
                          <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-black/20 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
