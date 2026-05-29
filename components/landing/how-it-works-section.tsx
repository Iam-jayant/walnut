"use client";

import { useState } from "react";
import { Lock, Send, CheckCircle, FileText, Users, Gavel, TrendingUp, Wallet as WalletIcon } from "lucide-react";

type FlowType = "deposit" | "borrow" | "repay" | "p2p" | "liquidation" | "credit";

interface FlowStep {
  icon: any;
  title: string;
  description: string;
  phase: string;
}

interface Flow {
  id: FlowType;
  name: string;
  steps: FlowStep[];
}

const flows: Flow[] = [
  {
    id: "deposit",
    name: "Deposit",
    steps: [
      { 
        icon: Lock,
        title: "Client-Side Encryption", 
        description: "Your deposit amount is encrypted using FHE on the client before leaving your wallet.",
        phase: "PHASE 01"
      },
      { 
        icon: Send,
        title: "Submit Transaction", 
        description: "Encrypted collateral (InEuint128) is submitted to WalnutV1.deposit() function.",
        phase: "PHASE 02"
      },
      { 
        icon: CheckCircle,
        title: "Update Encrypted State", 
        description: "Contract increments your encrypted collateral balance and totalPoolCollateral using FHE.add.",
        phase: "PHASE 03"
      },
      { 
        icon: CheckCircle,
        title: "Grant Permission", 
        description: "FHE.allowThis() is called to grant contract permission to operate on encrypted values.",
        phase: "PHASE 04"
      }
    ]
  },
  {
    id: "borrow",
    name: "Borrow",
    steps: [
      { 
        icon: Lock,
        title: "Encrypt Borrow Amount", 
        description: "Loan amount is encrypted client-side. Your borrowing activity stays private.",
        phase: "PHASE 01"
      },
      { 
        icon: Send,
        title: "Submit Borrow Request", 
        description: "Encrypted amount submitted to WalnutV1.borrow(). Contract verifies LTV limits using encrypted operations.",
        phase: "PHASE 02"
      },
      { 
        icon: CheckCircle,
        title: "Update Debt Balance", 
        description: "Contract increments your encrypted debt balance and totalPoolDebt using FHE.add.",
        phase: "PHASE 03"
      },
      { 
        icon: CheckCircle,
        title: "Loan Disbursed", 
        description: "Funds transferred to your wallet. All position data remains encrypted on-chain.",
        phase: "PHASE 04"
      }
    ]
  },
  {
    id: "repay",
    name: "Repay",
    steps: [
      { 
        icon: FileText,
        title: "Enter Repayment Amount", 
        description: "Specify amount to repay. Value is encrypted client-side before request.",
        phase: "PHASE 01"
      },
      { 
        icon: Send,
        title: "Submit Repay Transaction", 
        description: "Encrypted amount submitted to WalnutV1.repay(). Contract decrements encrypted debt using FHE.sub.",
        phase: "PHASE 02"
      },
      { 
        icon: TrendingUp,
        title: "Update Repayment Count", 
        description: "Contract increments your encrypted repaymentCount (euint128) for credit scoring.",
        phase: "PHASE 03"
      },
      { 
        icon: CheckCircle,
        title: "Privara Settlement", 
        description: "Private interest settlement executed via Reineira SDK. Settlement tx hash recorded separately.",
        phase: "PHASE 04"
      }
    ]
  },
  {
    id: "p2p",
    name: "P2P Lending",
    steps: [
      { 
        icon: FileText,
        title: "Post Encrypted Offer", 
        description: "Lender encrypts APR, size, and tenor client-side. Terms submitted to WalnutV1.postOffer().",
        phase: "PHASE 01"
      },
      { 
        icon: Lock,
        title: "Grant Lender Permission", 
        description: "FHE.allow() grants lender read permission for their own encrypted terms. Terms invisible to others.",
        phase: "PHASE 02"
      },
      { 
        icon: Users,
        title: "Match Offer", 
        description: "Borrower calls WalnutV1.matchOffer(). Contract marks offer inactive and records borrower address.",
        phase: "PHASE 03"
      },
      { 
        icon: CheckCircle,
        title: "Grant Borrower Access", 
        description: "FHE.allow() grants borrower read permission. Only lender and borrower can decrypt terms.",
        phase: "PHASE 04"
      },
      { 
        icon: CheckCircle,
        title: "Private Settlement", 
        description: "Loan amount transferred via Privara. Terms remain encrypted to third parties forever.",
        phase: "PHASE 05"
      }
    ]
  },
  {
    id: "liquidation",
    name: "Liquidation",
    steps: [
      { 
        icon: FileText,
        title: "Request Liquidation Check", 
        description: "Liquidator calls WalnutV1.requestLiquidationCheck(). Contract computes encrypted health factor.",
        phase: "PHASE 01"
      },
      { 
        icon: Send,
        title: "FHE.requestDecrypt", 
        description: "Contract calls FHE.requestDecrypt() on health factor. Request ID stored and mapped to user.",
        phase: "PHASE 02"
      },
      { 
        icon: CheckCircle,
        title: "CoFHE Callback", 
        description: "onLiquidationResult() callback executed by CoFHE. If health < 1.05, liquidatable flag set to true.",
        phase: "PHASE 03"
      },
      { 
        icon: Gavel,
        title: "Sealed-Bid Auction", 
        description: "Liquidators submit encrypted bids via WalnutV1.submitBid(). All bids remain encrypted.",
        phase: "PHASE 04"
      },
      { 
        icon: Send,
        title: "Select Winner", 
        description: "WalnutV1.selectWinningBid() uses FHE.select to find minimum bid in ciphertext. Requests decrypt of winner index.",
        phase: "PHASE 05"
      },
      { 
        icon: CheckCircle,
        title: "Winner Callback", 
        description: "onWinnerSelected() reveals only winner address. Bid amounts stay encrypted forever.",
        phase: "PHASE 06"
      }
    ]
  },
  {
    id: "credit",
    name: "Credit Tier",
    steps: [
      { 
        icon: FileText,
        title: "Request Tier Update", 
        description: "User or protocol calls WalnutV1.requestCreditTierUpdate(). Initiates tier evaluation.",
        phase: "PHASE 01"
      },
      { 
        icon: Send,
        title: "Decrypt Repayment Count", 
        description: "Contract calls FHE.requestDecrypt() on encrypted repaymentCount. Request ID mapped to user.",
        phase: "PHASE 02"
      },
      { 
        icon: TrendingUp,
        title: "CoFHE Callback", 
        description: "onCreditCountDecrypted() receives count. Maps to tier: 0-1→T0, 2-3→T1, 4-6→T2, 7-9→T3, 10+→T4.",
        phase: "PHASE 03"
      },
      { 
        icon: CheckCircle,
        title: "Update LTV Limit", 
        description: "Public creditTier updated. TIER_LTV determines new borrowing capacity: T0=70%, T1=75%, T2=80%, T3=85%, T4=90%.",
        phase: "PHASE 04"
      }
    ]
  }
];

export function HowItWorksSection() {
  const [selectedFlow, setSelectedFlow] = useState<FlowType>("deposit");
  
  const currentFlow = flows.find(f => f.id === selectedFlow) || flows[0];

  return (
    <section className="relative bg-transparent py-24 text-black">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
              How It Works
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-sans font-semibold text-black mb-4">
            Protocol Flow
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Client-side encryption to CoFHE callbacks, every step documented with technical precision.
          </p>
        </div>

        {/* Flow Selector - Minimal Pills */}
        <div className="mb-16 flex justify-center overflow-x-auto pb-4">
          <div className="inline-flex gap-2 p-1 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/50">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => setSelectedFlow(flow.id)}
                className={`px-5 py-2 rounded-md font-medium text-sm transition-all duration-300 whitespace-nowrap ${
                  selectedFlow === flow.id
                    ? "bg-black text-white shadow-md"
                    : "text-gray-600 hover:text-black hover:bg-white/80"
                }`}
              >
                {flow.name}
              </button>
            ))}
          </div>
        </div>

        {/* Flow Steps - Responsive Grid */}
        {selectedFlow === "liquidation" ? (
          // Special two-tier layout for liquidation
          <div className="max-w-6xl mx-auto space-y-6">
            {/* First Row - 3 cards */}
            <div className="grid md:grid-cols-3 gap-6 relative">
              {currentFlow.steps.slice(0, 3).map((step, index) => {
                const Icon = step.icon;
                const isLastInRow = index === 2;
                
                return (
                  <div key={index} className="relative">
                    {/* Connecting Line - Horizontal */}
                    {!isLastInRow && (
                      <div className="hidden md:block absolute top-1/2 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-[#0AD9DC]/40 to-[#0AD9DC]/20 z-0 -translate-y-1/2"></div>
                    )}
                    
                    {/* Step Card - Glass Morphism */}
                    <div className="relative bg-white/70 backdrop-blur-xl border border-gray-200/60 rounded-xl p-6 text-center transition-all duration-300 hover:bg-white/90 hover:border-[#0AD9DC]/50 hover:shadow-lg h-full flex flex-col z-10">
                      {/* Icon */}
                      <div className="mb-4 flex justify-center">
                        <div className="w-14 h-14 rounded-full bg-gray-100/80 border border-gray-200/60 flex items-center justify-center backdrop-blur-sm">
                          <Icon className="w-7 h-7 text-black" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Phase Label */}
                      <div className="mb-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                          {step.phase}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-black mb-2">
                        {step.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-gray-600 leading-relaxed flex-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vertical Connector between rows */}
            <div className="flex justify-center">
              <div className="w-0.5 h-8 bg-gradient-to-b from-[#0AD9DC]/40 to-[#0AD9DC]/20"></div>
            </div>

            {/* Second Row - 3 cards */}
            <div className="grid md:grid-cols-3 gap-6 relative">
              {currentFlow.steps.slice(3, 6).map((step, index) => {
                const Icon = step.icon;
                const isLastInRow = index === 2;
                
                return (
                  <div key={index + 3} className="relative">
                    {/* Connecting Line - Horizontal */}
                    {!isLastInRow && (
                      <div className="hidden md:block absolute top-1/2 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-[#0AD9DC]/40 to-[#0AD9DC]/20 z-0 -translate-y-1/2"></div>
                    )}
                    
                    {/* Step Card - Glass Morphism */}
                    <div className="relative bg-white/70 backdrop-blur-xl border border-gray-200/60 rounded-xl p-6 text-center transition-all duration-300 hover:bg-white/90 hover:border-[#0AD9DC]/50 hover:shadow-lg h-full flex flex-col z-10">
                      {/* Icon */}
                      <div className="mb-4 flex justify-center">
                        <div className="w-14 h-14 rounded-full bg-gray-100/80 border border-gray-200/60 flex items-center justify-center backdrop-blur-sm">
                          <Icon className="w-7 h-7 text-black" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Phase Label */}
                      <div className="mb-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                          {step.phase}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-black mb-2">
                        {step.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-gray-600 leading-relaxed flex-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Standard single-row layout for other flows
          <div className={`grid gap-6 max-w-6xl mx-auto ${
            currentFlow.steps.length <= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 
            currentFlow.steps.length === 5 ? 'md:grid-cols-2 lg:grid-cols-5' : 
            'md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {currentFlow.steps.map((step, index) => {
              const Icon = step.icon;
              const isLastStep = index === currentFlow.steps.length - 1;
              
              return (
                <div key={index} className="relative">
                  {/* Connecting Line - Centered vertically */}
                  {!isLastStep && (
                    <div className="hidden lg:block absolute top-1/2 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-[#0AD9DC]/40 to-[#0AD9DC]/20 z-0 -translate-y-1/2"></div>
                  )}
                  
                  {/* Step Card - Glass Morphism */}
                  <div className="relative bg-white/70 backdrop-blur-xl border border-gray-200/60 rounded-xl p-6 text-center transition-all duration-300 hover:bg-white/90 hover:border-[#0AD9DC]/50 hover:shadow-lg h-full flex flex-col z-10">
                    {/* Icon */}
                    <div className="mb-4 flex justify-center">
                      <div className="w-14 h-14 rounded-full bg-gray-100/80 border border-gray-200/60 flex items-center justify-center backdrop-blur-sm">
                        <Icon className="w-7 h-7 text-black" strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Phase Label */}
                    <div className="mb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-gray-500">
                        {step.phase}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-black mb-2">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
