"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";

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
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-36 pb-16 bg-white">
      {/* Interactive Grid Background */}
      <HeroGrid />

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
              className={`mb-5 text-[clamp(2.25rem,4.15vw,4.6rem)] leading-[1.04] tracking-tight font-sans font-semibold transition-all duration-1000 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              <span className="block sm:whitespace-nowrap">Borrow and Manage Risk</span>
              <span className="hero-emphasis-line block text-foreground/66 font-normal">
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
              className={`flex flex-col items-start gap-3.5 sm:flex-row mb-7 transition-all duration-700 delay-250 ${
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

            <div
              className={`hero-feature-grid grid grid-cols-4 gap-3 w-full transition-all duration-700 delay-300 ${
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
                  className="hero-feature-chip rounded-xl border border-black/10 bg-white/82 px-3 py-2 text-[10px] text-center uppercase tracking-[0.11em] text-foreground/80 backdrop-blur-sm"
                >
                  {item}
                </div>
              ))}
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

        {/* Decorative end line with cyan reflection */}
        <div className="mt-16 lg:mt-20 relative">
          <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent blur-sm" />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* Intro Panel Section - Separate from Hero */
/* ═══════════════════════════════════════════════════════════════ */

export function IntroPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-0 overflow-hidden bg-white">
      <div className="max-w-350 mx-auto px-6 lg:px-12 py-8 lg:py-10">
        <div className="max-w-[82%] mx-auto">
          <div
            className={`relative glass-panel rounded-3xl min-h-[280px] flex items-center transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            onMouseMove={handleMouseMove}
          >
            {/* Cursor-sensitive spotlight effect */}
            <div 
              className="absolute inset-0 opacity-[0.12] pointer-events-none transition-all duration-300 rounded-3xl"
              style={{
                background: `radial-gradient(500px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(10, 217, 220, 0.5), transparent 40%)`
              }}
            />
            
            {/* Gradient accent in bottom right */}
            <div 
              className="absolute bottom-0 right-0 w-[450px] h-[450px] opacity-[0.25] pointer-events-none rounded-3xl"
              style={{
                background: 'radial-gradient(circle at center, rgba(10, 217, 220, 0.8), transparent 60%)',
                filter: 'blur(70px)',
              }}
            />
          
          <div className="relative z-10 w-full px-8 lg:px-16 py-10 lg:py-12">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="mb-5 inline-flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0AD9DC]" />
                <span className="h-px w-8 bg-foreground/30" />
                Confidential Lending Protocol
              </div>

              {/* Heading */}
              <h2 className="text-3xl lg:text-[2.75rem] font-sans font-semibold tracking-tight mb-5 leading-[1.15]">
                Private lending that actually explains what Walnut does.
              </h2>

              {/* Description */}
              <p className="text-base lg:text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
                Encrypted collateral, private debt positions, and sealed-bid liquidations on Fhenix.
              </p>

              {/* CTAs - Centered horizontally */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full sm:w-auto min-w-[180px] rounded-full bg-accent px-7 text-sm font-medium text-accent-foreground hover:bg-accent/90 group shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
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
                  className="h-12 w-full sm:w-auto min-w-[180px] rounded-full border-black/15 bg-white/90 px-7 text-sm font-medium hover:bg-white hover:border-black/25 backdrop-blur-sm transition-all"
                >
                  <a href="https://github.com/Iam-jayant/walnut" target="_blank" rel="noopener noreferrer">
                    Documentation
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Decorative end line with cyan reflection */}
        <div className="mt-8 lg:mt-10 relative">
          <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent blur-sm" />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const HeroGrid = () => {
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const mobileGridMask = 'radial-gradient(180px circle at 50% 42%, black 0%, transparent 100%)';

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const gridEl = document.getElementById('hero-grid');
      if (gridEl) {
        const { left, top } = gridEl.getBoundingClientRect();
        mouseX.set(e.clientX - left);
        mouseY.set(e.clientY - top);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div
      id="hero-grid"
      className="absolute inset-0 z-0 overflow-hidden bg-background pointer-events-none"
    >
      {/* Global faint background grid */}
      <motion.div
        className="absolute inset-0 opacity-20 pointer-events-none"
        animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
        transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, #000 10%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, #000 10%, transparent 100%)',
        }}
      />

      {/* Glowing active cyan grid lines localized to cursor */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-[0.45]"
        animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
        transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        style={{
          backgroundImage: 'linear-gradient(to right, #0AD9DC 1px, transparent 1px), linear-gradient(to bottom, #0AD9DC 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
          WebkitMaskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
        }}
      />

      {/* Mobile grid glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-[0.24] md:hidden"
        animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
        transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        style={{
          backgroundImage: 'linear-gradient(to right, #0AD9DC 1px, transparent 1px), linear-gradient(to bottom, #0AD9DC 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: mobileGridMask,
          WebkitMaskImage: mobileGridMask,
        }}
      />
    </div>
  );
};
