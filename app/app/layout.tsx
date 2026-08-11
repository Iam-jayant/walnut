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

  // Track connection state — only redirect to landing page on active disconnect (sign out),
  // not on initial page load when user hasn't connected yet
  useEffect(() => {
    if (account.isConnected) {
      wasConnectedRef.current = true;
    } else if (
      wasConnectedRef.current &&
      !account.isReconnecting &&
      !account.isConnecting
    ) {
      // User was connected and actively disconnected → go to landing page
      wasConnectedRef.current = false;
      router.push("/");
    }
  }, [account.isConnected, account.isReconnecting, account.isConnecting, router]);

  // Hide sidebar in STATE 1 (not connected) and STATE 2 (no permit)
  const showSidebar = account.isConnected && permit.hasPermit;

  return (
    <div className="relative min-h-screen bg-[#FDFDFD] pb-10">
      <main className={`relative min-h-screen bg-[#FFFFFF] px-8 py-8 shadow-sm`}>
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
        <AppLayoutContent>{children}</AppLayoutContent>
      </ToastProvider>
    </Web3Providers>
  );
}
