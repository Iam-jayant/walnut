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
import { walnutChainId, walnutContractAddress, walnutV1Abi } from "@/lib/walnut-contract";
import { usePrivara } from "@/hooks/use-privara";

const BALANCE_REFRESH_INTERVAL_MS = 30_000;
const DEFAULT_LIQUIDATION_POLL_INTERVAL_MS = 15_000;
const DEFAULT_LIQUIDATION_POLL_MAX = 20;
const SENDER_NOT_ALLOWED_SELECTOR = "0xd0d25976";
const MAX_HEALTH_FACTOR_BPS = 100_000n; // 10.00 on HEALTH_FACTOR_SCALE=10_000

export type WalnutAction = "deposit" | "borrow" | "repay" | "withdraw";
export type RepaySettlementState =
  | "idle"
  | "repay_pending"
  | "repay_confirmed"
  | "settlement_pending"
  | "settlement_confirmed"
  | "settlement_failed";

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

function tierFromRepaymentCount(count: bigint): bigint {
  if (count >= 10n) return 4n;
  if (count >= 7n) return 3n;
  if (count >= 4n) return 2n;
  if (count >= 2n) return 1n;
  return 0n;
}

async function decryptUint128Handle(
  encryptedStruct: unknown,
  accountAddress: Address,
  decryptForView: (ctHash: bigint | string, accountAddress: Address) => Promise<bigint | undefined>
): Promise<bigint | undefined> {
  const ctHash =
    typeof encryptedStruct === "bigint"
      ? encryptedStruct
      : (encryptedStruct as { ctHash?: bigint } | null)?.ctHash;
  if (typeof ctHash !== "bigint") return undefined;
  return decryptForView(ctHash, accountAddress);
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
  const privara = usePrivara();

  const [status, setStatus] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [repayTxHash, setRepayTxHash] = useState<string | null>(null);
  const [settlementTxHash, setSettlementTxHash] = useState<string | null>(null);
  const [repaySettlementState, setRepaySettlementState] = useState<RepaySettlementState>("idle");
  const [repaySettlementError, setRepaySettlementError] = useState<string | null>(null);
  const [lastRepayAmount, setLastRepayAmount] = useState<bigint | null>(null);
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
  const [fallbackCreditTier, setFallbackCreditTier] = useState<bigint | undefined>(undefined);
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

  // Read encrypted values as structs (contract returns EncryptedValue{ctHash, utype})
  const { data: collateralStruct, isLoading: collateralStructLoading, refetch: refetchCollateralStruct } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedCollateral",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  const { data: debtStruct, isLoading: debtStructLoading, refetch: refetchDebtStruct } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "getEncryptedDebt",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: canRead && Boolean(account.address),
    },
  });

  // Note: totalPoolCollateral and totalPoolDebt cannot be decrypted by regular users
  // because the contract doesn't call FHE.allow(totalPool*, user) - only FHE.allowThis()
  // These values are only accessible to the contract itself, not to external viewers

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
    [account.address, account.chainId, cofheClient, permit.hasPermit, permit.isPermitValid, permit.permitHash]
  );

  // Decrypt collateral when struct is available
  useEffect(() => {
    if (!collateralStruct || !account.address || !permit.hasPermit) return;
    
    const struct = collateralStruct as { ctHash: bigint; utype: number };
    if (!struct.ctHash || struct.ctHash === 0n) {
      setCollateralValue(0n);
      return;
    }

    let active = true;
    setCollateralDecrypting(true);
    setCollateralError(undefined);

    decryptForView(struct.ctHash, account.address)
      .then((value) => {
        if (active) {
          setCollateralValue(value);
          setCollateralDecrypting(false);
        }
      })
      .catch((error) => {
        if (active) {
          console.error("[Walnut Debug] Collateral decrypt error:", error instanceof Error ? error.message : error);
          setCollateralError(error instanceof Error ? error : new Error("Decryption failed"));
          setCollateralDecrypting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [collateralStruct, account.address, permit.hasPermit, decryptForView]);

  // Decrypt debt when struct is available
  useEffect(() => {
    if (!debtStruct || !account.address || !permit.hasPermit) return;
    
    const struct = debtStruct as { ctHash: bigint; utype: number };
    if (!struct.ctHash || struct.ctHash === 0n) {
      setDebtValue(0n);
      return;
    }

    let active = true;
    setDebtDecrypting(true);
    setDebtError(undefined);

    decryptForView(struct.ctHash, account.address)
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
  }, [debtStruct, account.address, permit.hasPermit, decryptForView]);

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

  // Total pool values are not decryptable by regular users (contract doesn't grant FHE.allow access)
  // Return stub objects that indicate these values are private
  const totalPoolCollateral: CofheDecryptResult<bigint> = {
    encrypted: undefined,
    decrypted: {
      data: undefined,
      error: new Error("Total pool collateral is private (no FHE.allow access granted)"),
      isFetching: false,
      isLoading: false,
      refetch: async () => {},
    },
  };

  const totalPoolDebt: CofheDecryptResult<bigint> = {
    encrypted: undefined,
    decrypted: {
      data: undefined,
      error: new Error("Total pool debt is private (no FHE.allow access granted)"),
      isFetching: false,
      isLoading: false,
      refetch: async () => {},
    },
  };

  const { data: liquidatableData, refetch: refreshLiquidatable } = useReadContract({
    address: walnutContractAddress,
    abi: walnutV1Abi,
    functionName: "liquidatable",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account.address) && isOnTargetChain },
  });

  const liquidatable = Boolean(liquidatableData);

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
        abi: walnutV1Abi,
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
        refreshLocalCreditTier(),
      ]);
    } catch (error) {
      console.error("Failed to refresh balances:", error);
      // Silently fail - balances will retry on next interval
    }
  }, [canRead, collateral.decrypted, debt.decrypted, refreshLocalCreditTier, totalPoolCollateral.decrypted, totalPoolDebt.decrypted]);

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
                  abi: walnutV1Abi,
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
                  abi: walnutV1Abi,
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

      const value = parsePositiveBigint(amount);
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
        if (action === "repay") {
          setRepaySettlementState("repay_pending");
          setRepaySettlementError(null);
          setRepayTxHash(null);
          setSettlementTxHash(null);
          setLastRepayAmount(value);
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
          abi: walnutV1Abi,
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
          await publicClient.waitForTransactionReceipt({ hash });
        }

        if (action === "repay" && account.address) {
          setRepaySettlementState("repay_confirmed");
          addToast({ variant: "pending", message: "Repay confirmed. Settling private interest..." });
          setRepaySettlementState("settlement_pending");

          const settlement = await privara.settleRepayInterest({
            user: account.address,
            amount: value,
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
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "requestLiquidationCheck",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "requestLiquidationCheck" });

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

            let isLiquidatable = false;
            try {
              const next = await publicClient?.readContract({
                address: walnutContractAddress,
                abi: walnutV1Abi,
                functionName: "liquidatable",
                args: [borrowerAddress],
              });
              isLiquidatable = Boolean(next);
            } catch {
              isLiquidatable = false;
            }

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
    [addToast, canWrite, publicClient, removeToast, writeWithGasDebug]
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
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "openAuction",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "openAuction" });
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
    [addToast, canWrite, publicClient, writeWithGasDebug]
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
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "submitBid",
          args: [borrowerAddress, encryptedBid],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "submitBid" });
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
    [addToast, canWrite, encryptor, publicClient, writeWithGasDebug]
  );

  const selectWinningBid = useCallback(
    async (borrowerAddress: Address) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "selectWinningBid",
          args: [borrowerAddress],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "selectWinningBid" });
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
    [addToast, canWrite, publicClient, writeWithGasDebug]
  );

  const registerENSWallet = useCallback(
    async (ensName: string, walletAddress: Address) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "registerENSWallet",
          args: [ensName, walletAddress],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "registerENSWallet" });
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
    [addToast, canWrite, publicClient, writeWithGasDebug]
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
        abi: walnutV1Abi,
        functionName: "requestCreditTierUpdate",
        args: [account.address],
        chain: arbitrumSepolia,
        account: account.address!,
      }, { operation: "requestCreditTierUpdate" });
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
      const isSenderNotAllowed =
        message.includes(SENDER_NOT_ALLOWED_SELECTOR) || message.includes("SenderNotAllowed");

      if (isSenderNotAllowed && publicClient && account.address && permit.hasPermit) {
        try {
          // Fallback path: compute tier locally from user's encrypted repayment count.
          const repaymentStruct = await publicClient.readContract({
            address: walnutContractAddress,
            abi: walnutV1Abi,
            functionName: "getEncryptedRepaymentCount",
            args: [account.address],
          });

          const ctHash =
            typeof repaymentStruct === "bigint"
              ? repaymentStruct
              : (repaymentStruct as { ctHash?: bigint }).ctHash;

          if (typeof ctHash === "bigint") {
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
        const [encryptedApr, encryptedAmount, encryptedTenor] = await encryptor.encryptInputsAsync([
          Encryptable.uint128(aprValue),
          Encryptable.uint128(amountValue),
          Encryptable.uint128(tenorValue),
        ]);

        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "postOffer",
          args: [encryptedApr, encryptedAmount, encryptedTenor],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "postOffer" });
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
    [addToast, canWrite, encryptor, publicClient, writeWithGasDebug]
  );

  const matchOffer = useCallback(
    async (offerId: bigint) => {
      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      try {
        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutV1Abi,
          functionName: "matchOffer",
          args: [offerId],
          chain: arbitrumSepolia,
          account: account.address!,
        }, { operation: "matchOffer" });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        if (account.address) {
          const terms = await getOfferTerms(offerId);
          if (!terms?.amount || terms.amount <= 0n) {
            addToast({
              variant: "error",
              message: "Offer matched, but encrypted terms are unavailable for settlement.",
            });
            return false;
          }

          const settlement = await privara.settleP2PMatch({
            user: account.address,
            amount: terms.amount,
          });

          if (!settlement.ok || !settlement.hash) {
            addToast({
              variant: "error",
              message: settlement.message ?? "Offer matched, but private settlement failed.",
            });
            return false;
          }

          addToast({ variant: "success", message: "Offer matched and privately settled." });
          return true;
        }

        addToast({ variant: "success", message: "Offer matched." });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to match offer.";
        addToast({ variant: "error", message });
        return false;
      }
    },
    [account.address, addToast, canWrite, getOfferTerms, privara, publicClient, writeWithGasDebug]
  );

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
  }, [account.address, addToast, lastRepayAmount, privara]);

  const isWriting = writer.isPending;
  const isEncrypting = encryptor.isEncrypting;

  // Derived variables for backward compatibility
  const totalPoolCollateralDecrypting = false; // Not decryptable by users
  const totalPoolDebtDecrypting = false; // Not decryptable by users

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
    liquidatable,
    refreshLiquidatable,
    linkedWallets,
    linkedWalletCount,
    linkedWalletsLoading,
    creditTier: effectiveCreditTier,
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
    retryRepaySettlement,
    hasDecryptPending,
    hasDecryptError,
    isWriting,
    isEncrypting,
  } as const;
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;

