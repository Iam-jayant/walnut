"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, Lock, TrendingUp } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Wallet,
    title: "Connect Wallet",
    description: "Link your Web3 wallet. No KYC, no registration. Complete privacy from step one.",
  },
  {
    number: "02",
    icon: Lock,
    title: "Encrypt Position",
    description: "Your data is encrypted with FHE. All computations happen on encrypted values.",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Borrow Privately",
    description: "Access credit without exposing your financial information. Liquidations happen privately.",
  },
];

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-32 lg:py-48 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-24 max-w-2xl">
          <div 
            className={`mb-6 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <span className="w-8 h-px bg-foreground/30" />
              Process
            </span>
          </div>
          <h2 
            className={`text-4xl lg:text-5xl font-display leading-[1.2] transition-all duration-700 delay-100 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Three steps. Complete privacy.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className={`transition-all duration-700 ${
                  isVisible 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${(i + 1) * 100}ms` }}
              >
                <div className="interactive-tilt glass-panel flex h-full flex-col rounded-2xl p-6">
                  {/* Number and icon */}
                  <div className="mb-6 flex items-end gap-4">
                    <span className="text-5xl lg:text-6xl font-display text-muted-foreground">
                      {step.number}
                    </span>
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mb-2">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-display mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {/* Connector line (except last) */}
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-24 -right-6 w-12 h-px bg-border opacity-50" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
