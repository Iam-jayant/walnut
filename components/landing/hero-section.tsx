"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-32 pb-24">
      <div className="relative z-10 mx-auto w-full max-w-350 px-6 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <div
              className={`mb-8 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
                <span className="h-px w-8 bg-foreground/30" />
                Private lending, finally
              </span>
            </div>

            <h1
              className={`mb-6 text-5xl leading-[1.1] tracking-tight font-display lg:text-6xl transition-all duration-1000 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              Private Lending, Finally.
            </h1>

            <p
              className={`mb-8 max-w-md text-lg leading-relaxed text-muted-foreground transition-all duration-700 delay-200 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              Borrow, lend, and manage your position with privacy built in.
            </p>

            <div
              className={`flex flex-col items-start gap-4 sm:flex-row transition-all duration-700 delay-300 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <Button
                asChild
                size="lg"
                className="group h-14 rounded-full bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
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
                className="h-14 rounded-full border-black/15 bg-white px-8 text-base hover:bg-black/5"
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
            <div className="interactive-tilt glass-panel rounded-2xl p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wide text-muted-foreground">Portfolio</h3>
                  <p className="mt-1 text-2xl font-display">Your Account</p>
                </div>
                <div className="h-10 w-10 rounded-full border border-accent/40 bg-accent/20" />
              </div>

              <div className="mb-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Total Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display">******</span>
                    <span className="text-sm text-muted-foreground">(private)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Health Factor</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-display">***</span>
                    <span className="text-sm text-muted-foreground">(private)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Active Positions</p>
                  <p className="text-xl font-display">**</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="rounded-xl border border-black/12 bg-white py-3 px-4 text-sm font-medium transition hover:bg-black/5">
                  Deposit
                </button>
                <button className="rounded-xl border border-black/12 bg-white py-3 px-4 text-sm font-medium transition hover:bg-black/5">
                  Borrow
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
