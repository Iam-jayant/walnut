"use client";

import { ExternalLink, BookOpen, TrendingUp } from "lucide-react";

const PROBLEM_CARDS = [
  // Row 1 — Reddit Cards
  {
    sub: "r/ethfinance",
    user: "u/0xAnon_Trader",
    title: "My liquidation was frontrun by a bot that watched my health factor",
    content: "I was at 1.08 health factor on Aave. Before I could add collateral, a bot liquidated me at max penalty. It had been watching my position for days. Is there any way to borrow without your risk level being public?",
    type: "reddit"
  },
  {
    sub: "r/defi",
    user: "u/InstitutionalDesk",
    title: "Can a counterparty see my full collateral position on Aave?",
    content: "We're evaluating on-chain lending for a fund. The problem is our entire collateral stack would be publicly visible. Competitors could see our leverage. Compliance won't allow it. Is there any private alternative?",
    type: "reddit"
  },
  {
    sub: "r/UniSwap",
    user: "u/whale_watcher",
    title: "How to hide your borrowing position from other traders?",
    content: "Every time I take a large borrow, someone seems to know my liquidation threshold and pushes the price there. It's not paranoia — my wallet is public and my health factor is readable by anyone.",
    type: "reddit"
  },
  {
    sub: "r/CryptoCurrency",
    user: "u/DeFi_Lurker",
    title: "DeFi lending is basically broadcasting your financial life to the entire chain",
    content: "Your collateral, your debt, your risk tolerance, your repayment history — all of it is public. Every analytics tool can profile you. This is the opposite of financial privacy.",
    type: "reddit"
  },
  // Row 2 — Research + DeFi Community
  {
    sub: "ArXiv",
    user: "Academic",
    title: "Quantifying MEV in DeFi Lending Protocols",
    content: "Research documents over $500M extracted from DeFi users through liquidation MEV. Transparent health factors allow bots to calculate exact liquidation points and execute with precision timing, extracting maximum penalty from borrowers.",
    type: "research"
  },
  {
    sub: "ArXiv",
    user: "Academic",
    title: "On the Privacy of DeFi Position Data",
    content: "Public on-chain state exposes complete borrower profiles — collateral composition, debt levels, and repayment behaviour. Combined with address clustering, this enables complete financial deanonymization of DeFi participants.",
    type: "research"
  },
  {
    sub: "Fhenix Research",
    user: "Technical",
    title: "Why Institutions Won't Touch Transparent Lending Rails",
    content: "Compliance frameworks prohibit deployment of risk books on public infrastructure. Transparent collateral positions create legal, competitive, and regulatory exposure. FHE-based lending is the only viable path for institutional on-chain credit.",
    type: "research"
  },
  {
    sub: "DeFi Pulse",
    user: "Analysis",
    title: "$2.3B in institutional capital seeking private lending rails",
    content: "Funds and family offices are actively evaluating on-chain lending but cannot proceed on transparent protocols. The demand for encrypted lending infrastructure is documented and unmet.",
    type: "research"
  },
];

const PALETTE = [
  { bg: 'bg-cyan-500/8', text: 'text-cyan-600', border: 'border-cyan-500/15', hover: 'hover:border-cyan-500/30' },
  { bg: 'bg-blue-500/8', text: 'text-blue-600', border: 'border-blue-500/15', hover: 'hover:border-blue-500/30' },
  { bg: 'bg-indigo-500/8', text: 'text-indigo-600', border: 'border-indigo-500/15', hover: 'hover:border-indigo-500/30' },
  { bg: 'bg-violet-500/8', text: 'text-violet-600', border: 'border-violet-500/15', hover: 'hover:border-violet-500/30' },
  { bg: 'bg-purple-500/8', text: 'text-purple-600', border: 'border-purple-500/15', hover: 'hover:border-purple-500/30' },
  { bg: 'bg-slate-500/8', text: 'text-slate-600', border: 'border-slate-500/15', hover: 'hover:border-slate-500/30' },
];

function getCardColors(index: number) {
  return PALETTE[index % PALETTE.length];
}

const PlatformIcon = ({ type, className }: { type: string; className?: string }) => {
  if (type === "reddit") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    );
  }
  if (type === "research") {
    return <BookOpen className={className} />;
  }
  return <TrendingUp className={className} />;
};

export function ProblemSection() {
  return (
    <section id="product" className="relative pt-12 pb-24 overflow-hidden bg-[#f5f5f7]">
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 lg:px-10">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-white/80 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0AD9DC] shadow-[0_0_12px_rgba(10,217,220,0.8)]" />
            <span className="h-px w-8 bg-foreground/30" />
            THE PROBLEM
          </div>
          <h2 className="text-[clamp(2rem,3.5vw,3.5rem)] leading-[1.1] tracking-tight font-sans font-semibold">
            Public Ledgers <span className="italic font-normal text-[#0AD9DC]">Expose</span> Your <span className="italic font-normal text-[#0AD9DC]">Positions</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto font-sans">
            Every borrow broadcasts your collateral, debt, health factor, and liquidation threshold to every MEV bot on the network.
          </p>
        </div>

        {/* Row 1 — Forward Scroll */}
        <div
          className="relative flex overflow-hidden group w-full mb-4"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          }}
        >
          <div className="flex animate-[scroll_80s_linear_infinite] group-hover:[animation-play-state:paused] w-max gap-4 px-2">
            {[...Array(2)].map((_, arrayIndex) => (
              <div key={arrayIndex} className="flex gap-4">
                {PROBLEM_CARDS.slice(0, 4).map((card, i) => {
                  const colors = getCardColors(i);
                  return (
                    <div
                      key={`r1-${arrayIndex}-${i}`}
                      className={`relative group/card w-[340px] shrink-0 overflow-hidden rounded-2xl bg-white border ${colors.border} ${colors.hover} transition-all duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]`}
                    >
                      {/* Top accent line */}
                      <div className={`absolute top-0 left-0 right-0 h-[2px] ${colors.bg} opacity-0 group-hover/card:opacity-100 transition-opacity duration-500`} />

                      <div className="relative p-5 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                              <PlatformIcon type={card.type} className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div>
                              <div className={`font-bold text-[13px] ${colors.text}`}>{card.sub}</div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{card.user}</div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/card:text-muted-foreground transition-colors" />
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-[14px] leading-snug text-foreground mb-2.5 line-clamp-2">
                          {card.title}
                        </h3>

                        {/* Body */}
                        <p className="text-[12.5px] leading-relaxed text-muted-foreground line-clamp-4 flex-grow">
                          {card.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 — Reverse Scroll */}
        <div
          className="relative flex overflow-hidden group w-full"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          }}
        >
          <div className="flex animate-[scroll-reverse_90s_linear_infinite] group-hover:[animation-play-state:paused] w-max gap-4 px-2">
            {[...Array(2)].map((_, arrayIndex) => (
              <div key={arrayIndex} className="flex gap-4">
                {PROBLEM_CARDS.slice(4).map((card, i) => {
                  const colors = getCardColors(i + 4);
                  return (
                    <div
                      key={`r2-${arrayIndex}-${i}`}
                      className={`relative group/card w-[340px] shrink-0 overflow-hidden rounded-2xl bg-white border ${colors.border} ${colors.hover} transition-all duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]`}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-[2px] ${colors.bg} opacity-0 group-hover/card:opacity-100 transition-opacity duration-500`} />

                      <div className="relative p-5 flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                              <PlatformIcon type={card.type} className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div>
                              <div className={`font-bold text-[13px] ${colors.text}`}>{card.sub}</div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{card.user}</div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover/card:text-muted-foreground transition-colors" />
                        </div>

                        <h3 className="font-bold text-[14px] leading-snug text-foreground mb-2.5 line-clamp-2">
                          {card.title}
                        </h3>

                        <p className="text-[12.5px] leading-relaxed text-muted-foreground line-clamp-4 flex-grow">
                          {card.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-reverse {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
