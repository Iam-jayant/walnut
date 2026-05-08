"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative bg-white py-24 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white"></div>
      
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Main heading */}
        <h2 className="text-4xl lg:text-5xl font-sans font-semibold text-black mb-6 tracking-tight">
          Ready to borrow privately?
        </h2>
        
        {/* Subtext */}
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Experience confidential lending on Arbitrum Sepolia. Your positions stay encrypted.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 rounded-full bg-black text-white hover:bg-black/90 text-base font-medium group shadow-lg hover:shadow-xl transition-all"
          >
            <Link href="/app">
              Launch App
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 px-8 rounded-full border-2 border-black/20 bg-white hover:bg-gray-50 text-base font-medium transition-all"
          >
            <a href="https://github.com/Iam-jayant/walnut" target="_blank" rel="noopener noreferrer">
              View Documentation
            </a>
          </Button>
        </div>
        
        {/* Small note */}
        <p className="mt-8 text-xs text-gray-500">
          Currently live on Arbitrum Sepolia testnet
        </p>
      </div>
    </section>
  );
}
