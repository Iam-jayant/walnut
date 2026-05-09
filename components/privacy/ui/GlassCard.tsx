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
      border: "group-hover:border-orange-500/30",
      bg: "group-hover:bg-orange-500/5",
      glow: "from-orange-500/5",
      icon: "group-hover:bg-orange-500/20 group-hover:text-orange-400 group-hover:border-orange-500/30"
    },
    green: {
      border: "group-hover:border-green-500/30",
      bg: "group-hover:bg-green-500/5",
      glow: "from-green-500/5",
      icon: "group-hover:bg-green-500/20 group-hover:text-green-400 group-hover:border-green-500/30"
    },
    purple: {
      border: "group-hover:border-purple-500/30",
      bg: "group-hover:bg-purple-500/5",
      glow: "from-purple-500/5",
      icon: "group-hover:bg-purple-500/20 group-hover:text-purple-400 group-hover:border-purple-500/30"
    },
    blue: {
      border: "group-hover:border-blue-500/30",
      bg: "group-hover:bg-blue-500/5",
      glow: "from-blue-500/5",
      icon: "group-hover:bg-blue-500/20 group-hover:text-blue-400 group-hover:border-blue-500/30"
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
      "border border-white/5 rounded-2xl",
      "bg-black/40 backdrop-blur-sm",
      "transition-all duration-500",
      colors.border,
      colors.bg,
      className
    )}>
      {/* Section number */}
      {sectionNumber && (
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none select-none">
          <span className="text-8xl font-bold font-mono text-white">{sectionNumber}</span>
        </div>
      )}

      {/* Gradient overlay on hover */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br to-transparent rounded-2xl",
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
    orange: "group-hover:bg-orange-500/20 group-hover:text-orange-400 group-hover:border-orange-500/30",
    green: "group-hover:bg-green-500/20 group-hover:text-green-400 group-hover:border-green-500/30",
    purple: "group-hover:bg-purple-500/20 group-hover:text-purple-400 group-hover:border-purple-500/30",
    blue: "group-hover:bg-blue-500/20 group-hover:text-blue-400 group-hover:border-blue-500/30",
    red: "group-hover:bg-red-500/20 group-hover:text-red-400 group-hover:border-red-500/30"
  };

  return (
    <span className={cn(
      "w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center",
      "text-white/70 border border-white/5",
      "transition-all duration-500",
      colors[accentColor]
    )}>
      <Icon className="w-5 h-5" strokeWidth={2} />
    </span>
  );
}

export function CardTitle({ children, accentColor = "orange" }: { children: ReactNode; accentColor?: "orange" | "green" | "purple" | "blue" | "red" }) {
  const gradients = {
    orange: "from-orange-400 via-orange-300 to-orange-500",
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
