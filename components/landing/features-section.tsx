"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import MagicBento, { type BentoCardProps } from "@/components/landing/magic-bento";

const rails: BentoCardProps[] = [
  {
    label: "Silent Collateral",
    title: "Encrypted in-browser",
    description: "Amounts are sealed before tx submission. Public observers only see opaque handles.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Private Debt",
    title: "No open debt table",
    description: "Debt movement is computed on encrypted values to prevent position leakage.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "MEV Resistance",
    title: "No visible liquidation bait",
    description: "Sensitive lending state is hidden, reducing sniping opportunities.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Permit Control",
    title: "User-side decrypt rights",
    description: "Only the right user context can decrypt values back into readable numbers.",
    color: "rgba(255, 255, 255, 0.05)",
  },
];

const trustCards: BentoCardProps[] = [
  {
    label: "Protection",
    title: "Encrypted Positions",
    description: "Wallet-level lending data stays hidden on-chain by default.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Risk Surface",
    title: "Private Liquidation Surface",
    description: "No public mempool breadcrumbs exposing vulnerable positions.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Signals",
    title: "Confidential Credit Signals",
    description: "Credit context can be computed without publishing a user profile.",
    color: "rgba(255, 255, 255, 0.05)",
  },
  {
    label: "Engine",
    title: "FHE Native Engine",
    description: "Arithmetic runs on encrypted types, not plaintext accounting variables.",
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
      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 max-w-3xl">
          <div
            className={`mb-6 transition-all duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <span className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] text-black/70">
              <Sparkles className="h-3.5 w-3.5 text-black" />
              Fhenix-Inspired Architecture
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
