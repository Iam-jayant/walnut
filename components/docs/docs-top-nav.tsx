"use client";

import {
  BookOpen,
  FileCode,
  Layers,
  Rocket,
  Search,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocsTopNavProps {
  activeDoc: string;
  setActiveDoc: (doc: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const navItems = [
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "fhe-explainer", label: "FHE Explainer", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "security", label: "Security", icon: Shield },
  { id: "contracts", label: "Smart Contracts", icon: FileCode },
  { id: "user-guide", label: "User Guide", icon: User },
];

export function DocsTopNav({
  activeDoc,
  setActiveDoc,
  searchQuery,
  setSearchQuery,
}: DocsTopNavProps) {
  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sticky top-24 z-30 overflow-hidden border-b border-black/10 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto lg:w-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeDoc === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveDoc(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-all",
                  isActive
                    ? "border-[#22d3c8] text-black"
                    : "border-transparent text-black/50 hover:text-black"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="relative w-full lg:w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 w-full rounded-lg border border-black/10 bg-white pl-10 pr-20 text-sm text-black shadow-sm outline-none transition-all placeholder:text-black/35 focus:border-[#22d3c8]/60 focus:ring-4 focus:ring-[#22d3c8]/10"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-black/10 bg-[#f5f5f4] px-2 py-1 text-[10px] font-semibold text-black/35">
            Ctrl K
          </kbd>
        </div>
      </div>
    </div>
  );
}
