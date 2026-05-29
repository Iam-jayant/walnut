"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface WaveEntry {
  id: number;
  label: string;       // "Release 1", "Release 2" ... "Release 5"
  tag: string;         // e.g. "Ideation", "Core lending"
  heading: string;
  body: string;
  features: string[];
}

const waves: WaveEntry[] = [
  {
    id: 1,
    label: "Release 1",
    tag: "Ideation",
    heading: "Core concept validated. Encrypted pipeline working end-to-end.",
    body: "Built a working prototype with a complete encrypted data flow — inputs encrypted in browser, encrypted state stored on-chain, decrypted locally via permit-based access.",
    features: [
      "CoFHE smart contract with encrypted types",
      "Wallet connection and network handling",
      "Permit-based access control for decryption",
      "Dashboard, deposit, borrow, demo flows",
      "UI states for network mismatch and permit status"
    ]
  },
  {
    id: 2,
    label: "Release 2",
    tag: "Core lending",
    heading: "Complete private lending lifecycle. On-chain constraints enforced.",
    body: "Moved from prototype to a full private lending flow with stronger on-chain logic and better reliability.",
    features: [
      "Full cycle: deposit, borrow, repay, withdraw",
      "LTV checks enforced in contract, not just UI",
      "Encrypted health factor with permit-based view",
      "Sealed-bid liquidation auction scaffold",
      "ENS multi-wallet collateral aggregation"
    ]
  },
  {
    id: 3,
    label: "Release 3",
    tag: "Advanced FHE",
    heading: "Five FHE primitives. None of them possible on transparent rails.",
    body: "Complete rewrite on Arbitrum Sepolia with full async decrypt architecture and onlyCoFHE callback guards throughout.",
    features: [
      "Encrypted credit scoring — 5-tier, 70–90% LTV",
      "Sealed-bid auctions via FHE.select — bids never surface",
      "P2P lending — terms hidden until match",
      "ENS wallet aggregation without on-chain links",
      "All callbacks guarded by onlyCoFHE"
    ]
  },
  {
    id: 4,
    label: "Release 4",
    tag: "Real tokens",
    heading: "Real ERC20 collateral. FHERC20 stablecoin. Privara settlement.",
    body: "The protocol now handles real economic value. Every number is denominated in actual USD via Chainlink.",
    features: [
      "ERC20 deposits with Chainlink price feeds",
      "cUSDC — FHERC20 encrypted stablecoin on borrow",
      "On-chain interest accrual at 8% APR",
      "Privara private settlement — two Arbiscan tx, zero amounts"
    ]
  },
  {
    id: 5,
    label: "Release 5",
    tag: "Production",
    heading: "Concurrent loans. Full protocol. Reentrancy-proof contract.",
    body: "The protocol is complete. Multiple concurrent loans per user, full security hardening, and a production-grade interface.",
    features: [
      "Concurrent multi-loan support — borrow multiple times",
      "Per-loan repayment — target any loan by index",
      "ReentrancyGuard on all state-mutating functions",
      "Position guard — encrypted stop-loss threshold",
      "Auditor permits — selective pool disclosure",
      "P2P encrypted terms with real FHE SDK",
      "Onboarding flow — permit explainer, empty states",
      "Full docs: architecture, security, user guide"
    ]
  }
];

export function WaveChangelog() {
  const router = useRouter();
  const [active, setActive] = useState(5);   // default to Wave 5
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seenSession = sessionStorage.getItem("walnut-changelog-seen");
    const seenLocal = localStorage.getItem("walnut-changelog-seen");
    if (!seenSession && !seenLocal) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("walnut-changelog-seen", "1");
    if (dontShowAgain) {
      localStorage.setItem("walnut-changelog-seen", "1");
    }
    setVisible(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      dismiss();
    }
  };

  const handleUseApp = () => {
    dismiss();
    router.push("/app");
  };

  if (!visible) return null;

  const currentWave = waves.find((w) => w.id === active) || waves[4];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-[4px] p-4 animate-fade-in"
      style={{
        fontFamily: "monospace"
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[640px] bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-5.5 h-5.5 bg-slate-900 rounded-[4px] flex items-center justify-center font-bold text-white text-[10px] leading-none">
              W
            </div>
            <span className="text-slate-800 text-[13px] font-semibold tracking-[0.06em] uppercase">
              Walnut
            </span>
            <span className="text-slate-700 bg-slate-100 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-[4px] tracking-[0.08em] leading-none uppercase">
              v5 — latest
            </span>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full border border-slate-200 bg-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all flex items-center justify-center text-lg leading-none cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="flex flex-col sm:flex-row min-h-[340px]">
          {/* TIMELINE COLUMN */}
          <div className="w-full sm:w-[160px] border-b sm:border-b-0 sm:border-r border-slate-150 py-5 px-4 bg-slate-50/60 flex flex-row sm:flex-col justify-around sm:justify-start gap-4">
            {waves.map((wave, index) => {
              const isActiveWave = wave.id === active;
              return (
                <div
                  key={wave.id}
                  onClick={() => setActive(wave.id)}
                  className="group flex items-center gap-3 cursor-pointer relative select-none"
                >
                  {/* VERTICAL LINE (Desktop only) */}
                  {index < waves.length - 1 && (
                    <div className="hidden sm:block absolute left-[4.5px] top-[14px] bottom-[-24px] w-[1px] bg-slate-200 z-0" />
                  )}
                  {/* SQUARE DOT */}
                  <div
                    className={`w-[10px] h-[10px] rounded-[2px] border flex-shrink-0 z-10 transition-all duration-150 ${
                      isActiveWave
                        ? "bg-slate-900 border-slate-900 shadow-sm"
                        : "bg-white border-slate-350 group-hover:border-slate-500"
                    }`}
                  />
                  {/* LABEL */}
                  <span
                    className={`text-[12px] transition-colors duration-150 ${
                      isActiveWave
                        ? "text-slate-950 font-bold"
                        : "text-slate-450 group-hover:text-slate-700"
                    }`}
                  >
                    {wave.label} {isActiveWave && "←"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* CONTENT COLUMN */}
          <div className="flex-1 p-6 flex flex-col justify-between bg-white">
            {/* Scrollable area */}
            <div
              className="max-h-[340px] overflow-y-auto pr-2 space-y-4"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#e2e8f0 transparent"
              }}
            >
              {/* Custom Scrollbar Styles for Webkit */}
              <style>{`
                .max-h-\\[340px\\]::-webkit-scrollbar {
                  width: 3px;
                }
                .max-h-\\[340px\\]::-webkit-scrollbar-track {
                  background: transparent;
                }
                .max-h-\\[340px\\]::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 2px;
                }
              `}</style>

              <div>
                <div className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.12em] mb-2 font-semibold">
                  {currentWave.tag}
                </div>
                <h3 className="text-slate-900 text-[16px] font-bold leading-snug mb-3">
                  {currentWave.heading}
                </h3>
                <p className="text-slate-600 text-[12px] leading-relaxed font-sans mb-4">
                  {currentWave.body}
                </p>
                <ul className="space-y-2">
                  {currentWave.features.map((feature, i) => (
                    <li
                      key={i}
                      className="text-slate-600 text-[12px] pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-slate-400 font-sans"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Wave 5 Closing Quote */}
              {active === 5 && (
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <p className="text-slate-400 text-[11px] italic font-sans">
                    "Aave proved lending works on-chain. Walnut proves it works without anyone seeing anything."
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span className="text-slate-400 text-[11px] font-mono whitespace-nowrap">
              Arbitrum Sepolia · Fhenix CoFHE
            </span>
            {/* DO NOT SHOW AGAIN TOGGLE */}
            <label className="flex items-center gap-2 text-[11px] cursor-pointer text-slate-500 select-none hover:text-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 accent-slate-900 bg-white border border-slate-300 rounded cursor-pointer"
              />
              Do not show again
            </label>
          </div>

          <button
            onClick={handleUseApp}
            className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 text-white font-medium px-4 py-1.5 rounded-[5px] text-[12px] tracking-[0.04em] transition-all cursor-pointer whitespace-nowrap text-center"
          >
            Open app →
          </button>
        </div>
      </div>
    </div>
  );
}
