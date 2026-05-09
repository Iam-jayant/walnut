"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Cpu } from "lucide-react";
import { GlassCard, CardIcon, CardTitle } from "./ui/GlassCard";

export function ArchitectureOverview() {
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

  const layers = [
    {
      icon: Shield,
      title: "Client-Side Encryption",
      description: "All sensitive values encrypted before leaving user's wallet using Fhenix SDK",
      tech: ["fhenixjs", "InEuint128", "Permit Signatures"],
      color: "green" as const
    },
    {
      icon: Cpu,
      title: "FHE Computation Layer",
      description: "Smart contracts execute operations on encrypted data without decryption",
      tech: ["FHE.add", "FHE.sub", "FHE.mul", "FHE.div", "FHE.select"],
      color: "purple" as const
    },
    {
      icon: Lock,
      title: "CoFHE Coprocessor",
      description: "Selective decryption through secure callbacks for protocol-critical decisions",
      tech: ["FHE.requestDecrypt", "onlyCoFHE", "Async Callbacks"],
      color: "blue" as const
    }
  ];

  return (
    <section ref={sectionRef} className="relative py-32 overflow-hidden">
      {/* Section number background */}
      <div className="absolute top-32 left-12 text-[280px] font-bold text-gray-900 opacity-[0.02] pointer-events-none select-none">
        02
      </div>

      {/* Radial glow */}
      <div className="absolute top-1/2 right-0 w-[800px] h-[800px] bg-[#0AD9DC]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider text-[#0AD9DC] border border-[#0AD9DC]/20 rounded-full">
            System Architecture
          </div>
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Three-Layer
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB]">
              Confidential Stack
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            Walnut's architecture ensures that sensitive financial data never exists in plaintext on-chain,
            while maintaining full protocol functionality through encrypted computation.
          </p>
        </motion.div>

        {/* Architecture layers */}
        <div className="space-y-6">
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -20 }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
              >
                {/* Connector line */}
                {index < layers.length - 1 && (
                  <div className="absolute left-12 top-full w-px h-6 bg-gradient-to-b from-white/20 to-transparent z-10" />
                )}

                <GlassCard accentColor={layer.color} sectionNumber={`0${index + 1}`} className="p-8">
                  <div className="flex items-start gap-6">
                    {/* Icon */}
                    <CardIcon icon={Icon} accentColor={layer.color} />

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 flex items-center gap-3">
                        <CardTitle accentColor={layer.color}>{layer.title}</CardTitle>
                      </h3>
                      <p className="text-gray-600 mb-4 leading-relaxed">{layer.description}</p>
                      
                      {/* Tech tags */}
                      <div className="flex flex-wrap gap-2">
                        {layer.tech.map((tech, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 text-xs font-mono bg-gray-100 border border-gray-200 rounded-md text-gray-700"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
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


