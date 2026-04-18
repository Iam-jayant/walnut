"use client";

import { CofheProvider } from "@cofhe/react";
import { ReactNode, useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

import { WalnutPermitProvider } from "@/components/walnut/permit-provider";
import { cofheConfig } from "@/lib/cofhe-client";

function CofheWalletBridgeInner({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return (
    <CofheProvider
      config={cofheConfig}
      publicClient={publicClient}
      walletClient={walletClient}
    >
      <WalnutPermitProvider>{children}</WalnutPermitProvider>
    </CofheProvider>
  );
}

export function CofheWalletBridge({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    let rafOne = 0;
    let rafTwo = 0;

    rafOne = window.requestAnimationFrame(() => {
      rafTwo = window.requestAnimationFrame(() => {
        setIsMounted(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafOne);
      window.cancelAnimationFrame(rafTwo);
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return <CofheWalletBridgeInner>{children}</CofheWalletBridgeInner>;
}
