"use client";

import { useState } from "react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsTopNav } from "@/components/docs/docs-top-nav";

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbfbfa] text-black">
      <div className="pointer-events-none fixed inset-0 opacity-[0.45]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,200,0.13),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(0,0,0,0.05),transparent_28%)]" />
      </div>

      <section className="relative border-b border-black/10 bg-white/75 pt-32">
        <div className="mx-auto max-w-7xl px-6 pb-14 text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-black/40">
            Protocol reference
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Walnut <span className="text-[#22d3c8]">Docs</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-black/60">
            Smart contracts, FHE architecture, security model, and implementation guides for private credit on-chain.
          </p>
        </div>
      </section>

      <DocsTopNav
        activeDoc={activeDoc}
        setActiveDoc={setActiveDoc}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <DocsSidebar
          activeDoc={activeDoc}
          setActiveDoc={setActiveDoc}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        
        <main className="min-w-0 overflow-hidden py-10 lg:border-l lg:border-black/10 lg:pl-12">
          <DocsContent activeDoc={activeDoc} />
        </main>
      </div>
    </div>
  );
}
