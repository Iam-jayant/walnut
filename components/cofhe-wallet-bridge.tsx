"use client";

import { CofheProvider } from "@cofhe/react";
import { ReactNode } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

import { WalnutPermitProvider } from "@/components/walnut/permit-provider";
import { cofheConfig } from "@/lib/cofhe-client";

export function CofheWalletBridge({ children }: { children: ReactNode }) {
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
