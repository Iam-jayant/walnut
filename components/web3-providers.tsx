"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@/components/theme-provider";
import { wagmiConfig } from "@/lib/web3-config";

const CofheWalletBridge = dynamic(
  () => import("@/components/cofhe-wallet-bridge").then((module) => module.CofheWalletBridge),
  {
    ssr: false,
  },
);

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <CofheWalletBridge>{children}</CofheWalletBridge>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
