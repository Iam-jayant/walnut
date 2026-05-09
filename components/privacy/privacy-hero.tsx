"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export function PrivacyHero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-cyan-50 rounded-full blur-[120px] opacity-30" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-32">
        {/* Section number */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isVisible ? 0.03 : 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-32 right-12 text-[280px] font-bold text-gray-900 pointer-events-none select-none"
        >
          01
        </motion.div>

        <div className="max-w-5xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-cyan-200 bg-cyan-500/5">
              <Lock className="w-4 h-4 text-[#0AD9DC]" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#0AD9DC]">
                Privacy Architecture
              </span>
            </div>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tighter text-gray-900"
          >
            Privacy by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] via-cyan-300 to-[#00B8BB] drop-shadow-[0_0_30px_rgba(10,217,220,0.3)]">Design</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xl text-gray-700 leading-relaxed max-w-2xl mb-8"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] font-semibold">Walnut</span> leverages Fully Homomorphic Encryption (FHE) to ensure your financial data remains confidential.
            We don't just protect your privacy; we mathematically guarantee it.
          </motion.p>

          {/* Stats grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-3 gap-6"
          >
            {[
              { label: "Encrypted Operations", value: "100%", color: "orange" },
              { label: "FHE Primitives", value: "8+", color: "green" },
              { label: "Plaintext Exposure", value: "0", color: "purple" },
            ].map((stat, index) => {
              const colors = {
                orange: "from-orange-500/10 group-hover:from-orange-500/20 text-[#0AD9DC]",
                green: "from-green-500/10 group-hover:from-green-500/20 text-green-500",
                purple: "from-purple-500/10 group-hover:from-purple-500/20 text-purple-500"
              };
              return (
                <div key={index} className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors[stat.color as keyof typeof colors].split(' ')[0]} to-transparent rounded-lg opacity-100 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative p-6 border border-gray-200 rounded-lg backdrop-blur-sm group-hover:border-gray-200 transition-colors">
                    <div className={`text-4xl font-bold mb-2 ${colors[stat.color as keyof typeof colors].split(' ').slice(-1)}`}>{stat.value}</div>
                    <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
    </section>
  );
}


