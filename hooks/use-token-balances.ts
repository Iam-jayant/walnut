"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import type { Address } from "viem";
import { useCofheClient } from "@cofhe/react";
import { FheTypes } from "@cofhe/sdk";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { debugError } from "@/lib/debug";

import {
  walnutChainId as CHAIN_ID,
  walnutContractAddress as WALNUT_LENDING_ADDRESS,
  walnutFherc20Address as FHERC20_ADDRESS,
  walnutMockUsdcAddress as MOCK_USDC_ADDRESS,
} from "@/lib/walnut-contract";

// WETH is not currently exported from walnut-contract, so read it safely
const WETH_ADDRESS = (process.env.NEXT_PUBLIC_WETH_ADDRESS || "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73") as Address;

// Standard ERC20 ABI (minimal)
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// WalnutPriceOracle ABI (minimal)
const ORACLE_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "getUSDValue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// WalnutFHERC20 ABI (minimal)
const FHERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;


// Supported collateral tokens
const SUPPORTED_TOKENS = [
  { address: MOCK_USDC_ADDRESS, symbol: "USDC", decimals: 6 },
  ...(WETH_ADDRESS ? [{ address: WETH_ADDRESS, symbol: "WETH", decimals: 18 }] : []),
] as const;

const BALANCE_REFRESH_INTERVAL_MS = 30_000; // 30 seconds

export type TokenBalance = {
  token: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  usdValue: bigint | undefined;
  usdValueLoading: boolean;
  usdValueError: Error | undefined;
};

export type VaultHolding = {
  token: Address;
  amount: bigint;
  symbol: string;
  decimals: number;
  usdValue: bigint | undefined;
};

export type CUSDCBalance = {
  encrypted: unknown;
  decrypted: bigint | undefined;
  decrypting: boolean;
  error: Error | undefined;
};

export function useTokenBalances() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const cofheClient = useCofheClient();
  const permit = useWalnutPermit();

  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [vaultHoldings, setVaultHoldings] = useState<VaultHolding[]>([]);
  const [cUSDCBalance, setCUSDCBalance] = useState<CUSDCBalance>({
    encrypted: undefined,
    decrypted: undefined,
    decrypting: false,
    error: undefined,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isWalletReady = Boolean(account.isConnected && account.address);
  const canRead = Boolean(isWalletReady && permit.hasPermit);

  // Read cUSDC encrypted balance
  const { data: cUSDCEncrypted, refetch: refetchCUSDC } = useReadContract({
    address: FHERC20_ADDRESS,
    abi: FHERC20_ABI,
    functionName: "balanceOf",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  // Decrypt cUSDC balance
  useEffect(() => {
    if (!cUSDCEncrypted || !account.address || !cofheClient || !permit.hasPermit) {
      return;
    }

    const ctHash = typeof cUSDCEncrypted === "bigint" ? cUSDCEncrypted : undefined;
    if (!ctHash || ctHash === 0n) {
      setCUSDCBalance({
        encrypted: cUSDCEncrypted,
        decrypted: 0n,
        decrypting: false,
        error: undefined,
      });
      return;
    }

    let active = true;
    setCUSDCBalance((prev) => ({ ...prev, decrypting: true, error: undefined }));

    const decrypt = async () => {
      try {
        const builder = cofheClient
          .decryptForView(ctHash, FheTypes.Uint128)
          .setChainId(CHAIN_ID)
          .setAccount(account.address!);

        const withPermitBuilder = permit.permitHash
          ? builder.withPermit(permit.permitHash)
          : builder.withPermit();

        const decrypted = await withPermitBuilder.execute();

        if (active) {
          setCUSDCBalance({
            encrypted: cUSDCEncrypted,
            decrypted: typeof decrypted === "bigint" ? decrypted : undefined,
            decrypting: false,
            error: undefined,
          });
        }
      } catch (error) {
        if (active) {
          setCUSDCBalance({
            encrypted: cUSDCEncrypted,
            decrypted: undefined,
            decrypting: false,
            error: error instanceof Error ? error : new Error("Decryption failed"),
          });
        }
      }
    };

    void decrypt();

    return () => {
      active = false;
    };
  }, [cUSDCEncrypted, account.address, cofheClient, permit.hasPermit, permit.permitHash]);

  // Fetch token balances and USD values
  useEffect(() => {
    if (!isWalletReady || !account.address || !publicClient) {
      setTokenBalances([]);
      return;
    }

    let active = true;

    const fetchBalances = async () => {
      const balances: TokenBalance[] = [];

      for (const token of SUPPORTED_TOKENS) {
        try {
          // Read token balance
          const balance = await publicClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [account.address!],
          });

          // Read USD value if balance > 0
          let usdValue: bigint | undefined;
          let usdValueLoading = false;
          let usdValueError: Error | undefined;

          if (balance > 0n) {
            usdValueLoading = true;
            try {
              usdValue = await publicClient.readContract({
                address: ORACLE_ADDRESS,
                abi: ORACLE_ABI,
                functionName: "getUSDValue",
                args: [token.address, balance],
              });
            } catch (error) {
              usdValueError = error instanceof Error ? error : new Error("Failed to fetch USD value");
            }
            usdValueLoading = false;
          }

          balances.push({
            token: token.address,
            symbol: token.symbol,
            balance,
            decimals: token.decimals,
            usdValue,
            usdValueLoading,
            usdValueError,
          });
        } catch (error) {
          debugError(`Failed to fetch balance for ${token.symbol}:`, error);
        }
      }

      if (active) {
        setTokenBalances(balances);
      }
    };

    void fetchBalances();

    return () => {
      active = false;
    };
  }, [isWalletReady, account.address, publicClient, refreshTrigger]);

  // Per-token vault ledger removed for privacy — collateral is encrypted USD only.
  useEffect(() => {
    setVaultHoldings([]);
  }, [account.address, refreshTrigger]);

  // Auto-refresh balances
  useEffect(() => {
    if (!isWalletReady) return;

    const id = window.setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, BALANCE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isWalletReady]);

  // Manual refresh function
  const refreshBalances = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
    await refetchCUSDC();
  }, [refetchCUSDC]);

  return {
    tokenBalances,
    vaultHoldings,
    cUSDCBalance,
    refreshBalances,
    isLoading: !isWalletReady,
    canRead,
  } as const;
}
