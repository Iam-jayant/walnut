"use client";

import dynamic from "next/dynamic";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider, useReconnect } from "wagmi";

import { ThemeProvider } from "@/components/theme-provider";
import { wagmiConfig } from "@/lib/web3-config";

const CofheWalletBridge = dynamic(
  () => import("@/components/cofhe-wallet-bridge").then((module) => module.CofheWalletBridge),
  {
    ssr: false,
  },
);

function DeferredWagmiReconnect() {
  const { reconnect } = useReconnect();

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void reconnect();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [reconnect]);

  return null;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <DeferredWagmiReconnect />
          <RainbowKitProvider
            theme={lightTheme({
              accentColor: "#d4ff4f",
              accentColorForeground: "#111111",
              borderRadius: "medium",
              overlayBlur: "small",
            })}
          >
            <CofheWalletBridge>{children}</CofheWalletBridge>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
