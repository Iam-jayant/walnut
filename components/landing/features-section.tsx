"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import MagicBento, { type BentoCardProps } from "@/components/landing/magic-bento";

const rails: BentoCardProps[] = [
  {
    label: "Private Collateral",
    title: "Your balances stay private",
    description: "Manage collateral without exposing your exact amounts publicly.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Private Debt",
    title: "No public debt trail",
    description: "Borrow and repay while keeping your position details private.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "MEV Resistance",
    title: "Reduced targeting risk",
    description: "Private position data helps reduce opportunistic attacks.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Access Control",
    title: "You stay in control",
    description: "Only you can unlock your own sensitive lending data.",
    color: "rgba(255, 255, 255, 0.05)",
  },
];

const trustCards: BentoCardProps[] = [
  {
    label: "Protection",
    title: "Private Positions",
    description: "Your lending activity is private by default.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Risk Surface",
    title: "Safer Risk Handling",
    description: "Position risk is managed with less public exposure.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Signals",
    title: "Private Credit Signals",
    description: "Your credit context can be evaluated without public profiling.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Built for Privacy",
    title: "Privacy-first architecture",
    description: "Walnut is designed from the ground up for confidential lending.",
    color: "rgba(255, 255, 255, 0.05)",
  },
];

const productCards: BentoCardProps[] = [...rails, ...trustCards];

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section id="product" className="relative overflow-hidden bg-black py-28 text-white lg:py-40">
      <div className="mx-auto w-full max-w-350 px-6 lg:px-12">
        <div className="mb-16 max-w-3xl">
          <div
            className={`mb-6 transition-all duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <span className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] text-black/70">
              <Sparkles className="h-3.5 w-3.5 text-black" />
              Privacy-First Design
            </span>
          </div>
          <h2
            className={`text-4xl leading-[1.18] font-display lg:text-5xl transition-all duration-700 delay-75 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            A lending surface that feels modern and keeps critical data dark.
          </h2>
        </div>

        <div
          className={`transition-all duration-700 delay-150 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <MagicBento
            cards={productCards}
            textAutoHide
            enableStars={false}
            enableSpotlight
            enableBorderGlow
            enableTilt
            enableMagnetism
            clickEffect
            spotlightRadius={520}
            particleCount={12}
            glowColor="255, 255, 255"
            disableAnimations={false}
          />
        </div>
      </div>
    </section>
  );
}
