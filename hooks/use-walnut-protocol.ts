/*
 * ROOT CAUSE ANALYSIS - Dashboard Showing Zero Values Bug
 * 
 * Q: Is getEncryptedCollateral() being called?
 * A: YES - Lines 177-186 call getEncryptedCollateral and getEncryptedDebt via useReadContract
 * 
 * Q: Is the result being passed to a decrypt hook?
 * A: NO - The result is NOT passed to a decrypt hook. Instead, manual decryption is done in useEffect hooks (lines 267-308 and 310-348)
 * 
 * Q: Is the permit available at the time of the decrypt call?
 * A: PARTIALLY - The useEffect checks `permit.hasPermit` but does NOT check if permit is READY before calling decryptForView
 * 
 * Q: Is the decrypt hook waiting for the permit before attempting decryption?
 * A: NO - There is no proper "isReady" check. The code checks `permit.hasPermit` but this may be true before the permit is actually usable
 * 
 * Q: Is there a loading/timing issue where decrypt runs before permit is ready?
 * A: YES - This is the PRIMARY BUG. The decrypt attempts happen as soon as `permit.hasPermit` is true, 
 *    but the permit may not be fully initialized yet. The code needs to wait for `permit.isReady` 
 *    (or equivalent) before attempting decryption.
 * 
 * SOLUTION: 
 * 1. Check permit.isReady (not just permit.hasPermit) before enabling contract reads
 * 2. Check permit.isReady before attempting decryption in useEffect
 * 3. Auto-trigger decrypt when permit becomes ready (not requiring user click)
 */

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
  useCofheWriteContract,
} from "@cofhe/react";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { walnutChainId, walnutContractAddress, walnutLendingAbi } from "@/lib/walnut-contract";
import { usePrivara } from "@/hooks/use-privara";

const BALANCE_REFRESH_INTERVAL_MS = 30_000;
const SENDER_NOT_ALLOWED_SELECTOR = "0xd0d25976";
const MAX_HEALTH_FACTOR_BPS = 100_000n; // 10.00 on HEALTH_FACTOR_SCALE=10_000
type RepaySettlementAmounts = {
  interestAmount: bigint;
  protocolFee: bigint;
};

export type WalnutAction = "deposit" | "borrow" | "repay" | "withdraw";
export type RepaySettlementState =
  | "idle"
  | "repay_pending"
  | "repay_confirmed"
  | "settlement_pending"
  | "settlement_confirmed"
  | "settlement_failed";

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

function parseUSDCAmount(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  try {
    const [whole = "0", fraction = ""] = trimmed.split(".");
    const value = BigInt(`${whole}${fraction.padEnd(6, "0").slice(0, 6)}`);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

function assertSuccessReceipt(receipt: { status?: "success" | "reverted" }) {
  if (receipt.status && receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

function isBigint(value: unknown): value is bigint {
  return typeof value === "bigint";
}

type EncryptedUint128Handle = bigint | `0x${string}`;

function normalizeEncryptedUint128Handle(value: unknown): EncryptedUint128Handle | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value as `0x${string}`;
  }

  if (value && typeof value === "object" && "ctHash" in value) {
    return normalizeEncryptedUint128Handle((value as { ctHash?: unknown }).ctHash);
  }

  return undefined;
}

function isZeroEncryptedUint128Handle(handle: EncryptedUint128Handle) {
  return typeof handle === "bigint"
    ? handle === 0n
    : BigInt(handle) === 0n;
}

function tierFromRepaymentCount(count: bigint): bigint {
  if (count >= 10n) return 4n;
  if (count >= 7n) return 3n;
  if (count >= 4n) return 2n;
  if (count >= 2n) return 1n;
  return 0n;
}

async function decryptUint128Handle(
  encryptedValue: unknown,
  accountAddress: Address,
  decryptForView: (ctHash: bigint | string, accountAddress: Address) => Promise<bigint | undefined>
): Promise<bigint | undefined> {
  const ctHash = normalizeEncryptedUint128Handle(encryptedValue);
  
  if (ctHash === undefined) return undefined;
  
  // For new wallets with no activity, ctHash will be zero.
  // Return 0 instead of trying to decrypt (which would fail)
  if (isZeroEncryptedUint128Handle(ctHash)) return 0n;
  
  return decryptForView(ctHash, accountAddress);
}

function normalizeInterestTuple(value: unknown): RepaySettlementAmounts {
  if (!Array.isArray(value) || value.length < 2) {
    return { interestAmount: 0n, protocolFee: 0n };
  }

  const [interestAmount, protocolFee] = value;
  return {
    interestAmount: typeof interestAmount === "bigint" ? interestAmount : 0n,
    protocolFee: typeof protocolFee === "bigint" ? protocolFee : 0n,
  };
}

export function useCreditTier(borrower?: Address) {
  const { data, isLoading, refetch } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
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
    abi: walnutLendingAbi,
    functionName: "tierLTVs",
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
  const privara = usePrivara();

  const [status, setStatus] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [repayTxHash, setRepayTxHash] = useState<string | null>(null);
  const [settlementTxHash, setSettlementTxHash] = useState<string | null>(null);
  const [repaySettlementState, setRepaySettlementState] = useState<RepaySettlementState>("idle");
  const [repaySettlementError, setRepaySettlementError] = useState<string | null>(null);
  const [lastRepayAmount, setLastRepayAmount] = useState<bigint | null>(null);
  const [lastRepaySettlementAmounts, setLastRepaySettlementAmounts] =
    useState<RepaySettlementAmounts | null>(null);
  const [healthFactorValue, setHealthFactorValue] = useState<bigint | undefined>(undefined);
  const [healthFactorDecrypting, setHealthFactorDecrypting] = useState(false);
  const [healthFactorError, setHealthFactorError] = useState<string | null>(null);
  const [aggregatedCollateralValue, setAggregatedCollateralValue] = useState<bigint | undefined>(undefined);
  const [aggregatedCollateralDecrypting, setAggregatedCollateralDecrypting] = useState(false);
  const [aggregatedCollateralError, setAggregatedCollateralError] = useState<string | null>(null);
  const [creditTierPollingActive, setCreditTierPollingActive] = useState(false);
  const [fallbackCreditTier, setFallbackCreditTier] = useState<bigint | undefined>(undefined);
  const creditTierPollingRef = useRef<{
    toastId?: string;
  }>({});

  const isWalletReady = Boolean(account.isConnected && account.address);
  const isConnectionTransient = account.status === "reconnecting" || (account.isConnected && !account.address);
  const isOnTargetChain = account.chainId === walnutChainId;
  const canUseContract = Boolean(walnutContractAddress && walnutLendingAbi && publicClient);
  const isPermitReady = Boolean(
    permit.hasPermit &&
    permit.isPermitValid &&
    !permit.isPermitInitializing &&
    permit.permitHash
  );
  const canRead = Boolean(
    isWalletReady && 
    isOnTargetChain && 
    canUseContract && 
    isPermitReady
  );
  const canWrite = Boolean(isWalletReady && isOnTargetChain && canUseContract);

  const { switchChainAsync } = useSwitchChain();

  // Read encrypted values as structs (contract returns EncryptedValue{ctHash, utype})
  const { data: collateralStruct, isLoading: collateralStructLoading, refetch: refetchCollateralStruct, error: collateralStructError } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getEncryptedCollateral",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  const { data: debtStruct, isLoading: debtStructLoading, refetch: refetchDebtStruct, error: debtStructError } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getEncryptedDebt",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  const {
    data: totalDepositedValue,
    isLoading: totalDepositedLoading,
    refetch: refetchTotalDeposited,
  } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "totalDeposited",
  });

  const {
    data: totalBorrowedValue,
    isLoading: totalBorrowedLoading,
    refetch: refetchTotalBorrowed,
  } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "totalBorrowed",
  });

  const {
    data: utilizationRateValue,
    isLoading: utilizationRateLoading,
    refetch: refetchUtilizationRate,
  } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "utilizationRate",
  });

  const {
    data: borrowRateValue,
    isLoading: borrowRateLoading,
    refetch: refetchBorrowRate,
  } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "currentBorrowRate",
  });

  // Log contract read errors
  useEffect(() => {
    if (collateralStructError) {
      console.error("[Walnut] getEncryptedCollateral error:", collateralStructError);
    }
    if (debtStructError) {
      console.error("[Walnut] getEncryptedDebt error:", debtStructError);
    }
  }, [collateralStructError, debtStructError]);

  // Manually decrypt the ctHash from each struct
  const [collateralValue, setCollateralValue] = useState<bigint | undefined>(undefined);
  const [collateralDecrypting, setCollateralDecrypting] = useState(false);
  const [collateralError, setCollateralError] = useState<Error | undefined>(undefined);

  const [debtValue, setDebtValue] = useState<bigint | undefined>(undefined);
  const [debtDecrypting, setDebtDecrypting] = useState(false);
  const [debtError, setDebtError] = useState<Error | undefined>(undefined);
  const decryptInflightRef = useRef(0);

  // Define decryptForView before the useEffect hooks that depend on it
  const decryptForView = useCallback(
    async (ctHash: bigint | string, accountAddress: Address) => {
      if (!cofheClient) {
        console.log("[Walnut Debug] decryptForView: No cofheClient available");
        return undefined;
      }

      console.log("[Walnut Debug] decryptForView starting:", {
        ctHash: ctHash.toString(),
        accountAddress,
        chainId: walnutChainId,
        hasPermitHash: !!permit.permitHash,
        permitHash: permit.permitHash
      });
      decryptInflightRef.current += 1;

      const builder = cofheClient
        .decryptForView(ctHash, FheTypes.Uint128)
        .setChainId(walnutChainId)
        .setAccount(accountAddress);

      const withPermitBuilder = permit.permitHash
        ? builder.withPermit(permit.permitHash)
        : builder.withPermit();

      console.log("[Walnut Debug] decryptForView: Executing decryption with permit:", {
        explicitPermit: !!permit.permitHash
      });

      try {
        const decrypted = await withPermitBuilder.execute();
        console.log("[Walnut Debug] decryptForView: Success!", {
          decrypted: typeof decrypted === "bigint" ? decrypted.toString() : decrypted
        });
        return typeof decrypted === "bigint" ? decrypted : undefined;
      } catch (error) {
        console.error("[Walnut Debug] decryptForView: Failed!", {
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorObject: error,
          ctHash: ctHash.toString(),
          accountAddress,
          permitHash: permit.permitHash,
          chainId: walnutChainId
        });
        throw error;
      } finally {
        decryptInflightRef.current = Math.max(0, decryptInflightRef.current - 1);
      }
    },
    [cofheClient, permit.permitHash]
  );

  // Decrypt collateral when struct is available
  useEffect(() => {
    console.log("[Walnut] Collateral decrypt hook triggered", {
      hasAddress: !!account.address,
      address: account.address,
      hasPermit: permit.hasPermit,
      isPermitValid: permit.isPermitValid,
      isPermitInitializing: permit.isPermitInitializing,
      canRead,
      collateralStructLoading,
      collateralStructError: collateralStructError?.message,
      collateralStruct:
        typeof collateralStruct === "bigint" ? collateralStruct.toString() : collateralStruct,
      contractAddress: walnutContractAddress,
    });

    if (!account.address || !isPermitReady) {
      console.log("[Walnut] Skipping decrypt - permit not ready");
      return;
    }
    
    const ctHash = normalizeEncryptedUint128Handle(collateralStruct);
    
    console.log("[Walnut] permit ready:", isPermitReady);
    console.log("[Walnut] permit object:", permit);
    console.log("[Walnut] encrypted handle:", ctHash?.toString());
    
    if (ctHash === undefined) {
      console.log("[Walnut] ctHash is undefined, setting collateral to undefined");
      console.log("[Walnut] This usually means: 1) No deposit yet or 2) the contract read failed.");
      setCollateralValue(undefined);
      return;
    }
    
    if (isZeroEncryptedUint128Handle(ctHash)) {
      console.log("[Walnut] ctHash is 0n, setting collateral to 0n");
      setCollateralValue(0n);
      return;
    }

    console.log("[Walnut] Starting decryption for ctHash:", ctHash.toString());
    let active = true;
    setCollateralDecrypting(true);
    setCollateralError(undefined);

    decryptForView(ctHash, account.address)
      .then((value) => {
        if (active) {
          console.log("[Walnut] isDecrypted: true");
          console.log("[Walnut] decryptedValue:", value?.toString());
          setCollateralValue(value);
          setCollateralDecrypting(false);
        }
      })
      .catch((error) => {
        if (active) {
          console.error("[Walnut] Collateral decrypt error:", error instanceof Error ? error.message : error);
          console.log("[Walnut] isDecrypted: false (error)");
          setCollateralError(error instanceof Error ? error : new Error("Decryption failed"));
          setCollateralDecrypting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [collateralStruct, collateralStructLoading, collateralStructError, account.address, permit, isPermitReady, canRead, decryptForView]);

  // Decrypt debt when struct is available
  useEffect(() => {
    if (!account.address || !isPermitReady) {
      return;
    }
    
    const ctHash = normalizeEncryptedUint128Handle(debtStruct);
    
    if (ctHash === undefined) {
      setDebtValue(undefined);
      return;
    }
    
    if (isZeroEncryptedUint128Handle(ctHash)) {
      setDebtValue(0n);
      return;
    }

    let active = true;
    setDebtDecrypting(true);
    setDebtError(undefined);

    decryptForView(ctHash, account.address)
      .then((value) => {
        if (active) {
          setDebtValue(value);
          setDebtDecrypting(false);
        }
      })
      .catch((error) => {
        if (active) {
          console.error("[Walnut Debug] Debt decrypt error:", error instanceof Error ? error.message : error);
          setDebtError(error instanceof Error ? error : new Error("Decryption failed"));
          setDebtDecrypting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debtStruct, account.address, isPermitReady, decryptForView]);

  // Create compatible interface for backward compatibility
  const collateral = {
    encrypted: collateralStruct,
    decrypted: {
      data: collateralValue,
      error: collateralError,
      isFetching: collateralDecrypting,
      isLoading: collateralStructLoading || collateralDecrypting,
      refetch: async () => {
        await refetchCollateralStruct();
      },
    },
  };

  const debt = {
    encrypted: debtStruct,
    decrypted: {
      data: debtValue,
      error: debtError,
      isFetching: debtDecrypting,
      isLoading: debtStructLoading || debtDecrypting,
      refetch: async () => {
        await refetchDebtStruct();
      },
    },
  };

  const totalPoolCollateral: CofheDecryptResult<bigint> = {
    encrypted: totalDepositedValue,
    decrypted: {
      data: typeof totalDepositedValue === "bigint" ? totalDepositedValue : undefined,
      error: undefined,
      isFetching: false,
      isLoading: totalDepositedLoading,
      refetch: refetchTotalDeposited,
    },
  };

  const totalPoolDebt: CofheDecryptResult<bigint> = {
    encrypted: totalBorrowedValue,
    decrypted: {
      data: typeof totalBorrowedValue === "bigint" ? totalBorrowedValue : undefined,
      error: undefined,
      isFetching: false,
      isLoading: totalBorrowedLoading,
      refetch: refetchTotalBorrowed,
    },
  };

  const { creditTier, creditTierLoading, refreshCreditTier } = useCreditTier(account.address);
  const effectiveCreditTier = fallbackCreditTier ?? creditTier;
  const { tierLTV, tierLTVLoading } = useTierLTV(effectiveCreditTier);

  const hasDecryptPending = collateralDecrypting || debtDecrypting;
  
  // Show error only if decryption actually failed (not just missing data or expected private values)
  const hasDecryptError = Boolean(
    canRead && 
    !hasDecryptPending && 
    (collateralError || debtError)
  );

  const refreshLocalCreditTier = useCallback(async () => {
    if (!publicClient || !account.address || !permit.hasPermit || !canRead) {
      setFallbackCreditTier(undefined);
      return undefined;
    }

    try {
      const repaymentStruct = await publicClient.readContract({
        address: walnutContractAddress,
    abi: walnutLendingAbi,
        functionName: "getEncryptedRepaymentCount",
        args: [account.address],
      });

      const repaymentCount = await decryptUint128Handle(repaymentStruct, account.address, decryptForView);
      if (typeof repaymentCount !== "bigint") return undefined;

      const localTier = tierFromRepaymentCount(repaymentCount);
      setFallbackCreditTier(localTier);
      return localTier;
    } catch {
      return undefined;
    }
  }, [account.address, canRead, decryptForView, permit.hasPermit, publicClient]);

  useEffect(() => {
    void refreshLocalCreditTier();
  }, [refreshLocalCreditTier]);

  const refreshBalances = useCallback(async () => {
    if (!canRead) return;
    try {
      await Promise.all([
        collateral.decrypted.refetch(),
        debt.decrypted.refetch(),
        totalPoolCollateral.decrypted.refetch(),
        totalPoolDebt.decrypted.refetch(),
        refetchUtilizationRate(),
        refetchBorrowRate(),
        refreshLocalCreditTier(),
      ]);
    } catch (error) {
      console.error("Failed to refresh balances:", error);
      // Silently fail - balances will retry on next interval
    }
  }, [
    canRead,
    collateral.decrypted,
    debt.decrypted,
    refetchBorrowRate,
    refetchUtilizationRate,
    refreshLocalCreditTier,
    totalPoolCollateral.decrypted,
    totalPoolDebt.decrypted,
  ]);

  useEffect(() => {
    if (!canRead) return;

    const id = window.setInterval(() => {
      void refreshBalances();
    }, BALANCE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [canRead, refreshBalances]);

  const fetchHealthFactor = useCallback(
    async (borrower?: Address) => {
      const targetAddress = borrower ?? account.address;
      if (!publicClient || !targetAddress || !permit.hasPermit || !canRead) {
        setHealthFactorError("Private access is required to compute health factor.");
        setHealthFactorDecrypting(false);
        return undefined;
      }

      setHealthFactorDecrypting(true);
      setHealthFactorError(null);
      try {
        const currentCollateral =
          targetAddress === account.address && typeof collateralValue === "bigint"
            ? collateralValue
            : await (async () => {
                const collateralStruct = await publicClient.readContract({
                  address: walnutContractAddress,
                  abi: walnutLendingAbi,
                  functionName: "getEncryptedCollateral",
                  args: [targetAddress],
                });
                return decryptUint128Handle(collateralStruct, targetAddress, decryptForView);
              })();

        const currentDebt =
          targetAddress === account.address && typeof debtValue === "bigint"
            ? debtValue
            : await (async () => {
                const debtStruct = await publicClient.readContract({
                  address: walnutContractAddress,
                  abi: walnutLendingAbi,
                  functionName: "getEncryptedDebt",
                  args: [targetAddress],
                });
                return decryptUint128Handle(debtStruct, targetAddress, decryptForView);
              })();

        if (typeof currentCollateral !== "bigint" || typeof currentDebt !== "bigint") {
          setHealthFactorError("Unable to decrypt balances for health factor.");
          return undefined;
        }

        const safeDebt = currentDebt === 0n ? 1n : currentDebt;
        const computedHealthFactor = (currentCollateral * 10000n) / safeDebt;
        const normalizedHealthFactor =
          computedHealthFactor > MAX_HEALTH_FACTOR_BPS ? MAX_HEALTH_FACTOR_BPS : computedHealthFactor;
        setHealthFactorValue(normalizedHealthFactor);
        return normalizedHealthFactor;
      } catch (error) {
        setHealthFactorError(error instanceof Error ? error.message : "Failed to compute health factor.");
        return undefined;
      } finally {
        setHealthFactorDecrypting(false);
      }
    },
    [account.address, canRead, collateralValue, debtValue, decryptForView, permit.hasPermit, publicClient]
  );

  const fetchAggregatedCollateral = useCallback(
    async (owner?: Address) => {
      // Aggregated collateral computation requires a transaction (not a view function)
      // because the contract needs to call FHE.allow() to grant decryption access.
      // This is disabled for now to avoid unnecessary transactions.
      console.warn("[Walnut Debug] getAggregatedCollateral requires a transaction (not a view function) - skipping");
      setAggregatedCollateralError("Aggregated collateral requires a transaction to compute");
      setAggregatedCollateralDecrypting(false);
      return undefined;
    },
    []
  );

  const writeWithGasDebug = useCallback(
    async (
      config: Parameters<typeof writer.writeContractAsync>[0],
      meta: { operation: string; action?: string }
    ) => {
      const runId = "pre-fix";
      let finalConfig = config;
      
      try {
        const [block, feeEstimate] = await Promise.all([
          publicClient?.getBlock().catch(() => null),
          publicClient?.estimateFeesPerGas().catch(() => null),
        ]);
        console.info("[Walnut Gas Debug] pre-write fee snapshot", {
          operation: meta.operation,
          action: meta.action ?? null,
          blockBaseFee: block?.baseFeePerGas ? block.baseFeePerGas.toString() : null,
          suggestedMaxFee: feeEstimate?.maxFeePerGas ? feeEstimate.maxFeePerGas.toString() : null,
          suggestedMaxPriorityFee: feeEstimate?.maxPriorityFeePerGas
            ? feeEstimate.maxPriorityFeePerGas.toString()
            : null,
        });
        
        // Add 20% buffer to gas fees to account for base fee fluctuations
        if (feeEstimate?.maxFeePerGas) {
          const bufferedMaxFee = (feeEstimate.maxFeePerGas * 120n) / 100n;
          const bufferedPriorityFee = feeEstimate.maxPriorityFeePerGas 
            ? (feeEstimate.maxPriorityFeePerGas * 120n) / 100n
            : undefined;
          
          finalConfig = {
            ...config,
            maxFeePerGas: bufferedMaxFee,
            ...(bufferedPriorityFee && { maxPriorityFeePerGas: bufferedPriorityFee }),
          } as typeof config;
          
          console.info("[Walnut Gas Debug] Applied 20% buffer to gas fees", {
            originalMaxFee: feeEstimate.maxFeePerGas.toString(),
            bufferedMaxFee: bufferedMaxFee.toString(),
          });
        }
      } catch {
        // no-op: debug logging must not block tx flow
      }

      try {
        return await writer.writeContractAsync(finalConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const parsedMaxFee = message.match(/maxFeePerGas:\s*(\d+)/)?.[1] ?? null;
        const parsedBaseFee = message.match(/baseFee:\s*(\d+)/)?.[1] ?? null;
        console.error("[Walnut Gas Debug] write failed", {
          operation: meta.operation,
          action: meta.action ?? null,
          message,
          parsedMaxFee,
          parsedBaseFee,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorObject: error,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        throw error;
      }
    },
    [account.chainId, permit.hasPermit, permit.isPermitValid, publicClient, writer]
  );

  const submitEncryptedAmount = useCallback(
    async (action: WalnutAction, amount: string) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const value = parseUSDCAmount(amount);
      if (!value) {
        addToast({ variant: "error", message: "Amount must be a positive integer." });
        return false;
      }

      if (action === "repay" && typeof debtValue === "bigint" && value > debtValue) {
        addToast({
          variant: "error",
          message: `Repay amount exceeds current debt (${debtValue.toString()}).`,
        });
        return false;
      }

      try {
        let repaySettlementAmounts: RepaySettlementAmounts | null = null;

        if (action === "repay") {
          setRepaySettlementState("repay_pending");
          setRepaySettlementError(null);
          setRepayTxHash(null);
          setSettlementTxHash(null);
          setLastRepayAmount(value);
          setLastRepaySettlementAmounts(null);

          if (publicClient && account.address && typeof debtValue === "bigint") {
            const interestTuple = await publicClient.readContract({
              address: walnutContractAddress,
              abi: walnutLendingAbi,
              functionName: "calculateInterest",
              args: [account.address, debtValue],
            });
            repaySettlementAmounts = normalizeInterestTuple(interestTuple);
            setLastRepaySettlementAmounts(repaySettlementAmounts);
          }
        }

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
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutLendingAbi,
          functionName,
          args: [encrypted],
          chain: arbitrumSepolia,
          account: account.address!,
          // Let wagmi estimate gas automatically for FHE operations
        }, { operation: functionName, action });

        setLastTxHash(hash);
        if (action === "repay") {
          setRepayTxHash(hash);
        }
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          assertSuccessReceipt(receipt);
        }

        if (action === "repay" && account.address) {
          setRepaySettlementState("repay_confirmed");

          if (!repaySettlementAmounts || repaySettlementAmounts.interestAmount <= 0n) {
            setRepaySettlementState("settlement_confirmed");
            setRepaySettlementError(null);
            addToast({ variant: "success", message: "Repay confirmed. No private interest accrued." });
            setStatus(null);
            await refreshBalances();
            return true;
          }

          addToast({ variant: "pending", message: "Repay confirmed. Settling private interest..." });
          setRepaySettlementState("settlement_pending");

          const settlement = await privara.settleRepayInterest({
            user: account.address,
            amount: value,
            interestAmount: repaySettlementAmounts.interestAmount,
            protocolFee: repaySettlementAmounts.protocolFee,
          });

          if (!settlement.ok || !settlement.hash) {
            const errorMessage = settlement.message ?? "Private settlement failed.";
            setRepaySettlementState("settlement_failed");
            setRepaySettlementError(errorMessage);
            addToast({ variant: "error", message: errorMessage });
            setStatus(null);
            await refreshBalances();
            return false;
          }

          setSettlementTxHash(settlement.hash);
          setRepaySettlementState("settlement_confirmed");
          setRepaySettlementError(null);
          addToast({ variant: "success", message: "Repay and private settlement confirmed." });
          setStatus(null);
          await refreshBalances();
          return true;
        }

        addToast({ variant: "success", message: "Transaction confirmed." });
        setStatus(null);
        await refreshBalances();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transaction failed.";
        if (action === "repay" && repaySettlementState !== "settlement_failed") {
          setRepaySettlementState("settlement_failed");
          setRepaySettlementError(message);
        }
        addToast({ variant: "error", message });
        setStatus(null);
        return false;
      }
    },
    [
      account.address,
      account.chainId,
      addToast,
      canWrite,
      debtValue,
      encryptor,
      privara,
      publicClient,
      refreshBalances,
      repaySettlementState,
      writeWithGasDebug,
    ]
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
      const hash = await writeWithGasDebug({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "requestCreditTierUpdate",
        args: [account.address],
        chain: arbitrumSepolia,
        account: account.address!,
      }, { operation: "requestCreditTierUpdate" });
      setLastTxHash(hash);
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assertSuccessReceipt(receipt);
      }

      const toastId = addToast({ variant: "pending", message: "Waiting for CoFHE result..." });
      creditTierPollingRef.current.toastId = toastId;
      setCreditTierPollingActive(true);

      const previousTier = creditTier;
      let attempt = 0;

      while (attempt < 20) {
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

        await new Promise((resolve) => window.setTimeout(resolve, 15_000));
      }

      if (creditTierPollingRef.current.toastId) {
        removeToast(creditTierPollingRef.current.toastId);
      }
      addToast({ variant: "error", message: "Timed out waiting for credit tier update." });
      setCreditTierPollingActive(false);
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credit tier request failed.";
      const isSenderNotAllowed =
        message.includes(SENDER_NOT_ALLOWED_SELECTOR) || message.includes("SenderNotAllowed");

      if (isSenderNotAllowed && publicClient && account.address && permit.hasPermit) {
        try {
          // Fallback path: compute tier locally from user's encrypted repayment count.
          const repaymentStruct = await publicClient.readContract({
            address: walnutContractAddress,
            abi: walnutLendingAbi,
            functionName: "getEncryptedRepaymentCount",
            args: [account.address],
          });

          const ctHash = normalizeEncryptedUint128Handle(repaymentStruct);

          if (ctHash !== undefined && !isZeroEncryptedUint128Handle(ctHash)) {
            const repaymentCount = await decryptForView(ctHash, account.address);
            if (typeof repaymentCount === "bigint") {
              const localTier = tierFromRepaymentCount(repaymentCount);
              setFallbackCreditTier(localTier);
              addToast({
                variant: "success",
                message: `Credit tier available locally (tier ${localTier.toString()}).`,
              });
              setCreditTierPollingActive(false);
              return true;
            }
          }
        } catch {
          // If fallback also fails, show the original contract error below.
        }
      }

      addToast({ variant: "error", message });
      setCreditTierPollingActive(false);
      return false;
    }
  }, [
    account.address,
    addToast,
    canWrite,
    creditTier,
    decryptForView,
    permit.hasPermit,
    publicClient,
    refreshCreditTier,
    removeToast,
    writeWithGasDebug,
  ]);



  const retryRepaySettlement = useCallback(async () => {
    if (!account.address) {
      addToast({ variant: "error", message: "Connect your wallet to continue." });
      return false;
    }

    if (!lastRepayAmount || lastRepayAmount <= 0n) {
      addToast({ variant: "error", message: "No repay amount is available for settlement retry." });
      return false;
    }

    try {
      setRepaySettlementState("settlement_pending");
      setRepaySettlementError(null);
      const settlement = await privara.settleRepayInterest({
        user: account.address,
        amount: lastRepayAmount,
        interestAmount: lastRepaySettlementAmounts?.interestAmount ?? lastRepayAmount,
        protocolFee: lastRepaySettlementAmounts?.protocolFee ?? 0n,
      });

      if (!settlement.ok || !settlement.hash) {
        const message = settlement.message ?? "Private settlement retry failed.";
        setRepaySettlementState("settlement_failed");
        setRepaySettlementError(message);
        addToast({ variant: "error", message });
        return false;
      }

      setSettlementTxHash(settlement.hash);
      setRepaySettlementState("settlement_confirmed");
      setRepaySettlementError(null);
      addToast({ variant: "success", message: "Private settlement confirmed." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Private settlement retry failed.";
      setRepaySettlementState("settlement_failed");
      setRepaySettlementError(message);
      addToast({ variant: "error", message });
      return false;
    }
  }, [account.address, addToast, lastRepayAmount, lastRepaySettlementAmounts, privara]);

  const isWriting = writer.isPending;
  const isEncrypting = encryptor.isEncrypting;

  const totalPoolCollateralDecrypting = totalDepositedLoading;
  const totalPoolDebtDecrypting = totalBorrowedLoading;

  return {
    account,
    status,
    setStatus,
    lastTxHash,
    repayTxHash,
    settlementTxHash,
    repaySettlementState,
    repaySettlementError,
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
    utilizationRate: typeof utilizationRateValue === "bigint" ? utilizationRateValue : 0n,
    utilizationRateLoading,
    currentBorrowRate: typeof borrowRateValue === "bigint" ? borrowRateValue : 0n,
    currentBorrowRateLoading: borrowRateLoading,
    liquidatable: false, // Liquidation system removed in the current release
    refreshLiquidatable: async () => {}, // No-op
    linkedWallets: [] as Address[], // ENS linking removed in the current release
    linkedWalletCount: 0, // ENS linking removed in the current release
    linkedWalletsLoading: false,
    creditTier: effectiveCreditTier,
    creditTierLoading,
    tierLTV,
    tierLTVLoading,
    requestCreditTierUpdate,
    creditTierPollingActive,
    // Advanced feature helpers for liquidation/P2P/ENS are removed
    liquidationPollingActive: false,
    liquidationPollingMessage: null,
    submitEncryptedAmount,
    retryRepaySettlement,
    hasDecryptPending,
    hasDecryptError,
    isWriting,
    isEncrypting,
  } as const;
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;

