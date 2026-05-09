"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "./ui/GlassCard";

export function TechnicalSpecs() {
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

  const specs = [
    { label: "Encryption Scheme", value: "Fully Homomorphic Encryption (FHE)" },
    { label: "FHE Provider", value: "Fhenix CoFHE" },
    { label: "Encrypted Type", value: "euint128" },
    { label: "Network", value: "Arbitrum Sepolia (Testnet)" },
    { label: "Callback System", value: "Async CoFHE Decryption" },
    { label: "Access Control", value: "Permit-based (FHE.allow)" },
    { label: "Storage Model", value: "Encrypted-by-default" },
    { label: "Plaintext Exposure", value: "Callback-scoped only" }
  ];

  const resources = [
    { label: "GitHub Repository", url: "https://github.com/Iam-jayant/walnut" },
    { label: "Fhenix Documentation", url: "https://docs.fhenix.io" },
    { label: "CoFHE Architecture", url: "https://docs.fhenix.io/docs/devdocs/CoFHE/overview" },
    { label: "FHE Primitives", url: "https://docs.fhenix.io/docs/devdocs/Writing%20Smart%20Contracts/fhe-sol" }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number */}
      <div className="absolute top-32 left-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        08
      </div>

      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-[#0AD9DC]/10 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            Technical Specifications
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Infrastructure
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Details
            </span>
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Specs table */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <GlassCard accentColor="green" sectionNumber="01" className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">System Specifications</h3>
              
              <div className="space-y-4">
                {specs.map((spec, index) => (
                  <div key={index} className="flex justify-between items-start gap-4 pb-4 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600 font-mono">{spec.label}</span>
                    <span className="text-sm text-gray-900 font-medium text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassCard accentColor="purple" sectionNumber="02" className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Developer Resources</h3>
              
              <div className="space-y-3">
                {resources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-4 p-4 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-purple-500/30 transition-all group/link"
                  >
                    <span className="text-sm text-gray-900 font-medium">{resource.label}</span>
                    <ExternalLink className="w-4 h-4 text-gray-600 group-hover/link:text-purple-500 transition-colors" />
                  </a>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative p-12 border-2 border-cyan-500/30 rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent backdrop-blur-sm text-center overflow-hidden group"
        >
          {/* Animated glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Experience Confidential Lending
            </h3>
            <p className="text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] font-semibold">Walnut</span> Protocol is live on Arbitrum Sepolia testnet. Try encrypted borrowing, sealed-bid liquidations,
              and private credit scoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="px-8 py-4 bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] text-black font-semibold rounded-full hover:shadow-[0_0_30px_rgba(10,217,220,0.3)] transition-all"
              >
                Launch App
              </Link>
              <a
                href="https://github.com/Iam-jayant/walnut"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-gray-100 text-gray-900 font-semibold rounded-full border border-white/20 hover:bg-white/20 transition-all"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


