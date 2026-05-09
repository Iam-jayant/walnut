"use client";

import { useState, useEffect } from "react";

const metrics = [
  {
    label: "Public liquidation bots monitor every wallet",
    highlight: "every wallet"
  },
  {
    label: "$12.4 billion liquidated annually across DeFi",
    highlight: "$12.4 billion"
  },
  {
    label: "Every borrow position is fully visible on traditional DeFi",
    highlight: "fully visible"
  },
  {
    label: "MEV bots extract value from transparent liquidations",
    highlight: "MEV bots"
  },
  {
    label: "Your collateral ratio is public information",
    highlight: "public information"
  },
  {
    label: "Liquidators compete on speed, not fairness",
    highlight: "speed, not fairness"
  }
];

export function MetricsStrip() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Delay animation start for better performance
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative bg-black py-3 overflow-hidden border-y border-white/10">
      {/* Gradient overlays for fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
      
      {/* Label with glow effect - hidden on mobile */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 hidden sm:block">
        <span className="text-xs font-mono uppercase tracking-wider text-white bg-black pr-4 font-semibold" style={{
          textShadow: '0 0 10px rgba(10, 217, 220, 0.6), 0 0 20px rgba(10, 217, 220, 0.4), 0 0 30px rgba(10, 217, 220, 0.2)'
        }}>
          Why This Matters
        </span>
      </div>

      {/* Scrolling content - duplicate for seamless loop */}
      <div className={`flex transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex animate-scroll-left will-change-transform">
          {/* First set */}
          <div className="flex gap-8 md:gap-12 px-8 md:px-12 flex-shrink-0 pl-4 sm:pl-48">
            {metrics.map((metric, index) => (
              <div key={`first-${index}`} className="flex items-center gap-2 md:gap-3 whitespace-nowrap">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#0AD9DC] flex-shrink-0"></div>
                <span className="text-xs md:text-sm text-gray-400">
                  {metric.label.split(metric.highlight)[0]}
                  <span className="text-white font-semibold">{metric.highlight}</span>
                  {metric.label.split(metric.highlight)[1]}
                </span>
              </div>
            ))}
          </div>
          
          {/* Second set - duplicate for seamless loop */}
          <div className="flex gap-8 md:gap-12 px-8 md:px-12 flex-shrink-0">
            {metrics.map((metric, index) => (
              <div key={`second-${index}`} className="flex items-center gap-2 md:gap-3 whitespace-nowrap">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#0AD9DC] flex-shrink-0"></div>
                <span className="text-xs md:text-sm text-gray-400">
                  {metric.label.split(metric.highlight)[0]}
                  <span className="text-white font-semibold">{metric.highlight}</span>
                  {metric.label.split(metric.highlight)[1]}
                </span>
              </div>
            ))}
          </div>

          {/* Third set - for extra smoothness */}
          <div className="flex gap-8 md:gap-12 px-8 md:px-12 flex-shrink-0">
            {metrics.map((metric, index) => (
              <div key={`third-${index}`} className="flex items-center gap-2 md:gap-3 whitespace-nowrap">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-[#0AD9DC] flex-shrink-0"></div>
                <span className="text-xs md:text-sm text-gray-400">
                  {metric.label.split(metric.highlight)[0]}
                  <span className="text-white font-semibold">{metric.highlight}</span>
                  {metric.label.split(metric.highlight)[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .animate-scroll-left {
          animation: scroll-left 40s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-scroll-left {
            animation: scroll-left 60s linear infinite;
          }
        }

        .animate-scroll-left:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
