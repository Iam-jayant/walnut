"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";

export function CallbackSystem() {
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

  const callbacks = [
    {
      name: "syncPositionGuardCheck",
      trigger: "Health factor decryption",
      purpose: "Set liquidatable flag based on decrypted health factor",
      code: `function syncPositionGuardCheck(
  euint128 ciphertext,
  uint128 result,
  bytes calldata signature
) external {
  require(
    FHE.verifyDecryptResultSafe(ciphertext, result, signature),
    "Invalid signature"
  );
  
  address user = ciphertextToUser[ciphertext];
  if (result == 1) {
    isLiquidatable[user] = true;
    emit LiquidationEligible(user);
  }
}`
    },
    {
      name: "syncWinnerSelected",
      trigger: "Minimum bid index decryption",
      purpose: "Reveal winning liquidator without exposing bid amounts",
      code: `function syncWinnerSelected(
  euint128 ciphertext,
  uint128 winnerIndex,
  bytes calldata signature
) external {
  require(
    FHE.verifyDecryptResultSafe(ciphertext, winnerIndex, signature),
    "Invalid signature"
  );
  
  address user = auctionUser[ciphertext];
  address winner = bidders[user][winnerIndex];
  
  // Execute liquidation with winner
  _executeLiquidation(user, winner);
}`
    },
    {
      name: "syncCreditCount",
      trigger: "Repayment count decryption",
      purpose: "Map encrypted count to public credit tier",
      code: `function syncCreditCount(
  euint128 ciphertext,
  uint128 count,
  bytes calldata signature
) external {
  require(
    FHE.verifyDecryptResultSafe(ciphertext, count, signature),
    "Invalid signature"
  );
  
  address user = ciphertextToUser[ciphertext];
  uint8 tier = _computeTier(count);
  creditTier[user] = tier;
  
  emit CreditTierUpdated(user, tier);
}`
    }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 left-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        06
      </div>

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[#0AD9DC]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            Client-Driven Decryption Sync
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Selective Decryption
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Through Enclave Verification
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            When protocol logic requires a plaintext value, Walnut coordinates decryption off-chain and validates ECDSA enclave signatures on-chain.
            Decrypted values exist only during transaction execution — never stored, never emitted in logs.
          </p>
        </motion.div>

        {/* Callback cards */}
        <div className="space-y-8">
          {callbacks.map((callback, index) => {
            const accentColor = ["orange", "green", "purple"][index] as "orange" | "green" | "purple";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -20 }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
              >
                <GlassCard accentColor={accentColor} sectionNumber={`0${index + 1}`} className="p-8">
                  {/* Header */}
                  <div className="flex items-start gap-6 mb-6">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border ${
                      accentColor === "orange" ? "bg-cyan-50 border-cyan-200" :
                      accentColor === "green" ? "bg-green-100 border-green-200" :
                      "bg-purple-100 border-purple-200"
                    }`}>
                      <Zap className={`w-7 h-7 ${
                        accentColor === "orange" ? "text-[#0AD9DC]" :
                        accentColor === "green" ? "text-green-500" :
                        "text-purple-500"
                      }`} strokeWidth={1.5} />
                    </div>

                    {/* Title and meta */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold font-mono text-gray-900 mb-3">{callback.name}</h3>
                      
                      <div className="flex flex-wrap gap-3 mb-3">
                        <div className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-md">
                          <span className="text-xs text-gray-600">Trigger: </span>
                          <span className="text-xs text-gray-900">{callback.trigger}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-md border ${
                          accentColor === "orange" ? "bg-cyan-50 border-cyan-200" :
                          accentColor === "green" ? "bg-green-100 border-green-200" :
                          "bg-purple-100 border-purple-200"
                        }`}>
                          <span className={`text-xs font-mono ${
                            accentColor === "orange" ? "text-[#0AD9DC]" :
                            accentColor === "green" ? "text-green-500" :
                            "text-purple-500"
                          }`}>signature-verified</span>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 leading-relaxed">{callback.purpose}</p>
                    </div>
                  </div>

                  {/* Code block with header */}
                  <div className="relative bg-[#FAFAFA]/60 border border-gray-200 rounded-xl overflow-hidden">
                    {/* File header */}
                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full border ${
                          accentColor === "orange" ? "bg-cyan-500/50 border-orange-500" :
                          accentColor === "green" ? "bg-green-500/50 border-green-500" :
                          "bg-purple-500/50 border-purple-500"
                        }`}></div>
                        <span className="text-[10px] text-gray-600 font-mono">WalnutLending.sol</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${
                        accentColor === "orange" ? "bg-cyan-50 text-[#0AD9DC] border-cyan-200" :
                        accentColor === "green" ? "bg-green-100 text-green-500 border-green-200" :
                        "bg-purple-100 text-purple-500 border-purple-200"
                      }`}>
                        ECDSA Verify
                      </span>
                    </div>
                    
                    {/* Code content */}
                    <div className="p-5">
                      <pre className="text-sm font-mono text-gray-700 leading-relaxed overflow-x-auto">
                        <code>{callback.code}</code>
                      </pre>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Key principle callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 p-8 border-2 border-[#0AD9DC]/30 rounded-2xl bg-gradient-to-br from-[#0AD9DC]/5 to-transparent backdrop-blur-sm"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(10,217,220,0.5)]" />
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">ECDSA Enclave Verification Principle</h4>
              <p className="text-gray-700 leading-relaxed">
                All client-driven sync actions are verified using the <code className="font-mono text-[#0AD9DC] bg-cyan-50 px-1.5 py-0.5 rounded">verifyDecryptResultSafe</code> function on-chain,
                which validates that the decrypted value matches a valid ECDSA signature signed directly by FHE enclave nodes.
                Decrypted values exist solely in transaction execution scope and are never persisted to storage or emitted in events, ensuring maximum security and zero leak potential through indexers or chain history.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent" />
    </section>
  );
}


