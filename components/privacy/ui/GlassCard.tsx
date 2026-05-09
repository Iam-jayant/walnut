import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  accentColor?: "orange" | "green" | "purple" | "blue" | "red";
  sectionNumber?: string;
}

export function GlassCard({ children, className, accentColor = "orange", sectionNumber }: GlassCardProps) {
  const accentColors = {
    orange: {
      border: "group-hover:border-cyan-500/30",
      bg: "group-hover:bg-cyan-500/5",
      glow: "from-orange-500/5",
      icon: "group-hover:bg-cyan-50 group-hover:text-[#0AD9DC] group-hover:border-cyan-500/30"
    },
    green: {
      border: "group-hover:border-green-500/30",
      bg: "group-hover:bg-green-500/5",
      glow: "from-green-500/5",
      icon: "group-hover:bg-green-100 group-hover:text-green-500 group-hover:border-green-500/30"
    },
    purple: {
      border: "group-hover:border-purple-500/30",
      bg: "group-hover:bg-purple-500/5",
      glow: "from-purple-500/5",
      icon: "group-hover:bg-purple-100 group-hover:text-purple-500 group-hover:border-purple-500/30"
    },
    blue: {
      border: "group-hover:border-blue-500/30",
      bg: "group-hover:bg-blue-500/5",
      glow: "from-blue-500/5",
      icon: "group-hover:bg-blue-100 group-hover:text-blue-500 group-hover:border-blue-500/30"
    },
    red: {
      border: "group-hover:border-red-500/30",
      bg: "group-hover:bg-red-500/5",
      glow: "from-red-500/5",
      icon: "group-hover:bg-red-500/20 group-hover:text-red-400 group-hover:border-red-500/30"
    }
  };

  const colors = accentColors[accentColor];

  return (
    <div className={cn(
      "relative overflow-hidden group",
      "border border-gray-200 rounded-xl",
      "bg-white shadow-sm",
      "transition-all duration-500",
      "[clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]",
      colors.border,
      colors.bg,
      className
    )}>
      {/* Section number */}
      {sectionNumber && (
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none">
          <span className="text-8xl font-bold font-mono text-gray-900">{sectionNumber}</span>
        </div>
      )}

      {/* Gradient overlay on hover */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br to-transparent rounded-xl",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        colors.glow
      )} />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function CardIcon({ icon: Icon, accentColor = "orange" }: { icon: any; accentColor?: "orange" | "green" | "purple" | "blue" | "red" }) {
  const colors = {
    orange: "group-hover:bg-cyan-50 group-hover:text-[#0AD9DC] group-hover:border-cyan-500/30",
    green: "group-hover:bg-green-100 group-hover:text-green-500 group-hover:border-green-500/30",
    purple: "group-hover:bg-purple-100 group-hover:text-purple-500 group-hover:border-purple-500/30",
    blue: "group-hover:bg-blue-100 group-hover:text-blue-500 group-hover:border-blue-500/30",
    red: "group-hover:bg-red-500/20 group-hover:text-red-400 group-hover:border-red-500/30"
  };

  return (
    <span className={cn(
      "w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center",
      "text-gray-600 border border-gray-200",
      "transition-all duration-500",
      "[clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]",
      colors[accentColor]
    )}>
      <Icon className="w-5 h-5" strokeWidth={2} />
    </span>
  );
}

export function CardTitle({ children, accentColor = "orange" }: { children: ReactNode; accentColor?: "orange" | "green" | "purple" | "blue" | "red" }) {
  const gradients = {
    orange: "from-[#0AD9DC] via-cyan-300 to-[#00B8BB]",
    green: "from-green-400 via-emerald-300 to-green-500",
    purple: "from-purple-400 via-violet-300 to-purple-500",
    blue: "from-blue-400 via-cyan-300 to-blue-500",
    red: "from-red-400 via-rose-300 to-red-500"
  };

  return (
    <span className="relative">
      <span className={cn(
        "absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        gradients[accentColor]
      )} aria-hidden="true">
        {children}
      </span>
      <span className="group-hover:opacity-0 transition-opacity duration-500">
        {children}
      </span>
    </span>
  );
}


