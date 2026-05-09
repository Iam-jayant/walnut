"use client";

import { useEffect, useState } from "react";

export function PageLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsLoading(false), 300);
          return 100;
        }
        return prev + 10;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center transition-opacity duration-300"
         style={{ opacity: progress === 100 ? 0 : 1 }}>
      <div className="text-center">
        {/* Logo/Brand */}
        <h1 className="text-4xl font-sans font-semibold mb-8 text-black">Walnut</h1>
        
        {/* Progress Bar */}
        <div className="w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#0AD9DC] to-[#00B8BB] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Loading Text */}
        <p className="mt-4 text-xs text-gray-500 font-mono">
          Loading encrypted protocol...
        </p>
      </div>
    </div>
  );
}
