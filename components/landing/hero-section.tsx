"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  const focusTerms = ["Numbers", "Collateral", "Debt", "Risk Signals"];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFocusIndex((current) => (current + 1) % focusTerms.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [focusTerms.length]);

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-28 pb-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orb hero-orb-cyan" />
        <div className="hero-orb hero-orb-slate" />
        <div className="hero-grid-overlay" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-350 px-5 lg:px-10">
        <div className="grid items-center gap-[3.6rem] lg:grid-cols-2">
          <div>
            <div
              className={`mb-7 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-white/80 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0AD9DC] shadow-[0_0_12px_rgba(10,217,220,0.8)]" />
                <span className="h-px w-8 bg-foreground/30" />
                Confidential Lending on EVM Powered by Fhenix.
              </span>
            </div>

            <h1
              className={`mb-5 text-[clamp(2.25rem,4.15vw,4.6rem)] leading-[1.04] tracking-tight font-display transition-all duration-1000 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              <span className="block sm:whitespace-nowrap">Borrow and Manage Risk</span>
              <span className="hero-emphasis-line block text-foreground/66">
                Without Exposing Your
                {" "}
                <span key={focusTerms[focusIndex]} className="hero-focus-term">
                  {focusTerms[focusIndex]}
                </span>
                .
              </span>
            </h1>

            <p
              className={`mb-7 max-w-lg text-[1.02rem] leading-relaxed text-muted-foreground transition-all duration-700 delay-200 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              Walnut keeps collateral, debt, and liquidation-sensitive values encrypted by default while still enabling a complete lending workflow.
            </p>

            <div
              className={`hero-feature-grid mb-7 grid max-w-xl grid-cols-2 gap-2 transition-all duration-700 delay-250 sm:grid-cols-4 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              {[
                "Encrypted Collateral",
                "Permit-Based Decrypt",
                "Sealed-Bid Auctions",
                "ENS Wallet Linking",
              ].map((item) => (
                <div
                  key={item}
                  className="hero-feature-chip rounded-xl border border-black/10 bg-white/82 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.11em] text-foreground/80 backdrop-blur-sm"
                >
                  {item}
                </div>
              ))}
            </div>

            <div
              className={`flex flex-col items-start gap-3.5 sm:flex-row transition-all duration-700 delay-300 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <Button
                asChild
                size="lg"
                className="hero-cta-primary group h-12 rounded-full bg-accent px-7 text-[0.95rem] text-accent-foreground hover:bg-accent/90"
              >
                <Link href="/app">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="hero-cta-secondary h-12 rounded-full border-black/15 bg-white px-7 text-[0.95rem] hover:bg-black/5"
              >
                <Link href="/app">Open Dashboard</Link>
              </Button>
            </div>
          </div>

          <div
            className={`transition-all duration-1000 delay-400 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <div className="interactive-tilt glass-panel rounded-2xl p-[1.65rem] lg:ml-auto lg:max-w-[92%]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-mono uppercase tracking-wide text-muted-foreground">Protocol View</h3>
                  <p className="mt-1 text-[1.58rem] font-display">Encrypted Position</p>
                </div>
                <div className="h-9 w-9 rounded-full border border-accent/40 bg-accent/20 shadow-[0_0_24px_rgba(0,0,0,0.18)]" />
              </div>

              <div className="mb-6 space-y-4.5">
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Collateral</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[1.54rem] font-display">******</span>
                    <span className="text-sm text-muted-foreground">(private)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Debt</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[1rem] font-display">***</span>
                    <span className="text-sm text-muted-foreground">(private)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Health Factor</p>
                  <p className="text-[1.06rem] font-display">**.**</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ["LTV", "80% cap"],
                  ["Auction", "sealed bid"],
                  ["Wallets", "ENS linked"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-black/12 bg-white py-2 px-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xs font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
