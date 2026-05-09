"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowRight } from "lucide-react";

export function FeaturesSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const rafRef = useRef<number>();

  // Throttle mouse move for better performance
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Store values before async callback
    const clientX = e.clientX;
    const clientY = e.clientY;
    const target = e.currentTarget;

    rafRef.current = requestAnimationFrame(() => {
      if (!target) return;
      
      const rect = target.getBoundingClientRect();
      setMousePosition({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    });
  }, []);
  const features = [
    {
      title: "Encrypted Computation",
      description: "Smart contracts process encrypted data without exposing underlying values."
    },
    {
      title: "Confidential Smart Contracts",
      description: "Application logic, balances, and user interactions remain private by default."
    },
    {
      title: "Selective Decryption",
      description: "Only authorized users or systems can reveal outputs when necessary."
    },
    {
      title: "Cross-Chain Confidentiality",
      description: "Designed to integrate with Ethereum, Arbitrum, Base, and other EVM ecosystems."
    }
  ];

  return (
    <section 
      className="relative bg-black py-24 text-white overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Cursor tracking white blur - entire section */}
      {isHovering && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300 z-10"
          style={{
            left: mousePosition.x,
            top: mousePosition.y,
            width: '400px',
            height: '400px',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.20), transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      )}
      
      <div className="mx-auto max-w-7xl px-6 relative z-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left side - Content */}
          <div>
            {/* Small tag */}
            <div className="mb-6">
              <span className="inline-block px-3 py-1 text-xs font-mono uppercase tracking-wider text-gray-400 border border-gray-800 rounded-md">
                Architecture
              </span>
            </div>

            {/* Main heading */}
            <h2 className="text-4xl font-sans font-semibold mb-6 text-white">
              Powered by <span className="text-[#0AD9DC]">Fhenix</span>
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-400 leading-relaxed mb-12">
              Fhenix is <span className="font-semibold text-gray-300">confidential computation layer</span> for Ethereum using <span className="font-semibold text-gray-300">Fully Homomorphic Encryption (FHE)</span>. Instead of creating another isolated blockchain, Fhenix enables <span className="font-semibold text-gray-300">encrypted execution</span> across existing <span className="font-semibold text-gray-300">EVM ecosystems</span> through its <span className="font-semibold text-gray-300">CoFHE coprocessor architecture</span>.
            </p>

            {/* Features List as Glass Cards */}
            <div className="grid grid-cols-1 gap-4">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-5 transition-all duration-300 hover:bg-white/10 hover:border-white/20"
                >
                  <div className="flex gap-3">
                    {/* Cyan bullet dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#0AD9DC]"></div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-base font-semibold mb-2 text-white">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - FHE Flow Diagram */}
          <div className="flex items-center justify-center pt-12 pl-5">
            <div className="relative w-full max-w-md">
              {/* Flow diagram */}
              <div className="space-y-4">
                {/* Step 1: Encrypted Input */}
                <div>
                  <div className="bg-gradient-to-br from-[#0AD9DC]/10 to-transparent border border-[#0AD9DC]/30 rounded-lg p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 bg-[#0AD9DC] rounded-full animate-pulse"></div>
                      <span className="text-xs font-mono uppercase tracking-wider text-[#0AD9DC]">
                        Step 1
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                      Encrypted Input
                    </h4>
                    <p className="text-sm text-gray-400">
                      Data enters the system in encrypted form
                    </p>
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center py-2">
                  <ArrowRight className="w-6 h-6 text-[#0AD9DC] rotate-90" strokeWidth={2} />
                </div>

                {/* Step 2: FHE Computation */}
                <div>
                  <div className="bg-gradient-to-br from-[#0AD9DC]/20 to-transparent border-2 border-[#0AD9DC]/50 rounded-lg p-6 backdrop-blur-sm shadow-lg shadow-[#0AD9DC]/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 bg-[#0AD9DC] rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      <span className="text-xs font-mono uppercase tracking-wider text-[#0AD9DC]">
                        Step 2
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                      FHE Computation
                    </h4>
                    <p className="text-sm text-gray-400">
                      Processing happens on encrypted data without decryption
                    </p>
                    
                    {/* Animated processing indicator */}
                    <div className="mt-4 flex gap-1">
                      <div className="w-1 h-8 bg-[#0AD9DC]/30 rounded animate-pulse"></div>
                      <div className="w-1 h-8 bg-[#0AD9DC]/30 rounded animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-8 bg-[#0AD9DC]/30 rounded animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      <div className="w-1 h-8 bg-[#0AD9DC]/30 rounded animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                    </div>
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center py-2">
                  <ArrowRight className="w-6 h-6 text-[#0AD9DC] rotate-90" strokeWidth={2} />
                </div>

                {/* Step 3: Encrypted Output */}
                <div>
                  <div className="bg-gradient-to-br from-[#0AD9DC]/10 to-transparent border border-[#0AD9DC]/30 rounded-lg p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 bg-[#0AD9DC] rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      <span className="text-xs font-mono uppercase tracking-wider text-[#0AD9DC]">
                        Step 3
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                      Encrypted Output
                    </h4>
                    <p className="text-sm text-gray-400">
                      Results remain encrypted, preserving privacy
                    </p>
                  </div>
                </div>
              </div>

              {/* Background glow effect */}
              <div className="absolute inset-0 bg-[#0AD9DC]/5 blur-3xl -z-10 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
