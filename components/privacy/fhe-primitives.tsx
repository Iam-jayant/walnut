"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./ui/GlassCard";

export function FHEPrimitives() {
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

  const primitives = [
    {
      name: "FHE.add",
      description: "Homomorphic addition on encrypted integers",
      useCase: "Aggregate collateral across wallets",
      code: `euint128 total = FHE.add(
  userCollateral[wallet1],
  userCollateral[wallet2]
);`
    },
    {
      name: "FHE.sub",
      description: "Homomorphic subtraction for balance updates",
      useCase: "Decrement debt on repayment",
      code: `userDebt[msg.sender] = FHE.sub(
  userDebt[msg.sender],
  encryptedAmount
);`
    },
    {
      name: "FHE.mul",
      description: "Encrypted multiplication for interest calculations",
      useCase: "Compute accrued interest",
      code: `euint128 interest = FHE.mul(
  principal,
  encryptedRate
);`
    },
    {
      name: "FHE.div",
      description: "Homomorphic division for ratio computation",
      useCase: "Calculate health factor",
      code: `euint128 healthFactor = FHE.div(
  totalCollateral,
  totalDebt
);`
    },
    {
      name: "FHE.select",
      description: "Conditional selection in ciphertext",
      useCase: "Find minimum bid in sealed auction",
      code: `euint128 minBid = FHE.select(
  FHE.lt(bid1, bid2),
  bid1,
  bid2
);`
    },
    {
      name: "FHE.allowPublic",
      description: "Grant decryption permissions to public enclaves",
      useCase: "Authorize secure client-driven decryption",
      code: `FHE.allowPublic(mintedAmount);
uint256 ctHash = uint256(
  euint128.unwrap(mintedAmount)
);`
    }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 right-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        03
      </div>

      {/* Radial glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#0AD9DC]/5 rounded-full blur-[100px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            FHE Operations
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Encrypted
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Computation Primitives
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            Walnut leverages Fhenix's FHE library to perform arithmetic and logical operations
            directly on encrypted data without ever exposing plaintext values.
          </p>
        </motion.div>

        {/* Primitives grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {primitives.map((primitive, index) => {
            const accentColor = ["orange", "green", "purple", "blue", "red", "orange"][index] as "orange" | "green" | "purple" | "blue" | "red";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
              >
                <GlassCard accentColor={accentColor} className="h-full p-6">
                  {/* Function name */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold font-mono text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-current group-hover:via-white group-hover:to-current transition-all duration-500">
                      {primitive.name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded text-gray-600">
                      euint128
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{primitive.description}</p>
                  
                  {/* Use case */}
                  <div className="mb-4 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-md inline-block">
                    <span className="text-xs text-gray-600">Use case: </span>
                    <span className="text-xs text-gray-900">{primitive.useCase}</span>
                  </div>

                  {/* Code block with header */}
                  <div className="relative mt-4 bg-[#FAFAFA]/60 border border-gray-200 rounded-xl overflow-hidden">
                    {/* File header */}
                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500/50 border border-green-500"></div>
                        <span className="text-[10px] text-gray-600 font-mono">WalnutProtocol.sol</span>
                      </div>
                      <span className="px-2 py-0.5 bg-green-100 text-green-500 rounded-md border border-green-200 text-[9px] font-bold uppercase">
                        FHE
                      </span>
                    </div>
                    
                    {/* Code content */}
                    <div className="p-4">
                      <pre className="text-xs font-mono text-gray-700 leading-relaxed overflow-x-auto">
                        <code>{primitive.code}</code>
                      </pre>
                    </div>
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


