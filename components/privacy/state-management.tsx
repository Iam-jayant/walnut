"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Database, Shield } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";

export function StateManagement() {
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

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 right-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        05
      </div>

      {/* Radial glow */}
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#0AD9DC]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            Storage Architecture
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Encrypted State
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Management
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            All sensitive protocol state is stored as encrypted integers (euint128). No plaintext financial
            data ever touches contract storage.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Storage layout */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <GlassCard accentColor="green" sectionNumber="01" className="h-full p-8">
              {/* Icon */}
              <div className="w-14 h-14 mb-6 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center">
                <Database className="w-7 h-7 text-green-500" strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Encrypted Storage Layout</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Core protocol state stored as FHE-encrypted integers
              </p>

              {/* Code block with header */}
              <div className="relative bg-[#FAFAFA]/60 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 border-b border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500/50 border border-green-500"></div>
                    <span className="text-[10px] text-green-700 font-mono">WalnutStorage.sol</span>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-500 rounded-md border border-green-500/30 text-[9px] font-bold uppercase">
                    Storage
                  </span>
                </div>
                
                <div className="p-5">
                  <pre className="text-sm font-mono text-gray-700 leading-relaxed overflow-x-auto">
                    <code>{`// User positions
mapping(address => euint128) userCollateral;
mapping(address => euint128) userDebt;
mapping(address => euint128) repaymentCount;

// Pool state
euint128 totalPoolCollateral;
euint128 totalPoolDebt;

// P2P offers
struct Offer {
  euint128 apr;
  euint128 size;
  euint128 tenor;
  bool active;
}
mapping(uint256 => Offer) offers;

// Liquidation bids
mapping(address => euint128[]) bids;`}</code>
                  </pre>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Access control */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassCard accentColor="purple" sectionNumber="02" className="h-full p-8">
              {/* Icon */}
              <div className="w-14 h-14 mb-6 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center">
                <Shield className="w-7 h-7 text-purple-500" strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Permit-Based Access Control</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Users grant read permissions via FHE.allow for selective decryption
              </p>

              {/* Code block with header */}
              <div className="relative bg-[#FAFAFA]/60 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 border-b border-purple-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500/50 border border-purple-500"></div>
                    <span className="text-[10px] text-purple-700 font-mono">WalnutPermit.sol</span>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-500 rounded-md border border-purple-500/30 text-[9px] font-bold uppercase">
                    ACL
                  </span>
                </div>
                
                <div className="p-5">
                  <pre className="text-sm font-mono text-gray-700 leading-relaxed overflow-x-auto">
                    <code>{`// Grant contract permission
FHE.allowThis(userCollateral[msg.sender]);
FHE.allowThis(userDebt[msg.sender]);

// Grant specific address permission
FHE.allow(
  offers[offerId].apr,
  borrower
);

// P2P: only lender and borrower can read
FHE.allow(encryptedTerms, lender);
FHE.allow(encryptedTerms, borrower);

// Third parties: no access`}</code>
                  </pre>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Key properties */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 grid md:grid-cols-3 gap-6"
        >
          {[
            {
              title: "No Plaintext Storage",
              description: "All sensitive values stored as euint128 ciphertexts"
            },
            {
              title: "Granular Permissions",
              description: "Users control who can decrypt their encrypted data"
            },
            {
              title: "Composable Privacy",
              description: "Encrypted state can be used in other FHE operations"
            }
          ].map((property, index) => (
            <div
              key={index}
              className="p-6 border border-gray-200 rounded-xl bg-[#FAFAFA]/20 backdrop-blur-sm"
            >
              <h4 className="text-lg font-bold text-gray-900 mb-2">{property.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0AD9DC]/30 to-transparent" />
    </section>
  );
}


