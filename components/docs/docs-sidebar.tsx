"use client";

import { BookOpen, FileCode, Layers, Rocket, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocsSidebarProps {
  activeDoc: string;
  setActiveDoc: (doc: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const docSections = [
  {
    title: "Overview",
    items: [{ id: "getting-started", label: "Getting Started", icon: Rocket }],
  },
  {
    title: "Core Concepts",
    items: [
      { id: "fhe-explainer", label: "FHE Explainer", icon: BookOpen },
      { id: "architecture", label: "Architecture", icon: Layers },
      { id: "security", label: "Security", icon: Shield },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "contracts", label: "Smart Contracts", icon: FileCode },
      { id: "user-guide", label: "User Guide", icon: User },
    ],
  },
];

export function DocsSidebar({
  activeDoc,
  setActiveDoc,
  searchQuery,
  setSearchQuery,
}: DocsSidebarProps) {
  const filteredSections = docSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-44 max-h-[calc(100vh-12rem)] overflow-y-auto py-10 pr-8">
        {filteredSections.length > 0 ? (
          <nav className="space-y-9">
            {filteredSections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-black/35">
                  {section.title}
                </h2>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeDoc === item.id;

                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveDoc(item.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm font-medium transition-all",
                            isActive
                              ? "border-[#22d3c8] bg-white text-black shadow-sm"
                              : "border-transparent text-black/55 hover:bg-white/70 hover:text-black"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              isActive ? "text-[#22d3c8]" : "text-black/35"
                            )}
                          />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        ) : (
          <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/55 shadow-sm">
            <p>No docs match that search.</p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-3 font-semibold text-[#159c94] hover:text-black"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
