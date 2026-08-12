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
  { label: "P2P", href: "/app/p2p", icon: Users, comingSoon: true },
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
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#EFEFEF] bg-[#FAFAFA]/50 backdrop-blur-xl">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <img src="/walnut-logo.svg" alt="Walnut" className="h-13 w-auto" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-black/60 font-medium">
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
        {navigationItems.map((item) => {
          
          if (item.subItems) {
            const isOpen = openGroups[item.label];
            const isChildActive = item.subItems.some(sub => pathname === sub.href);
            
            return (
               <div key={item.label} className="flex flex-col gap-1" onMouseEnter={() => handleGroupMouseEnter(item.label)} onMouseLeave={() => handleGroupMouseLeave(item.label)}>
                 <button
                   onClick={() => toggleGroup(item.label)}
                   className={cn(
                     "group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                     isChildActive ? "text-black bg-black/5" : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <item.icon
                       size={16}
                       className={cn(
                         "transition-colors",
                         isChildActive ? "text-black" : "text-muted-foreground group-hover:text-foreground"
                       )}
                     />
                     {item.label}
                   </div>
                   <ChevronDown 
                     size={14} 
                     className={cn("transition-transform duration-200", isOpen ? "rotate-180" : "", isChildActive ? "text-black/50" : "text-muted-foreground")} 
                   />
                 </button>
                 
                 {isOpen && (
                   <div className="ml-9 mt-1 flex flex-col gap-1 border-l border-black/10 pl-3 py-1">
                     {item.subItems.map(sub => {
                       const isActive = pathname === sub.href;
                       return (
                         <Link
                           key={sub.href}
                           href={sub.href}
                           className={cn(
                             "relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                             isActive
                               ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                               : "text-slate-500 hover:bg-black/5 hover:text-slate-900"
                           )}
                         >
                           {isActive && (
                             <div className="absolute -left-3.25 top-1/2 -mt-1 h-2 w-2 rounded-full border-2 border-white bg-black" />
                           )}
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
                "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                  : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  size={16}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-black" : "text-muted-foreground group-hover:text-foreground"
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

      <div className="p-4 border-t border-black/5">
        <button
          onClick={handleWalletClick}
          className="flex w-full items-center gap-3 rounded-lg p-2 transition-all hover:bg-black/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
            <Activity size={16} className="text-muted-foreground" />
          </div>
          <div className="flex flex-col items-start overflow-hidden text-sm">
            <span className="truncate font-medium text-foreground">
              {isConnected ? formatAddress(address) : "Connect Wallet"}
            </span>
          </div>
        </button>

        {isConnected && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-black/5 bg-white p-3 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Credit Tier
              </span>
              <span className={cn("text-sm font-semibold", 
                creditTier === "Tier 1" ? "text-red-600" :
                creditTier === "Tier 2" ? "text-amber-600" :
                "text-emerald-600"
              )}>
                {creditTier}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Max LTV
              </span>
              <span className="text-sm font-semibold">75%</span>
            </div>
          </div>
        )}

        <div className={cn(
          "mt-4 flex items-center justify-between rounded-md px-3 py-2",
          systemStatus === "All Operational" ? "bg-emerald-50 border border-emerald-200" :
          systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "bg-amber-50 border border-amber-200" :
          "bg-red-50 border border-red-200"
        )}>
          <span className={cn(
            "text-xs font-medium",
            systemStatus === "All Operational" ? "text-emerald-700" :
            systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "text-amber-700" :
            "text-red-700"
          )}>System Status</span>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              systemStatus === "All Operational" ? "bg-emerald-500" :
              systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "bg-amber-500" :
              "bg-red-500"
            )} />
            <span className={cn(
              "text-[10px]",
              systemStatus === "All Operational" ? "text-emerald-700" :
              systemStatus === "Permit Pending" || systemStatus === "Degraded" ? "text-amber-700" :
              "text-red-700"
            )}>{systemStatus}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}