"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import type { Address } from "viem";
import { useCofheClient } from "@cofhe/react";
import { FheTypes } from "@cofhe/sdk";
import { useWalnutPermit } from "@/components/walnut/permit-provider";

// Contract addresses from environment
const WALNUT_V2_ADDRESS = process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS as Address;
const FHERC20_ADDRESS = process.env.NEXT_PUBLIC_FHERC20_ADDRESS as Address;
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS as Address;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address;
const WETH_ADDRESS = process.env.NEXT_PUBLIC_WETH_ADDRESS as Address;
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "421614");

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

// WalnutV2 ABI (minimal)
const WALNUT_V2_ABI = [
  {
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    name: "vaults",
    outputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
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

export type WUSDCBalance = {
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
  const [wUSDCBalance, setWUSDCBalance] = useState<WUSDCBalance>({
    encrypted: undefined,
    decrypted: undefined,
    decrypting: false,
    error: undefined,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isWalletReady = Boolean(account.isConnected && account.address);
  const canRead = Boolean(isWalletReady && permit.hasPermit);

  // Read wUSDC encrypted balance
  const { data: wUSDCEncrypted, refetch: refetchWUSDC } = useReadContract({
    address: FHERC20_ADDRESS,
    abi: FHERC20_ABI,
    functionName: "balanceOf",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  // Decrypt wUSDC balance
  useEffect(() => {
    if (!wUSDCEncrypted || !account.address || !cofheClient || !permit.hasPermit) {
      return;
    }

    const ctHash = typeof wUSDCEncrypted === "bigint" ? wUSDCEncrypted : undefined;
    if (!ctHash || ctHash === 0n) {
      setWUSDCBalance({
        encrypted: wUSDCEncrypted,
        decrypted: 0n,
        decrypting: false,
        error: undefined,
      });
      return;
    }

    let active = true;
    setWUSDCBalance((prev) => ({ ...prev, decrypting: true, error: undefined }));

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
          setWUSDCBalance({
            encrypted: wUSDCEncrypted,
            decrypted: typeof decrypted === "bigint" ? decrypted : undefined,
            decrypting: false,
            error: undefined,
          });
        }
      } catch (error) {
        if (active) {
          setWUSDCBalance({
            encrypted: wUSDCEncrypted,
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
  }, [wUSDCEncrypted, account.address, cofheClient, permit.hasPermit, permit.permitHash]);

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
          console.error(`Failed to fetch balance for ${token.symbol}:`, error);
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

  // Fetch vault holdings
  useEffect(() => {
    if (!isWalletReady || !account.address || !publicClient) {
      setVaultHoldings([]);
      return;
    }

    let active = true;

    const fetchVaultHoldings = async () => {
      const holdings: VaultHolding[] = [];

      // Try to read vault holdings (index 0, 1, 2, etc.)
      // We'll try up to 10 holdings and stop when we hit an error
      for (let i = 0; i < 10; i++) {
        try {
          const [token, amount] = await publicClient.readContract({
            address: WALNUT_V2_ADDRESS,
            abi: WALNUT_V2_ABI,
            functionName: "vaults",
            args: [account.address!, BigInt(i)],
          });

          // If token is zero address, we've reached the end
          if (token === "0x0000000000000000000000000000000000000000" || amount === 0n) {
            break;
          }

          // Find token info
          const tokenInfo = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase());

          // Get USD value
          let usdValue: bigint | undefined;
          try {
            usdValue = await publicClient.readContract({
              address: ORACLE_ADDRESS,
              abi: ORACLE_ABI,
              functionName: "getUSDValue",
              args: [token, amount],
            });
          } catch (error) {
            console.error(`Failed to fetch USD value for vault holding:`, error);
          }

          holdings.push({
            token,
            amount,
            symbol: tokenInfo?.symbol ?? "UNKNOWN",
            decimals: tokenInfo?.decimals ?? 18,
            usdValue,
          });
        } catch (error) {
          // No more vault holdings
          break;
        }
      }

      if (active) {
        setVaultHoldings(holdings);
      }
    };

    void fetchVaultHoldings();

    return () => {
      active = false;
    };
  }, [isWalletReady, account.address, publicClient, refreshTrigger]);

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
    await refetchWUSDC();
  }, [refetchWUSDC]);

  return {
    tokenBalances,
    vaultHoldings,
    wUSDCBalance,
    refreshBalances,
    isLoading: !isWalletReady,
    canRead,
  } as const;
}
