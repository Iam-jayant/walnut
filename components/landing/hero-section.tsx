"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [healthFactor, setHealthFactor] = useState(1.85);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Simulate health factor fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthFactor((prev) => {
        const change = (Math.random() - 0.5) * 0.1;
        const newValue = prev + change;
        return Math.max(1.2, Math.min(2.5, newValue));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    // Calculate tilt
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = ((y - centerY) / centerY) * -8;
    const tiltY = ((x - centerX) / centerX) * 8;
    
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleDecrypt = () => {
    setIsDecrypting(true);
    setTimeout(() => {
      setShowValues(true);
      setIsDecrypting(false);
    }, 1500);
  };

  const handleEncrypt = () => {
    setShowValues(false);
  };

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-visible pt-10 pb-0 bg-transparent">
      {/* Interactive Grid Background - Extended far down */}
      <div className="absolute inset-0 bottom-[-600px] z-0 overflow-hidden pointer-events-none">
        <HeroGridContent />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-350 px-5 lg:px-10">
        <div className="grid items-center gap-[3.6rem] lg:grid-cols-2">
          <div>
            {/* Wave 1 Winner Badge */}
            <div
              className={`mb-4 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <div className="inline-flex items-center gap-3 rounded-full border-2 border-[#0AD9DC]/30 bg-gradient-to-r from-[#0AD9DC]/10 via-cyan-50 to-[#00B8BB]/10 px-4 py-2 shadow-[0_0_20px_rgba(10,217,220,0.2)]">
                <svg className="w-5 h-5 text-[#0AD9DC]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold text-gray-900">
                  Wave 1 Winner
                </span>
                <span className="h-4 w-px bg-gray-300" />
                <span className="text-xs font-medium text-gray-600">
                  Fhenix Privacy-by-Design Buildathon
                </span>
              </div>
            </div>

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
            <div 
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative lg:ml-auto lg:max-w-[85%] perspective-1000"
              style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: 'transform 0.1s ease-out',
              }}
            >
              {/* Advanced glass card with edge glow */}
              <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-white/40 via-white/20 to-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                {/* Edge glow effect */}
                <div 
                  className="absolute inset-0 rounded-3xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.4), transparent 40%)`,
                  }}
                />
                
                {/* Inner glass card */}
                <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl p-7 overflow-hidden border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  {/* Subtle animated gradient overlay */}
                  <div className="absolute inset-0 opacity-[0.02]">
                    <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/5 animate-pulse" />
                  </div>

                  {/* Corner glows */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/30 to-transparent rounded-full blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-black/5 to-transparent rounded-full blur-2xl" />

                  <div className="relative z-10">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/80">Protocol View</h3>
                        <p className="mt-1.5 text-[1.75rem] font-sans font-semibold tracking-tight">Encrypted Position</p>
                      </div>
                      <button
                        onClick={showValues ? handleEncrypt : handleDecrypt}
                        className="relative h-11 w-11 rounded-full border border-black/10 bg-gradient-to-br from-white to-gray-50 shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition-all duration-300 hover:scale-105 active:scale-95 group"
                      >
                        {isDecrypting && (
                          <div className="absolute inset-0 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
                        )}
                        {!isDecrypting && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {showValues ? (
                              <svg className="w-5 h-5 text-black/70 group-hover:text-black transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-black/70 group-hover:text-black transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </button>
                    </div>

                    <div className="mb-8 space-y-6">
                      <div className="space-y-2.5 group">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                          Collateral
                          {showValues && (
                            <span className="inline-flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-black/5 text-black/60 border border-black/10 font-semibold">
                              <span className="w-1 h-1 rounded-full bg-black/40 animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[1.65rem] font-sans font-semibold tracking-tight transition-all duration-500 ${showValues ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                            {showValues ? (
                              <span className="animate-[fadeIn_0.5s_ease-in]">12,450 USDC</span>
                            ) : (
                              "••••••"
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground/60 font-medium">(private)</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                          Debt
                          {showValues && (
                            <span className="inline-flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-black/5 text-black/60 border border-black/10 font-semibold">
                              <span className="w-1 h-1 rounded-full bg-black/40 animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[1.15rem] font-sans font-semibold tracking-tight transition-all duration-500 ${showValues ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                            {showValues ? (
                              <span className="animate-[fadeIn_0.5s_ease-in_0.1s]">8,200 USDC</span>
                            ) : (
                              "•••"
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground/60 font-medium">(private)</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                          Health Factor
                          <span className={`inline-flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full font-semibold transition-all duration-300 ${
                            healthFactor > 1.5 
                              ? 'bg-green-500/10 text-green-700 border border-green-500/20' 
                              : 'bg-black/5 text-black/60 border border-black/10'
                          }`}>
                            <span className={`w-1 h-1 rounded-full animate-pulse ${
                              healthFactor > 1.5 ? 'bg-green-600' : 'bg-black/50'
                            }`} />
                            {healthFactor > 1.5 ? 'SAFE' : 'WATCH'}
                          </span>
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-[1.15rem] font-sans font-bold tracking-tight transition-all duration-300">
                            {healthFactor.toFixed(2)}
                          </p>
                          <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden border border-black/10">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                healthFactor > 1.5 ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-black/40 to-black/30'
                              }`}
                              style={{ width: `${Math.min(100, (healthFactor / 2.5) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        ["LTV", "80% cap"],
                        ["Auction", "sealed bid"],
                        ["Wallets", "ENS linked"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-black/10 bg-gradient-to-br from-white to-gray-50/50 py-3 px-3 text-center hover:border-black/20 hover:shadow-md hover:scale-[1.02] transition-all duration-200 group">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 group-hover:text-muted-foreground transition-colors font-semibold">{label}</p>
                          <p className="mt-1.5 text-[11px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Powered by text */}
            <div className="mt-4 text-right">
              <p className="text-xs text-muted-foreground/60">
                * Powered by Fhenix CoFHE
              </p>
            </div>
          </div>
        </div>

        {/* Removed decorative end line - replaced by metrics strip */}
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
    <section ref={sectionRef} className="relative py-5 overflow-visible bg-transparent">
      {/* Continue grid from hero */}
      <div className="absolute inset-0 top-[-400px] z-0 overflow-hidden pointer-events-none">
        <HeroGridContent />
      </div>
      
      <div className="max-w-350 mx-auto px-6 lg:px-12 py-8 lg:py-10 relative z-10">
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
const HeroGridContent = () => {
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const mobileGridMask = 'radial-gradient(180px circle at 50% 42%, black 0%, transparent 100%)';

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <>
      <motion.div
        className="absolute inset-0 opacity-30 pointer-events-none"
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
        className="absolute inset-0 pointer-events-none opacity-[0.55]"
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
        className="absolute inset-0 pointer-events-none opacity-[0.34] md:hidden"
        animate={{ backgroundPosition: ['0px 0px', '64px 64px'] }}
        transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        style={{
          backgroundImage: 'linear-gradient(to right, #0AD9DC 1px, transparent 1px), linear-gradient(to bottom, #0AD9DC 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: mobileGridMask,
          WebkitMaskImage: mobileGridMask,
        }}
      />
    </>
  );
};

const HeroGrid = ({ extended = false }: { extended?: boolean }) => {
  return (
    <div
      id="hero-grid"
      className={`absolute z-0 overflow-hidden bg-background pointer-events-none ${
        extended ? 'inset-0 bottom-[-200px]' : 'inset-0'
      }`}
    >
      <HeroGridContent />
    </div>
  );
};
