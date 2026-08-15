"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Layers, ArrowLeftRight, Clock, Settings, ShieldCheck, Activity, Users, ChevronDown, Droplet, HandCoins, Wallet } from "lucide-react";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

type NavItem = {
  label: string;
  href?: string;
  icon: any;
  subItems?: { label: string; href: string }[];
  comingSoon?: boolean;
};

const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/app", icon: LayoutGrid },
  { 
    label: "Portfolio", 
    icon: Layers,
    subItems: [
      { label: "Deposit", href: "/app/deposit" },
      { label: "Withdraw", href: "/app/withdraw" }
    ]
  },
  { 
    label: "Loans", 
    icon: ArrowLeftRight,
    subItems: [
      { label: "Borrow", href: "/app/borrow" },
      { label: "Repay", href: "/app/repay" }
    ]
  },
  { label: "Liquidation", href: "/app/liquidation", icon: ShieldCheck },
  { label: "P2P", href: "/app/p2p", icon: Users },
  { label: "ENS Aggregation", href: "/app/ens", icon: Wallet },
  { label: "History", href: "/app/history", icon: Clock },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const protocol = useWalnutProtocol();
  
  // Track open state for dropdowns
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Portfolio: true,
    Loans: true
  });
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const creditTier = protocol.creditTier !== undefined ? `Tier ${protocol.creditTier.toString()}` : "Tier 0";
  
  const systemStatus = !protocol.isWalletReady 
    ? "All Operational"
    : !protocol.isOnTargetChain
    ? "Wrong Network"
    : protocol.hasDecryptError
    ? "Degraded"
    : !protocol.permit.hasPermit
    ? "Permit Pending"
    : "All Operational";

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleGroupMouseEnter = (label: string) => {
    setHoveredGroup(label);
    setOpenGroups(prev => ({ ...prev, [label]: true }));
  };

  const handleGroupMouseLeave = (label: string) => {
    setHoveredGroup(null);
    setOpenGroups(prev => ({ ...prev, [label]: false }));
  };

  const handleWalletClick = () => {
    if (isConnected) {
      openAccountModal?.();
    } else {
      openConnectModal?.();
    }
  };

  const formatAddress = (addr?: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/5 bg-[#09090B]/95 backdrop-blur-2xl">
      <div className="flex h-20 shrink-0 items-center px-6 pt-2">
        <Link href="/" className="flex items-center gap-2">
          <img src="/walnut-logo-dark.svg" alt="Walnut" className="h-14 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navigationItems.map((item) => {
          
          if (item.subItems) {
            const isOpen = openGroups[item.label];
            const isChildActive = item.subItems.some(sub => pathname === sub.href);
            
            return (
               <div key={item.label} className="flex flex-col gap-1" onMouseEnter={() => handleGroupMouseEnter(item.label)} onMouseLeave={() => handleGroupMouseLeave(item.label)}>
                 <button
                   onClick={() => toggleGroup(item.label)}
                   className={cn(
                     "group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 border border-transparent",
                     isChildActive ? "text-white" : "text-white/60 hover:text-white"
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <item.icon
                       size={18}
                       className={cn(
                         "transition-colors",
                         isChildActive ? "text-white" : "text-white/50 group-hover:text-white"
                       )}
                     />
                     {item.label}
                   </div>
                   <ChevronDown 
                     size={14} 
                     className={cn("transition-transform duration-200", isOpen ? "rotate-180" : "", isChildActive ? "text-white/80" : "text-white/40")} 
                   />
                 </button>
                 
                 {isOpen && (
                   <div className="ml-5 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4 py-1">
                     {item.subItems.map(sub => {
                       const isActive = pathname === sub.href;
                       return (
                         <Link
                           key={sub.href}
                           href={sub.href}
                           className={cn(
                             "relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 border",
                             isActive
                               ? "bg-transparent text-white border-[#00C2FF]"
                               : "text-white/60 border-transparent hover:text-white"
                           )}
                         >
                           {sub.label}
                         </Link>
                       )
                     })}
                   </div>
                 )}
               </div>
            )
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 border",
                isActive
                  ? "bg-transparent text-white border-[#00C2FF]"
                  : "text-white/60 border-transparent hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  size={18}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-white" : "text-white/50 group-hover:text-white"
                  )}
                />
                {item.label}
              </div>
              {item.comingSoon && (
                <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wide font-mono">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 pb-12">
        <button
          onClick={handleWalletClick}
          className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-[#141414] p-3 transition-all hover:bg-white/5 hover:border-white/10"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black border border-white/10">
            <Activity size={14} className="text-white/60" />
          </div>
          <div className="flex flex-col items-start overflow-hidden text-sm">
            <span className="truncate font-medium text-white/90">
              {isConnected ? formatAddress(address) : "Connect Wallet"}
            </span>
          </div>
          <ChevronDown size={14} className="ml-auto text-white/40" />
        </button>

        {isConnected && (
          <div className="mt-3 flex items-center justify-between px-3">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                Credit Tier
              </span>
              <span className={cn("text-sm font-medium", 
                creditTier === "Tier 1" ? "text-red-400" :
                creditTier === "Tier 2" ? "text-amber-400" :
                "text-[#00C2FF]"
              )}>
                {creditTier}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                Max LTV
              </span>
              <span className="text-sm font-medium text-white/90">75%</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 px-3">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
            System Status
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className={cn(
              "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]",
              systemStatus === "All Operational" ? "bg-emerald-500" :
              systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" :
              "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            )} />
            <span className={cn(
              "text-[10px] font-medium",
              systemStatus === "All Operational" ? "text-emerald-400" :
              systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "text-amber-400" :
              "text-red-400"
            )}>{systemStatus === "All Operational" ? "All Systems Operational" : systemStatus}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}