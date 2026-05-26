"use client";

import type { ReactNode } from "react";
import { useAccount } from "wagmi";

import { Web3Providers } from "@/components/web3-providers";
import { ToastProvider } from "@/components/walnut/toast-provider";
import { WalnutPermitProvider, useWalnutPermit } from "@/components/walnut/permit-provider";
import { SidebarNav } from "@/components/walnut/sidebar-nav";

function AppLayoutContent({ children }: { children: ReactNode }) {
  const account = useAccount();
  const permit = useWalnutPermit();
  
  // Hide sidebar in STATE 1 (not connected) and STATE 2 (no permit)
  const showSidebar = account.isConnected && permit.hasPermit;

  return (
    <div className="relative min-h-screen bg-[#FDFDFD]">
      {showSidebar && <SidebarNav />}
      <main className={`relative min-h-screen ${showSidebar ? 'ml-64 border-l border-[#EFEFEF]' : ''} bg-[#FFFFFF] px-8 py-8 shadow-sm`}>
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function WalnutAppLayout({ children }: { children: ReactNode }) {
  return (
    <Web3Providers>
      <ToastProvider>
        <WalnutPermitProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </WalnutPermitProvider>
      </ToastProvider>
    </Web3Providers>
  );
}



