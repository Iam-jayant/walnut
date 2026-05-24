"use client";

import { CofheProvider } from "@cofhe/react";
import { ReactNode, useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

import { WalnutPermitProvider } from "@/components/walnut/permit-provider";
import { cofheConfig } from "@/lib/cofhe-client";

export function CofheWalletBridge({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [activePublicClient, setActivePublicClient] = useState<any>(undefined);
  const [activeWalletClient, setActiveWalletClient] = useState<any>(undefined);

  useEffect(() => {
    setActivePublicClient(publicClient);
  }, [publicClient]);

  useEffect(() => {
    setActiveWalletClient(walletClient);
  }, [walletClient]);

  return (
    <CofheProvider
      config={cofheConfig}
      publicClient={activePublicClient}
      walletClient={activeWalletClient}
    >
      <WalnutPermitProvider>{children}</WalnutPermitProvider>
    </CofheProvider>
  );
}
