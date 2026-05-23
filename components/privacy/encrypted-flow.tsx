"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Lock, Cpu, CheckCircle } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";

export function EncryptedFlow() {
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

  const flowSteps = [
    {
      icon: Lock,
      title: "Client Encryption",
      description: "User encrypts borrow amount using fhenixjs before transaction request",
      code: `const encrypted = await fhenixClient.encrypt_uint128(
  borrowAmount
);

await walnut.borrow(encrypted);`,
      state: "Plaintext → Ciphertext"
    },
    {
      icon: Cpu,
      title: "On-Chain FHE Computation",
      description: "Contract performs LTV check and updates encrypted balances without decryption",
      code: `// Compute encrypted health factor
euint128 hf = FHE.div(collateral, debt);

// Update encrypted debt
userDebt[msg.sender] = FHE.add(
  userDebt[msg.sender],
  encryptedAmount
);`,
      state: "Ciphertext → Ciphertext"
    },
    {
      icon: CheckCircle,
      title: "Encrypted State Persisted",
      description: "All sensitive values remain encrypted in contract storage. No plaintext exposure.",
      code: `// Storage layout
mapping(address => euint128) userCollateral;
mapping(address => euint128) userDebt;
mapping(address => euint128) repaymentCount;`,
      state: "Ciphertext Storage"
    }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 left-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        04
      </div>

      {/* Radial glow */}
      <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-[#0AD9DC]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            Execution Flow
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            End-to-End
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Encrypted Execution
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            From client-side encryption to on-chain storage, sensitive data never exists in plaintext.
          </p>
        </motion.div>

        {/* Flow steps */}
        <div className="space-y-8">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            const accentColor = ["green", "purple", "blue"][index] as "green" | "purple" | "blue";
            return (
              <div key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                  transition={{ duration: 0.6, delay: 0.1 + index * 0.15 }}
                >
                  <GlassCard accentColor={accentColor} sectionNumber={`${index + 1}`} className="p-8">
                    {/* Header */}
                    <div className="flex items-start gap-6 mb-6">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border ${
                        accentColor === "green" ? "bg-green-100 border-green-200" :
                        accentColor === "purple" ? "bg-purple-100 border-purple-200" :
                        "bg-blue-100 border-blue-200"
                      }`}>
                        <Icon className={`w-7 h-7 ${
                          accentColor === "green" ? "text-green-500" :
                          accentColor === "purple" ? "text-purple-500" :
                          "text-blue-500"
                        }`} strokeWidth={1.5} />
                      </div>

                      {/* Title and description */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                          <span className={`px-2 py-1 text-xs font-mono rounded border ${
                            accentColor === "green" ? "bg-green-100 border-green-200 text-green-500" :
                            accentColor === "purple" ? "bg-purple-100 border-purple-200 text-purple-500" :
                            "bg-blue-100 border-blue-200 text-blue-500"
                          }`}>
                            {step.state}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-relaxed">{step.description}</p>
                      </div>
                    </div>

                    {/* Code block with header */}
                    <div className="relative bg-[#FAFAFA]/60 border border-gray-200 rounded-xl overflow-hidden">
                      {/* File header */}
                      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full border ${
                            accentColor === "green" ? "bg-green-500/50 border-green-500" :
                            accentColor === "purple" ? "bg-purple-500/50 border-purple-500" :
                            "bg-blue-500/50 border-blue-500"
                          }`}></div>
                          <span className="text-[10px] text-gray-600 font-mono">
                            {index === 0 ? "client.ts" : index === 1 ? "WalnutProtocol.sol" : "storage.sol"}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${
                          accentColor === "green" ? "bg-green-100 text-green-500 border-green-200" :
                          accentColor === "purple" ? "bg-purple-100 text-purple-500 border-purple-200" :
                          "bg-blue-100 text-blue-500 border-blue-200"
                        }`}>
                          {index === 0 ? "Client" : index === 1 ? "Contract" : "Storage"}
                        </span>
                      </div>
                      
                      {/* Code content */}
                      <div className="p-5">
                        <pre className="text-sm font-mono text-gray-700 leading-relaxed overflow-x-auto">
                          <code>{step.code}</code>
                        </pre>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Connector arrow */}
                {index < flowSteps.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isVisible ? 1 : 0 }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.15 }}
                    className="flex justify-center py-4"
                  >
                    <ArrowDown className="w-6 h-6 text-white/20" strokeWidth={2} />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent" />
    </section>
  );
}


