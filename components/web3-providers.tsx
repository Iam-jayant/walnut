"use client";

import dynamic from "next/dynamic";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

import { ThemeProvider } from "@/components/theme-provider";
import { wagmiConfig } from "@/lib/web3-config";

const CofheWalletBridge = dynamic(
  () => import("@/components/cofhe-wallet-bridge").then((module) => module.CofheWalletBridge),
  {
    ssr: false,
  },
);

const rpcUrlPrimary = process.env.NEXT_PUBLIC_RPC_URL_PRIMARY || "https://sepolia-rollup.arbitrum.io/rpc";

// Set up mock window.ethereum EIP-1193 provider if a mock private key exists in localStorage
if (typeof window !== "undefined") {
  const setupMockEthereum = () => {
    try {
      const mockKey = window.localStorage.getItem("mock_private_key");
      if (!mockKey) return;

      const formattedKey = (mockKey.startsWith("0x") ? mockKey : `0x${mockKey}`) as `0x${string}`;
      const account = privateKeyToAccount(formattedKey);
      
      const walletClient = createWalletClient({
        account,
        chain: arbitrumSepolia,
        transport: http(rpcUrlPrimary),
      });

      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpcUrlPrimary),
      });

      const listeners = new Map<string, Set<(...args: any[]) => void>>();

      const mockProvider = {
        isMetaMask: true,
        _isWalnutMock: true,
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          console.info("[Mock Ethereum Request]", method, params);
          
          if (method === "eth_requestAccounts" || method === "eth_accounts") {
            return [account.address];
          }
          if (method === "eth_chainId") {
            return `0x${arbitrumSepolia.id.toString(16)}`;
          }
          if (method === "personal_sign") {
            return walletClient.signMessage({
              message: params?.[0] as any,
              account,
            });
          }
          if (method === "eth_signTypedData_v4") {
            const typedData = typeof params?.[1] === "string" ? JSON.parse(params[1]) : params?.[1];
            return walletClient.signTypedData({
              domain: typedData.domain,
              types: typedData.types,
              primaryType: typedData.primaryType,
              message: typedData.message,
              account,
            });
          }
          if (method === "eth_sendTransaction") {
            const tx = params?.[0];
            
            // Bump gas fees slightly to avoid "max fee per gas less than block base fee" on Arbitrum Sepolia
            if (tx.maxFeePerGas) {
              tx.maxFeePerGas = `0x${(BigInt(tx.maxFeePerGas) * 150n / 100n).toString(16)}`;
            }
            if (tx.maxPriorityFeePerGas) {
              tx.maxPriorityFeePerGas = `0x${(BigInt(tx.maxPriorityFeePerGas) * 150n / 100n).toString(16)}`;
            }

            return walletClient.sendTransaction({
              ...tx,
              account,
            });
          }
          
          // Pass all other queries straight to the public JSON-RPC endpoint
          const response = await fetch(rpcUrlPrimary, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method,
              params: params || [],
            }),
          });
          const json = await response.json();
          if (json.error) {
            throw json.error;
          }
          return json.result;
        },
        on: (event: string, handler: (...args: any[]) => void) => {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event)!.add(handler);
        },
        removeListener: (event: string, handler: (...args: any[]) => void) => {
          if (listeners.has(event)) {
            listeners.get(event)!.delete(handler);
          }
        },
        addListener: (event: string, handler: (...args: any[]) => void) => {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event)!.add(handler);
        },
        emit: (event: string, ...args: any[]) => {
          if (listeners.has(event)) {
            listeners.get(event)!.forEach((h) => h(...args));
          }
        }
      };

      (window as any).ethereum = mockProvider;
      console.info("[Mock Provider] Successfully injected mock window.ethereum for account:", account.address);
    } catch (e) {
      console.error("[Mock Provider] Failed to inject mock window.ethereum:", e);
    }
  };

  setupMockEthereum();
}

function MockWalletAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") return;

    const fetchMockKey = async () => {
      try {
        const mockKey = window.localStorage.getItem("mock_private_key");
        if (!mockKey) {
          const res = await fetch("/api/walnut/mock-key");
          if (res.ok) {
            const data = await res.json();
            if (data.privateKey) {
              window.localStorage.setItem("mock_private_key", data.privateKey);
              window.location.reload();
            }
          }
        }
      } catch (e) {
        console.error("Failed to auto-fetch mock private key", e);
      }
    };

    void fetchMockKey();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only auto-connect if OUR mock provider was injected (not Coinbase/other extensions)
    const isMockProviderActive =
      window.localStorage.getItem("mock_private_key") &&
      (window as any).ethereum?._isWalnutMock === true;

    if (!isMockProviderActive || isConnected) return;

    const injectedConnector = connectors.find(
      (c) => c.id === "injected" || c.name.toLowerCase().includes("injected") || c.name.toLowerCase().includes("metamask")
    );
    if (injectedConnector) {
      console.info("[Mock Wallet AutoConnect] Auto-connecting to mock wallet (one-time)...");
      connect({ connector: injectedConnector });
    }
    // Intentionally run only once on mount — no polling to avoid Coinbase SDK spam
  }, [isConnected, connect, connectors]);

  return null;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <MockWalletAutoConnect />
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
