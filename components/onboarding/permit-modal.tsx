"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PermitModalProps {
  onCreatePermit: () => void;
  onSkip: () => void;
  isCreating: boolean;
}

export function PermitModal({ onCreatePermit, onSkip, isCreating }: PermitModalProps) {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div 
        className="relative w-full max-w-lg mx-4"
        onMouseMove={handleMouseMove}
      >
        {/* Glass morphism container */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-white/40 via-white/20 to-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          {/* Cursor-sensitive spotlight effect */}
          <div 
            className="absolute inset-0 opacity-[0.15] pointer-events-none transition-all duration-300 rounded-3xl"
            style={{
              background: `radial-gradient(300px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(0, 0, 0, 0.4), transparent 40%)`
            }}
          />
          
          {/* Cyan accent glow in corner */}
          <div 
            className="absolute top-0 right-0 w-[200px] h-[200px] opacity-[0.15] pointer-events-none rounded-3xl"
            style={{
              background: 'radial-gradient(circle at center, rgba(10, 217, 220, 0.8), transparent 60%)',
              filter: 'blur(50px)',
            }}
          />
          
          {/* Inner glass card */}
          <div className="relative rounded-3xl bg-white/90 backdrop-blur-xl p-8 overflow-hidden border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="relative z-10 space-y-6">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full border border-black/10 bg-white flex items-center justify-center">
                  <Lock className="w-7 h-7 text-black" />
                </div>
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-black">One more step</h2>
              </div>

              {/* Explanation */}
              <div className="space-y-4 text-sm text-black/70 leading-relaxed">
                <p>
                  Walnut encrypts your position so only you can read it. To do that, we need you to sign a message — your <strong className="text-black">"private access key."</strong>
                </p>
                <p>
                  This never leaves your browser. It is never sent to any server. Without it, your balance is unreadable — even to us.
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-black/10" />

              {/* What you'll sign */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-black">What you'll sign:</p>
                <ul className="space-y-2 text-sm text-black/70">
                  <li className="flex items-start gap-2">
                    <span className="text-[#0AD9DC] font-bold">•</span>
                    <span>A message (not a transaction)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0AD9DC] font-bold">•</span>
                    <span>No gas fee</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0AD9DC] font-bold">•</span>
                    <span>Takes 2 seconds</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={onCreatePermit}
                  disabled={isCreating}
                  className="group w-full h-12 text-base font-semibold bg-black text-white hover:bg-black/90 rounded-full shadow-lg hover:shadow-xl transition-all relative overflow-hidden disabled:opacity-50"
                >
                  <span className="relative z-10">
                    {isCreating ? "Creating..." : "Create my private access key"}
                  </span>
                  <div className="absolute inset-0 bg-[#0AD9DC]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
                <button
                  onClick={onSkip}
                  disabled={isCreating}
                  className="w-full text-sm text-black/60 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip for now — view public data only
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
