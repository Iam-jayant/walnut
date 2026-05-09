"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Gavel, TrendingUp, Link2, Wallet } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";

export function UseCases() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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

  const useCases = [
    {
      icon: Gavel,
      title: "Sealed-Bid Liquidations",
      problem: "Traditional DeFi: liquidation bids are public, enabling MEV extraction and unfair outcomes",
      solution: "Walnut: liquidators submit encrypted bids. FHE.select finds minimum in ciphertext. Only winner revealed.",
      privacy: ["Bid amounts encrypted forever", "No MEV visibility", "Borrowers get best outcome"],
      tech: ["FHE.select", "Encrypted auction", "CoFHE winner callback"]
    },
    {
      icon: TrendingUp,
      title: "Private Credit Scoring",
      problem: "On-chain credit history is fully public, exposing user financial behavior to everyone",
      solution: "Walnut: repayment count stored as euint128. CoFHE decrypts privately to compute tier. Only tier is public.",
      privacy: ["Repayment history encrypted", "Count never public", "Tier-based LTV unlocks"],
      tech: ["euint128 counter", "Private tier mapping", "Selective disclosure"]
    },
    {
      icon: Link2,
      title: "Confidential P2P Terms",
      problem: "Loan terms (APR, size, duration) are visible to all participants and indexers",
      solution: "Walnut: lender encrypts terms. Only matched borrower gets FHE.allow permission. Third parties see nothing.",
      privacy: ["APR stays private", "Loan size encrypted", "Duration confidential"],
      tech: ["FHE.allow", "Permit-based access", "Encrypted offers"]
    },
    {
      icon: Wallet,
      title: "ENS Wallet Aggregation",
      problem: "Linking wallets publicly reveals user's full portfolio and relationships",
      solution: "Walnut: aggregate encrypted collateral across wallets using FHE.add. No public wallet linking.",
      privacy: ["Wallet relationships hidden", "Aggregated balance private", "Higher LTV without exposure"],
      tech: ["FHE.add", "ENS identity", "Cross-wallet privacy"]
    }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 right-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        07
      </div>

      {/* Radial glow */}
      <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-[#0AD9DC]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            Confidential Use Cases
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Privacy-Preserving
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Lending Primitives
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            Walnut's FHE architecture enables lending features that are structurally impossible
            in traditional transparent DeFi.
          </p>
        </motion.div>

        {/* Use cases grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            const accentColor = ["orange", "green", "purple", "blue"][index] as "orange" | "green" | "purple" | "blue";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
              >
                <GlassCard accentColor={accentColor} sectionNumber={`0${index + 1}`} className="h-full p-8">
                  {/* Icon and title */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${
                      accentColor === "orange" ? "bg-cyan-50 border-cyan-200" :
                      accentColor === "green" ? "bg-green-100 border-green-200" :
                      accentColor === "purple" ? "bg-purple-100 border-purple-200" :
                      "bg-blue-100 border-blue-200"
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        accentColor === "orange" ? "text-[#0AD9DC]" :
                        accentColor === "green" ? "text-green-500" :
                        accentColor === "purple" ? "text-purple-500" :
                        "text-blue-500"
                      }`} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 pt-2">{useCase.title}</h3>
                  </div>

                  {/* Problem */}
                  <div className="mb-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="text-xs font-mono uppercase tracking-wider text-red-400 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Traditional DeFi Problem
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{useCase.problem}</p>
                  </div>

                  {/* Solution */}
                  <div className={`mb-4 p-4 rounded-lg border ${
                    accentColor === "orange" ? "bg-cyan-500/5 border-cyan-200" :
                    accentColor === "green" ? "bg-green-500/5 border-green-200" :
                    accentColor === "purple" ? "bg-purple-500/5 border-purple-200" :
                    "bg-blue-500/5 border-blue-200"
                  }`}>
                    <div className={`text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-2 ${
                      accentColor === "orange" ? "text-[#0AD9DC]" :
                      accentColor === "green" ? "text-green-500" :
                      accentColor === "purple" ? "text-purple-500" :
                      "text-blue-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        accentColor === "orange" ? "bg-orange-500" :
                        accentColor === "green" ? "bg-green-500" :
                        accentColor === "purple" ? "bg-purple-500" :
                        "bg-blue-500"
                      }`}></span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] font-semibold">Walnut</span> Solution
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{useCase.solution}</p>
                  </div>

                  {/* Privacy guarantees */}
                  <div className="mb-4">
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-600 mb-3">Privacy Guarantees</div>
                    <div className="space-y-2">
                      {useCase.privacy.map((guarantee, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${
                            accentColor === "orange" ? "bg-orange-400" :
                            accentColor === "green" ? "bg-green-400" :
                            accentColor === "purple" ? "bg-purple-400" :
                            "bg-blue-400"
                          }`} />
                          <span className="text-sm text-gray-600">{guarantee}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-2">
                    {useCase.tech.map((tech, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent" />
    </section>
  );
}


