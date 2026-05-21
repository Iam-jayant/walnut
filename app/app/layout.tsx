import type { ReactNode } from "react";

import { Web3Providers } from "@/components/web3-providers";
import { ToastProvider } from "@/components/walnut/toast-provider";
import { WalnutPermitProvider } from "@/components/walnut/permit-provider";
import { SidebarNav } from "@/components/walnut/sidebar-nav";

export default function WalnutAppLayout({ children }: { children: ReactNode }) {
  return (
    <Web3Providers>
      <ToastProvider>
        <WalnutPermitProvider>
          <div className="relative min-h-screen bg-[#FDFDFD]">
            <SidebarNav />
            <main className="relative z-10 ml-64 min-h-screen border-l border-[#EFEFEF] bg-[#FFFFFF] px-8 py-8 shadow-sm">
              <div className="mx-auto w-full max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </WalnutPermitProvider>
      </ToastProvider>
    </Web3Providers>
  );
}



