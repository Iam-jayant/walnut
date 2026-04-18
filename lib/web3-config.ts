"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, createStorage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { fallback, http } from "wagmi";

function requirePublicEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[web3-config] Missing required environment variable: ${key}`);
  }

  return value;
}

const walletConnectProjectId = requirePublicEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
const rpcUrlPrimary = requirePublicEnv("NEXT_PUBLIC_RPC_URL_PRIMARY");
const rpcUrlFallback1 = requirePublicEnv("NEXT_PUBLIC_RPC_URL_FALLBACK_1");
const rpcUrlFallback2 = requirePublicEnv("NEXT_PUBLIC_RPC_URL_FALLBACK_2");

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

const connectors =
  typeof window !== "undefined"
    ? connectorsForWallets(
        [
          {
            groupName: "Browser Wallets",
            wallets: [injectedWallet, metaMaskWallet, coinbaseWallet],
          },
          {
            groupName: "WalletConnect",
            wallets: [walletConnectWallet],
          },
        ],
        {
          appName: "Walnut",
          projectId: walletConnectProjectId,
        },
      )
    : [];

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: fallback([
      http(rpcUrlPrimary, {
        timeout: 10_000,
        retryCount: 1,
      }),
      http(rpcUrlFallback1, {
        timeout: 10_000,
        retryCount: 1,
      }),
      http(rpcUrlFallback2, {
        timeout: 10_000,
        retryCount: 1,
      }),
    ]),
  },
  pollingInterval: 30_000,
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
  ssr: false,
});
