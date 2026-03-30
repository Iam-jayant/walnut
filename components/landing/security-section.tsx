"use client";

import { useEffect, useState, useRef } from "react";
import { Lock, Eye, FileCheck, Zap } from "lucide-react";

const privacyFeatures = [
  {
    icon: Lock,
    title: "Fully Homomorphic Encryption",
    description: "Computations happen on encrypted data. Walnut never sees plaintext.",
  },
  {
    icon: Eye,
    title: "Private State",
    description: "Your positions, balances, and credit score are computed privately.",
  },
  {
    icon: Zap,
    title: "Private Liquidations",
    description: "No public mempool. No liquidation sniping. No MEV extraction.",
  },
  {
    icon: FileCheck,
    title: "Audited Protocol",
    description: "Smart contracts audited by leading security firms. Code is open-source.",
  },
];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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
    <section id="security" ref={sectionRef} className="relative py-32 lg:py-48 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Privacy & Security
            </span>
            <h2 className="text-4xl lg:text-5xl font-display leading-[1.2] mb-8">
              Privacy is your right.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-12">
              Every feature is designed with privacy first. Encryption is not an add-on. It&apos;s how Walnut works.
            </p>

            {/* Key stats */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-mono text-muted-foreground uppercase tracking-wide mb-2">Encryption Standard</p>
                <p className="text-2xl font-display">Fully Homomorphic (FHE)</p>
              </div>
              <div>
                <p className="text-sm font-mono text-muted-foreground uppercase tracking-wide mb-2">Audit Status</p>
                <p className="text-2xl font-display">Third-party Audited</p>
              </div>
              <div>
                <p className="text-sm font-mono text-muted-foreground uppercase tracking-wide mb-2">Code Visibility</p>
                <p className="text-2xl font-display">Open Source</p>
              </div>
            </div>
          </div>

          {/* Right: Features grid */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="grid gap-6">
              {privacyFeatures.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    className="interactive-tilt group glass-panel rounded-xl p-6 transition-colors duration-300 hover:border-accent/50"
                    style={{ transitionDelay: `${(i + 1) * 50}ms` }}
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 mt-1">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display mb-1 group-hover:text-accent transition-colors duration-300">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
