"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import type { Address } from "viem";

import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { useToast } from "@/components/walnut/toast-provider";
import {
  useCofheClient,
  useCofheEncrypt,
  useCofheReadContractAndDecrypt,
  useCofheWriteContract,
} from "@cofhe/react";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { walnutChainId, walnutContractAddress, walnutV1Abi } from "@/lib/walnut-contract";

const BALANCE_REFRESH_INTERVAL_MS = 30_000;
const DEFAULT_LIQUIDATION_POLL_INTERVAL_MS = 15_000;
const DEFAULT_LIQUIDATION_POLL_MAX = 20;

export type WalnutAction = "deposit" | "borrow" | "repay" | "withdraw";

export type AuctionSummary = {
  borrower: Address;
  active: boolean;
  settled: boolean;
  endTime: bigint;
  bidCount: bigint;
};

type CofheDecryptResult<T> = {
  encrypted: unknown;
  decrypted: {
    data?: T;
    error?: Error;
    isFetching: boolean;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
};

function parsePositiveBigint(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const value = BigInt(trimmed);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

function isBigint(value: unknown): value is bigint {
  return typeof value === "bigint";
}

export function useCreditTier(borrower?: Address) {
  const { data, isLoading, refetch } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "creditTier",
    args: [borrower ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: Boolean(borrower),
    },
  });

  return {
    creditTier: isBigint(data) ? data : undefined,
    creditTierLoading: isLoading,
    refreshCreditTier: refetch,
  } as const;
}

export function useTierLTV(tier?: bigint) {
  const { data, isLoading, refetch } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "TIER_LTV",
    args: [tier ?? 0n],
    query: {
      enabled: typeof tier === "bigint",
    },
  });

  return {
    tierLTV: isBigint(data) ? data : undefined,
    tierLTVLoading: isLoading,
    refreshTierLTV: refetch,
  } as const;
}

export function useWalnutProtocol() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const cofheClient = useCofheClient();
  const { addToast, removeToast } = useToast();
  const permit = useWalnutPermit();
  const encryptor = useCofheEncrypt();
  const writer = useCofheWriteContract();

  const [status, setStatus] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [healthFactorValue, setHealthFactorValue] = useState<bigint | undefined>(undefined);
  const [healthFactorDecrypting, setHealthFactorDecrypting] = useState(false);
  const [healthFactorError, setHealthFactorError] = useState<string | null>(null);
  const [aggregatedCollateralValue, setAggregatedCollateralValue] = useState<bigint | undefined>(undefined);
  const [aggregatedCollateralDecrypting, setAggregatedCollateralDecrypting] = useState(false);
  const [aggregatedCollateralError, setAggregatedCollateralError] = useState<string | null>(null);
  const [liquidationPollingActive, setLiquidationPollingActive] = useState(false);
  const [liquidationPollingMessage, setLiquidationPollingMessage] = useState<string | null>(null);
  const liquidationPollingRef = useRef<{
    attempts: number;
    timer?: number;
    toastId?: string;
  }>({ attempts: 0 });
  const [creditTierPollingActive, setCreditTierPollingActive] = useState(false);
  const creditTierPollingRef = useRef<{
    toastId?: string;
  }>({});

  const [linkedWallets, setLinkedWallets] = useState<Address[]>([]);
  const [linkedWalletCount, setLinkedWalletCount] = useState(0);
  const [linkedWalletsLoading, setLinkedWalletsLoading] = useState(false);

  const isWalletReady = Boolean(account.isConnected && account.address);
  const isConnectionTransient = account.status === "reconnecting" || (account.isConnected && !account.address);
  const isOnTargetChain = account.chainId === walnutChainId;
  const canUseContract = Boolean(walnutContractAddress && walnutV1Abi && publicClient);
  const canRead = Boolean(isWalletReady && isOnTargetChain && canUseContract && permit.hasPermit);
  const canWrite = Boolean(isWalletReady && isOnTargetChain && canUseContract);

  const { switchChainAsync } = useSwitchChain();

  const collateral = useCofheReadContractAndDecrypt({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedCollateral",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    requiresPermit: true,
  }, {
    readQueryOptions: { enabled: canRead && Boolean(account.address) },
  }) as CofheDecryptResult<bigint>;

  const debt = useCofheReadContractAndDecrypt({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedDebt",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    requiresPermit: true,
  }, {
    readQueryOptions: { enabled: canRead && Boolean(account.address) },
  }) as CofheDecryptResult<bigint>;

  const totalPoolCollateral = useCofheReadContractAndDecrypt({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedTotalPoolCollateral",
    args: [],
    requiresPermit: true,
  }, {
    readQueryOptions: { enabled: canRead },
  }) as CofheDecryptResult<bigint>;

  const totalPoolDebt = useCofheReadContractAndDecrypt({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedTotalPoolDebt",
    args: [],
    requiresPermit: true,
  }, {
    readQueryOptions: { enabled: canRead },
  }) as CofheDecryptResult<bigint>;

  const { data: liquidatableData, refetch: refreshLiquidatable } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "liquidatable",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account.address) && isOnTargetChain },
  });

  const liquidatable = Boolean(liquidatableData);

  const { creditTier, creditTierLoading, refreshCreditTier } = useCreditTier(account.address);
  const { tierLTV, tierLTVLoading } = useTierLTV(creditTier);

  const collateralDecrypting = collateral.decrypted.isFetching || collateral.decrypted.isLoading;
  const debtDecrypting = debt.decrypted.isFetching || debt.decrypted.isLoading;
  const totalPoolCollateralDecrypting =
    totalPoolCollateral.decrypted.isFetching || totalPoolCollateral.decrypted.isLoading;
  const totalPoolDebtDecrypting =
    totalPoolDebt.decrypted.isFetching || totalPoolDebt.decrypted.isLoading;

  const hasDecryptPending = collateralDecrypting || debtDecrypting;
  
  // Only show decrypt error if we have permit and should be able to decrypt
  // Ignore errors when user hasn't deposited yet (zero values are expected)
  const hasDecryptError = Boolean(
    canRead && 
    !hasDecryptPending && 
    (collateral.decrypted.error || debt.decrypted.error) &&
    // Don't show error if it's just a "no data" scenario
    collateral.decrypted.error?.message !== "No ciphertext found" &&
    debt.decrypted.error?.message !== "No ciphertext found"
  );

  const decryptForView = useCallback(
    async (ctHash: bigint | string, accountAddress: Address) => {
      if (!cofheClient) return undefined;

      const builder = cofheClient
        .decryptForView(ctHash, FheTypes.Uint128)
        .setChainId(walnutChainId)
        .setAccount(accountAddress);

      const withPermitBuilder = permit.permitHash
        ? builder.withPermit(permit.permitHash)
        : builder.withPermit();

      const decrypted = await withPermitBuilder.execute();
      return typeof decrypted === "bigint" ? decrypted : undefined;
    },
    [cofheClient, permit.permitHash]
  );

  useEffect(() => {
    let active = true;

    async function refreshLinkedWallets() {
      if (!canUseContract || !account.address) {
        if (active) {
          setLinkedWallets([]);
          setLinkedWalletCount(0);
        }
        return;
      }

      setLinkedWalletsLoading(true);

      try {
        const [count, wallets] = await Promise.all([
          publicClient?.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getLinkedWalletCount",
            args: [account.address],
          }),
          publicClient?.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getLinkedWallets",
            args: [account.address],
          }),
        ]);

        if (!active) return;

        setLinkedWalletCount(Number(count ?? 0n));
        setLinkedWallets(Array.isArray(wallets) ? (wallets as Address[]) : []);
      } catch {
        if (!active) return;
        setLinkedWalletCount(0);
        setLinkedWallets([]);
      } finally {
        if (active) setLinkedWalletsLoading(false);
      }
    }

    void refreshLinkedWallets();

    return () => {
      active = false;
    };
  }, [account.address, canUseContract, publicClient]);

  const refreshBalances = useCallback(async () => {
    if (!canRead) return;
    try {
      await Promise.all([
        collateral.decrypted.refetch(),
        debt.decrypted.refetch(),
        totalPoolCollateral.decrypted.refetch(),
        totalPoolDebt.decrypted.refetch(),
      ]);
    } catch (error) {
      console.error("Failed to refresh balances:", error);
      // Silently fail - balances will retry on next interval
    }
  }, [canRead, collateral.decrypted, debt.decrypted, totalPoolCollateral.decrypted, totalPoolDebt.decrypted]);

  useEffect(() => {
    if (!canRead) return;

    const id = window.setInterval(() => {
      void refreshBalances();
    }, BALANCE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [canRead, refreshBalances]);

  const fetchHealthFactor = useCallback(
    async (borrower?: Address) => {
      if (!canUseContract || !publicClient || !permit.hasPermit) return undefined;

      const target = borrower ?? account.address;
      if (!target) return undefined;

      setHealthFactorDecrypting(true);
      setHealthFactorError(null);

      try {
        const handle = (await publicClient.readContract({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "getHealthFactor",
          args: [target],
        })) as bigint;

        const value = await decryptForView(handle, target);

        if (!borrower) {
          setHealthFactorValue(value);
        }

        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to decrypt health factor.";
        setHealthFactorError(message);
        return undefined;
      } finally {
        setHealthFactorDecrypting(false);
      }
    },
    [account.address, canUseContract, decryptForView, permit.hasPermit, publicClient]
  );

  const fetchAggregatedCollateral = useCallback(
    async (owner?: Address) => {
      if (!canUseContract || !publicClient || !permit.hasPermit) return undefined;

      const target = owner ?? account.address;
      if (!target) return undefined;

      setAggregatedCollateralDecrypting(true);
      setAggregatedCollateralError(null);

      try {
        const handle = (await publicClient.readContract({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "getAggregatedCollateral",
          args: [target],
        })) as bigint;

        const value = await decryptForView(handle, target);
        setAggregatedCollateralValue(value);
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to decrypt aggregated collateral.";
        setAggregatedCollateralError(message);
        return undefined;
      } finally {
        setAggregatedCollateralDecrypting(false);
      }
    },
    [account.address, canUseContract, decryptForView, permit.hasPermit, publicClient]
  );

  const submitEncryptedAmount = useCallback(
    async (action: WalnutAction, amount: string) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const value = parsePositiveBigint(amount);
      if (!value) {
        addToast({ variant: "error", message: "Amount must be a positive integer." });
        return false;
      }

      try {
        setStatus("Encrypting amount...");
        const [encrypted] = await encryptor.encryptInputsAsync([Encryptable.uint128(value)]);
        const functionName: "deposit" | "borrow" | "repay" | "withdraw" =
          action === "deposit"
            ? "deposit"
            : action === "borrow"
            ? "borrow"
            : action === "repay"
            ? "repay"
            : "withdraw";

        setStatus("Submitting transaction...");
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName,
          args: [encrypted],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 5_000_000n, // High gas limit for FHE operations
        });

        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        addToast({ variant: "success", message: "Transaction confirmed." });
        setStatus(null);
        await refreshBalances();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transaction failed.";
        addToast({ variant: "error", message });
        setStatus(null);
        return false;
      }
    },
    [addToast, canWrite, encryptor, publicClient, refreshBalances, writer]
  );

  const requestLiquidationCheck = useCallback(
    async (borrowerAddress: Address, options?: { intervalMs?: number; maxAttempts?: number }) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const intervalMs = options?.intervalMs ?? DEFAULT_LIQUIDATION_POLL_INTERVAL_MS;
      const maxAttempts = options?.maxAttempts ?? DEFAULT_LIQUIDATION_POLL_MAX;

      try {
        setStatus("Requesting liquidation check...");
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "requestLiquidationCheck",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 5_000_000n, // High gas limit for FHE operations
        });

        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus(null);
        const toastId = addToast({ variant: "pending", message: "Waiting for CoFHE result..." });
        liquidationPollingRef.current.toastId = toastId;
        setLiquidationPollingActive(true);
        setLiquidationPollingMessage("Waiting for CoFHE result...");

        let attempts = 0;
        liquidationPollingRef.current.attempts = 0;

        return await new Promise<boolean>((resolve) => {
          const poll = async () => {
            attempts += 1;
            liquidationPollingRef.current.attempts = attempts;

            const next = await refreshLiquidatable();
            const isLiquidatable = Boolean(next.data);

            if (isLiquidatable) {
              if (liquidationPollingRef.current.toastId) {
                removeToast(liquidationPollingRef.current.toastId);
              }
              addToast({ variant: "success", message: "Borrower is liquidatable." });
              setLiquidationPollingActive(false);
              setLiquidationPollingMessage(null);
              resolve(true);
              return;
            }

            if (attempts >= maxAttempts) {
              if (liquidationPollingRef.current.toastId) {
                removeToast(liquidationPollingRef.current.toastId);
              }
              addToast({
                variant: "error",
                message: "Timed out waiting for liquidation result. Try again.",
              });
              setLiquidationPollingActive(false);
              setLiquidationPollingMessage("Timed out waiting for liquidation result.");
              resolve(false);
              return;
            }

            liquidationPollingRef.current.timer = window.setTimeout(poll, intervalMs);
          };

          poll();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Liquidation request failed.";
        addToast({ variant: "error", message });
        setStatus(null);
        return false;
      }
    },
    [addToast, canWrite, publicClient, refreshLiquidatable, removeToast, writer]
  );

  useEffect(() => {
    return () => {
      if (liquidationPollingRef.current.timer) {
        window.clearTimeout(liquidationPollingRef.current.timer);
      }
    };
  }, []);

  const openAuction = useCallback(
    async (borrowerAddress: Address) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "openAuction",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 3_000_000n, // Gas limit for auction operations
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Auction opened." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open auction.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, publicClient, writer]
  );

  const submitLiquidationBid = useCallback(
    async (borrowerAddress: Address, bidAmount: string) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const bidValue = parsePositiveBigint(bidAmount);
      if (!bidValue) {
        addToast({ variant: "error", message: "Bid must be a positive integer." });
        return false;
      }

      try {
        const [encryptedBid] = await encryptor.encryptInputsAsync([Encryptable.uint128(bidValue)]);
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "submitBid",
          args: [borrowerAddress, encryptedBid],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 5_000_000n, // High gas limit for FHE bid submission
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Bid submitted." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bid failed.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, encryptor, publicClient, writer]
  );

  const selectWinningBid = useCallback(
    async (borrowerAddress: Address) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "selectWinningBid",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 5_000_000n, // High gas limit for FHE winner selection
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Winner selection requested." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Selection failed.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, publicClient, writer]
  );

  const registerENSWallet = useCallback(
    async (ensName: string, walletAddress: Address) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "registerENSWallet",
          args: [ensName, walletAddress],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 2_000_000n, // Gas limit for ENS registration
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Wallet linked." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to link wallet.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, publicClient, writer]
  );

  const requestCreditTierUpdate = useCallback(async () => {
    if (!canWrite) {
      addToast({ variant: "error", message: "Connect your wallet to continue." });
      return false;
    }

    if (!account.address) {
      addToast({ variant: "error", message: "Wallet address is unavailable." });
      return false;
    }

    try {
      const hash = await writer.writeContractAsync({
        address: walnutContractAddress,
        abi: walnutV1Abi,
        functionName: "requestCreditTierUpdate",
        args: [account.address],
        chain: arbitrumSepolia,
        account: account.address!,
        gas: 5_000_000n, // High gas limit for FHE credit tier update
      });
      setLastTxHash(hash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const toastId = addToast({ variant: "pending", message: "Waiting for CoFHE result..." });
      creditTierPollingRef.current.toastId = toastId;
      setCreditTierPollingActive(true);

      const previousTier = creditTier;
      let attempt = 0;

      while (attempt < DEFAULT_LIQUIDATION_POLL_MAX) {
        attempt += 1;
        const result = await refreshCreditTier();
        if (typeof result.data === "bigint" && result.data !== previousTier) {
          if (creditTierPollingRef.current.toastId) {
            removeToast(creditTierPollingRef.current.toastId);
          }
          addToast({ variant: "success", message: "Credit tier updated." });
          setCreditTierPollingActive(false);
          return true;
        }

        await new Promise((resolve) => window.setTimeout(resolve, DEFAULT_LIQUIDATION_POLL_INTERVAL_MS));
      }

      if (creditTierPollingRef.current.toastId) {
        removeToast(creditTierPollingRef.current.toastId);
      }
      addToast({ variant: "error", message: "Timed out waiting for credit tier update." });
      setCreditTierPollingActive(false);
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credit tier request failed.";
      addToast({ variant: "error", message });
      setCreditTierPollingActive(false);
      return false;
    }
  }, [addToast, canWrite, creditTier, publicClient, refreshCreditTier, removeToast, writer]);

  const getAuctionBorrowers = useCallback(async () => {
    if (!publicClient) return [] as Address[];
    try {
      const borrowers = await publicClient.readContract({
        address: walnutContractAddress,
        abi: walnutV1Abi,
        functionName: "getAuctionBorrowers",
        args: [],
      });
      return Array.isArray(borrowers) ? (borrowers as Address[]) : [];
    } catch {
      return [];
    }
  }, [publicClient]);

  const getAuctionSummary = useCallback(
    async (borrowerAddress: Address): Promise<AuctionSummary | null> => {
      if (!publicClient) return null;
      try {
        const summary = await publicClient.readContract({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "getAuctionSummary",
          args: [borrowerAddress],
        });

        if (!Array.isArray(summary) || summary.length < 5) return null;

        const [auctionBorrower, endTime, bidCount, settled, active] =
          summary as [Address, bigint, bigint, boolean, boolean];

        return {
          borrower: auctionBorrower,
          active,
          settled,
          endTime,
          bidCount,
        };
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  const getPendingWinnerRequestId = useCallback(
    async (borrowerAddress: Address) => {
      if (!publicClient) return null;
      try {
        const value = await publicClient.readContract({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "getPendingWinnerRequestId",
          args: [borrowerAddress],
        });
        return typeof value === "bigint" ? value : null;
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  const getCurrentBlockTimestamp = useCallback(async () => {
    if (!publicClient) return null;
    try {
      const block = await publicClient.getBlock();
      return block.timestamp;
    } catch {
      return null;
    }
  }, [publicClient]);

  const getOfferCount = useCallback(async () => {
    if (!publicClient) return 0n;
    try {
      const value = await publicClient.readContract({
        address: walnutContractAddress,
        abi: walnutV1Abi,
        functionName: "offerCount",
        args: [],
      });
      return typeof value === "bigint" ? value : 0n;
    } catch {
      return 0n;
    }
  }, [publicClient]);

  const getOfferMeta = useCallback(
    async (offerId: bigint) => {
      if (!publicClient) return null;
      try {
        const meta = await publicClient.readContract({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "getOfferMeta",
          args: [offerId],
        });

        if (!Array.isArray(meta) || meta.length < 3) return null;

        const [lender, active, matchedBorrower] = meta as [Address, boolean, Address];
        const matched = matchedBorrower !== "0x0000000000000000000000000000000000000000";
        return { lender, borrower: matchedBorrower, active, matched };
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  const getOfferTerms = useCallback(
    async (offerId: bigint) => {
      if (!publicClient || !permit.hasPermit) return null;
      try {
        const [amountHandle, aprHandle, tenorHandle] = await Promise.all([
          publicClient.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getEncryptedOfferSize",
            args: [offerId],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getEncryptedOfferAPR",
            args: [offerId],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getEncryptedOfferTenor",
            args: [offerId],
          }) as Promise<bigint>,
        ]);

        const accountAddress = account.address ?? "0x0000000000000000000000000000000000000000";
        const baseDecrypt = (handle: { ctHash: bigint } | bigint) => {
          const ctHash = typeof handle === "bigint" ? handle : handle.ctHash;
          return decryptForView(ctHash, accountAddress);
        };

        const [amount, apr, tenor] = await Promise.all([
          baseDecrypt(amountHandle),
          baseDecrypt(aprHandle),
          baseDecrypt(tenorHandle),
        ]);

        return {
          amount: typeof amount === "bigint" ? amount : undefined,
          apr: typeof apr === "bigint" ? apr : undefined,
          tenor: typeof tenor === "bigint" ? tenor : undefined,
        };
      } catch {
        return null;
      }
    },
    [account.address, decryptForView, permit.hasPermit, publicClient]
  );

  const createOffer = useCallback(
    async ({ amount, apr, tenor }: { amount: string; apr: string; tenor: string }) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const amountValue = parsePositiveBigint(amount);
      const aprValue = parsePositiveBigint(apr);
      const tenorValue = parsePositiveBigint(tenor);

      if (!amountValue || !aprValue || !tenorValue) {
        addToast({ variant: "error", message: "Offer inputs must be positive integers." });
        return false;
      }

      try {
        const [encryptedAmount, encryptedApr, encryptedTenor] = await encryptor.encryptInputsAsync([
          Encryptable.uint128(amountValue),
          Encryptable.uint128(aprValue),
          Encryptable.uint128(tenorValue),
        ]);

        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "postOffer",
          args: [encryptedAmount, encryptedApr, encryptedTenor],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 5_000_000n, // High gas limit for FHE offer creation
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Offer created." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create offer.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, encryptor, publicClient, writer]
  );

  const matchOffer = useCallback(
    async (offerId: bigint) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writer.writeContractAsync({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "matchOffer",
          args: [offerId],
          chain: arbitrumSepolia,
          account: account.address!,
          gas: 3_000_000n, // Gas limit for offer matching
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        addToast({ variant: "success", message: "Offer matched." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to match offer.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [addToast, canWrite, publicClient, writer]
  );

  const isWriting = writer.isPending;
  const isEncrypting = encryptor.isEncrypting;

  return {
    account,
    status,
    setStatus,
    lastTxHash,
    canRead,
    canWrite,
    canUseContract,
    isWalletReady,
    isConnectionTransient,
    isOnTargetChain,
    permit,
    switchChainAsync,
    refreshBalances,
    collateral,
    debt,
    totalPoolCollateral,
    totalPoolDebt,
    collateralDecrypting,
    debtDecrypting,
    totalPoolCollateralDecrypting,
    totalPoolDebtDecrypting,
    healthFactorValue,
    healthFactorDecrypting,
    healthFactorError,
    fetchHealthFactor,
    aggregatedCollateralValue,
    aggregatedCollateralDecrypting,
    aggregatedCollateralError,
    fetchAggregatedCollateral,
    liquidatable,
    refreshLiquidatable,
    linkedWallets,
    linkedWalletCount,
    linkedWalletsLoading,
    creditTier,
    creditTierLoading,
    tierLTV,
    tierLTVLoading,
    requestCreditTierUpdate,
    creditTierPollingActive,
    liquidationPollingActive,
    liquidationPollingMessage,
    submitEncryptedAmount,
    requestLiquidationCheck,
    openAuction,
    submitLiquidationBid,
    selectWinningBid,
    registerENSWallet,
    getAuctionBorrowers,
    getAuctionSummary,
    getPendingWinnerRequestId,
    getCurrentBlockTimestamp,
    getOfferCount,
    getOfferMeta,
    getOfferTerms,
    createOffer,
    matchOffer,
    hasDecryptPending,
    hasDecryptError,
    isWriting,
    isEncrypting,
  } as const;
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;
