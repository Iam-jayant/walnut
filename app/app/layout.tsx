"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";

import { Web3Providers } from "@/components/web3-providers";
import { ToastProvider } from "@/components/walnut/toast-provider";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { SidebarNav } from "@/components/walnut/sidebar-nav";
import { ProtocolStatus } from "@/components/dashboard/protocol-status";

function AppLayoutContent({ children }: { children: ReactNode }) {
  const account = useAccount();
  const permit = useWalnutPermit();
  const router = useRouter();
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (account.isConnected) {
      wasConnectedRef.current = true;
    } else if (
      wasConnectedRef.current &&
      !account.isReconnecting &&
      !account.isConnecting
    ) {
      wasConnectedRef.current = false;
      router.push("/");
    }
  }, [account.isConnected, account.isReconnecting, account.isConnecting, router]);

  return (
    <div className="flex min-h-screen bg-slate-50/50" style={{ zoom: 1 }}>
      {/* Fixed Sidebar */}
      <SidebarNav />

      {/* Main Content Area Offset by Sidebar Width */}
      <div className="flex-1 pl-64 min-w-0 flex flex-col min-h-screen">
        <main className="flex-1 px-8 py-8 pb-24 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Fixed Bottom Protocol Status Bar */}
        <ProtocolStatus />
      </div>
    </div>
  );
}

export default function WalnutAppLayout({ children }: { children: ReactNode }) {
  return (
    <Web3Providers>
      <ToastProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </ToastProvider>
    </Web3Providers>
  );
}
