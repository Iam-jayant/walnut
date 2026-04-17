"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
    <section ref={sectionRef} className="relative py-32 lg:py-48 overflow-hidden">
      <div className="max-w-350 mx-auto px-6 lg:px-12">
        <div
          className={`relative interactive-tilt glass-panel rounded-2xl transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
        >
          {/* Spotlight effect */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-300 rounded-2xl"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, var(--color-accent), transparent 40%)`
            }}
          />
          
          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            <div className="flex flex-col items-center justify-center gap-8 text-center">
              {/* Content */}
              <div>
                <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6 leading-[1.1]">
                  DeFi should not expose you.
                </h2>

                <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
                  Your financial information is yours alone. Join Walnut to borrow and lend with complete privacy.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-14 rounded-full bg-accent px-8 text-base text-accent-foreground hover:bg-accent/85 group"
                >
                  <Link href="/app">
                    Start Using Walnut
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full border-black/15 bg-white px-8 text-base hover:bg-black/10"
                >
                  <a href="https://docs.walnut.finance" target="_blank" rel="noopener noreferrer">
                    Read the Docs
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
