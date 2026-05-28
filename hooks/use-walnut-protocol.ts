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
import { decodeEventLog, parseAbiItem } from "viem";
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
import { debugDecrypt, debugError, debugWarn } from "@/lib/debug";

const BALANCE_REFRESH_INTERVAL_MS = 30_000;
const SENDER_NOT_ALLOWED_SELECTOR = "0xd0d25976";
const MAX_HEALTH_FACTOR_BPS = 100_000n; // 10.00 on HEALTH_FACTOR_SCALE=10_000
type RepaySettlementAmounts = {
  interestAmount: bigint;
  protocolFee: bigint;
};

type LoanSettlementQuote = RepaySettlementAmounts & {
  repaymentAmount: bigint;
};

type WalnutTxReceipt = {
  logs: Array<{
    address: Address;
    data: `0x${string}`;
    topics: [`0x${string}`, ...`0x${string}`[]] | [];
  }>;
  status?: "success" | "reverted";
};

type DecryptSyncTarget = {
  eventName: "BorrowPrincipalSyncRequested" | "RepayStateSyncRequested" | "TotalBorrowedSyncRequested";
  syncFunction: "syncLoanPrincipal" | "syncLoanRepay" | "syncTotalBorrowed";
  requestIdIndex: number;
};

type SyncDecryptResponse = {
  ok: boolean;
  hash?: `0x${string}`;
  message?: string;
};

type DecryptSyncResult = {
  requestId: bigint;
  syncFunction: DecryptSyncTarget["syncFunction"];
  decryptedValue: bigint;
};

const REPAY_INTEREST_BUFFER_SECONDS = 300n;
const BORROW_PRINCIPAL_SYNC_EVENT = parseAbiItem(
  "event BorrowPrincipalSyncRequested(address indexed user, uint256 requestId, uint256 openedAt)"
);
const PENDING_LOAN_SYNC_LOOKBACK_BLOCKS = 250_000n;

export type WalnutAction = "deposit" | "borrow" | "repay" | "withdraw";

// Loan record matching the Solidity struct
export type LoanRecord = {
  loanId: bigint;
  principal: bigint;
  openedAt: bigint;
  active: boolean;
  principalPending: boolean;
};
export type RepaySettlementState =
  | "idle"
  | "repay_pending"
  | "repay_confirmed"
  | "settlement_pending"
  | "settlement_confirmed"
  | "settlement_processing"  // async: submitted, confirmation takes ~1 min
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

function normalizeRequestId(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue
    );
  } catch {
    return String(value);
  }
}

function formatFriendlyError(error: unknown, action?: WalnutAction): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Request cancelled in your wallet.";
  }

  if (lower.includes("insufficient funds")) {
    return "Your wallet does not have enough gas for this transaction.";
  }

  if (lower.includes("do not know how to serialize a bigint")) {
    return "Something went wrong while preparing the transaction details. Please try again.";
  }

  if (lower.includes("cofhe client is not ready")) {
    return "Private encryption is still loading. Please wait a moment and try again.";
  }

  if (lower.includes("finalize encrypted state") || lower.includes("sync transaction")) {
    return "Your transaction was confirmed, but the loan status could not be refreshed automatically. Please refresh in a moment.";
  }

  if (lower.includes("repayment amount was too low")) {
    return "The repayment amount was not enough to close this loan. Please refresh and try again.";
  }

  if (lower.includes("transaction reverted")) {
    return action === "repay"
      ? "Repayment could not be completed. Please refresh and check the loan status."
      : "Transaction could not be completed. Please check your amount and try again.";
  }

  if (lower.includes("cofhe decrypt timed out") || lower.includes("loan status will refresh")) {
    return "Your transaction was confirmed on-chain. Loan details are still syncing — please refresh in a moment.";
  }

  if (lower.includes("404") || lower.includes("not found") || (lower.includes("decrypt") && lower.includes("pending"))) {
    return action === "borrow"
      ? "Borrow confirmed! Loan details are still syncing from the network — refresh in ~30 seconds."
      : "Transaction confirmed, but the result is still syncing. Please refresh in a moment.";
  }

  return raw || "Something went wrong. Please try again.";
}

function normalizeLoanRecord(value: unknown): LoanRecord {
  const tuple = Array.isArray(value) ? value : [];
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    loanId: BigInt(String(record.loanId ?? tuple[0] ?? 0)),
    principal: BigInt(String(record.principal ?? tuple[1] ?? 0)),
    openedAt: BigInt(String(record.openedAt ?? tuple[2] ?? 0)),
    active: Boolean(record.active ?? tuple[3]),
    principalPending: Boolean(record.principalPending ?? tuple[4]),
  };
}

function getDecryptSyncTargets(action: WalnutAction): DecryptSyncTarget[] {
  if (action === "borrow") {
    return [
      { eventName: "BorrowPrincipalSyncRequested", syncFunction: "syncLoanPrincipal", requestIdIndex: 1 },
      { eventName: "TotalBorrowedSyncRequested", syncFunction: "syncTotalBorrowed", requestIdIndex: 0 },
    ];
  }

  if (action === "repay") {
    return [
      { eventName: "RepayStateSyncRequested", syncFunction: "syncLoanRepay", requestIdIndex: 1 },
      { eventName: "TotalBorrowedSyncRequested", syncFunction: "syncTotalBorrowed", requestIdIndex: 0 },
    ];
  }

  return [];
}

function extractDecryptRequestIds(receipt: WalnutTxReceipt, action: WalnutAction) {
  const targets = getDecryptSyncTargets(action);
  const byEvent = new Map(targets.map((target) => [target.eventName, target]));
  const requestIds: Array<{ requestId: bigint; syncFunction: DecryptSyncTarget["syncFunction"] }> = [];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== walnutContractAddress.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: walnutLendingAbi,
        data: log.data,
        topics: log.topics,
      });

      if (!decoded.eventName) continue;
      const target = byEvent.get(decoded.eventName as DecryptSyncTarget["eventName"]);
      if (!target) continue;

      const args = decoded.args as Record<string, unknown> | readonly unknown[];
      const requestId = normalizeRequestId(
        Array.isArray(args) ? args[target.requestIdIndex] : (args as Record<string, unknown>).requestId
      );

      if (requestId !== undefined) {
        requestIds.push({ requestId, syncFunction: target.syncFunction });
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return requestIds;
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
  const txInFlightRef = useRef(false);

  const isWalletReady = Boolean(account.isConnected && account.address);
  const isConnectionTransient = account.status === "reconnecting" || (account.isConnected && !account.address);
  const isOnTargetChain = account.chainId === walnutChainId;
  const canUseContract = Boolean(walnutContractAddress && walnutLendingAbi && publicClient);
  const isPermitReady = Boolean(
    permit.hasPermit &&
    // permit.isPermitValid && // Relaxed local check to avoid clock sync issues blocking contract reads
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
      debugError("getEncryptedCollateral error:", collateralStructError);
    }
    if (debtStructError) {
      debugError("getEncryptedDebt error:", debtStructError);
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
        debugDecrypt("decryptForView: No cofheClient available");
        return undefined;
      }

      debugDecrypt("decryptForView starting:", {
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

      debugDecrypt("decryptForView: Executing decryption with permit:", {
        explicitPermit: !!permit.permitHash
      });

      try {
        const decrypted = await withPermitBuilder.execute();
        debugDecrypt("decryptForView: Success!", {
          decrypted: typeof decrypted === "bigint" ? decrypted.toString() : decrypted
        });
        return typeof decrypted === "bigint" ? decrypted : undefined;
      } catch (error) {
        debugError("decryptForView: Failed!", {
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
    debugDecrypt("Collateral decrypt hook triggered", {
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
      debugDecrypt("Skipping decrypt - permit not ready");
      return;
    }
    
    const ctHash = normalizeEncryptedUint128Handle(collateralStruct);
    
    debugDecrypt("permit ready:", isPermitReady);
    debugDecrypt("permit object:", permit);
    debugDecrypt("encrypted handle:", ctHash?.toString());
    
    if (ctHash === undefined) {
      debugDecrypt("ctHash is undefined, setting collateral to undefined");
      debugDecrypt("This usually means: 1) No deposit yet or 2) the contract read failed.");
      setCollateralValue(undefined);
      return;
    }
    
    if (isZeroEncryptedUint128Handle(ctHash)) {
      debugDecrypt("ctHash is 0n, setting collateral to 0n");
      setCollateralValue(0n);
      return;
    }

    debugDecrypt("Starting decryption for ctHash:", ctHash.toString());
    let active = true;
    setCollateralDecrypting(true);
    setCollateralError(undefined);

    decryptForView(ctHash, account.address)
      .then((value) => {
        if (active) {
          debugDecrypt("isDecrypted: true");
          debugDecrypt("decryptedValue:", value?.toString());
          setCollateralValue(value);
          setCollateralDecrypting(false);
        }
      })
      .catch((error) => {
        if (active) {
          debugError("Collateral decrypt error:", error instanceof Error ? error.message : error);
          debugDecrypt("isDecrypted: false (error)");
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
          debugError("Debt decrypt error:", error instanceof Error ? error.message : error);
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
      debugError("Failed to refresh balances:", error);
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
      debugWarn("getAggregatedCollateral requires a transaction (not a view function) - skipping");
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
        
        // Add 50% buffer to gas fees to account for base fee fluctuations
        if (feeEstimate?.maxFeePerGas) {
          const bufferedMaxFee = (feeEstimate.maxFeePerGas * 150n) / 100n;
          const bufferedPriorityFee = feeEstimate.maxPriorityFeePerGas 
            ? (feeEstimate.maxPriorityFeePerGas * 150n) / 100n
            : undefined;
          
          finalConfig = {
            ...config,
            maxFeePerGas: bufferedMaxFee,
            ...(bufferedPriorityFee && { maxPriorityFeePerGas: bufferedPriorityFee }),
          } as typeof config;
          
          console.info("[Walnut Gas Debug] Applied 50% buffer to gas fees", {
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
        debugError(`write failed: ${message}`, {
          operation: meta.operation,
          action: meta.action ?? null,
          message,
          parsedMaxFee,
          parsedBaseFee,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorObject: error,
          fullError: safeStringify(error),
        });
        throw error;
      }
    },
    [account.chainId, permit.hasPermit, permit.isPermitValid, publicClient, writer]
  );

  const getLoanSettlementQuote = useCallback(
    async (principal: bigint, openedAt: bigint): Promise<LoanSettlementQuote> => {
      if (!publicClient || principal <= 0n || openedAt <= 0n) {
        return { repaymentAmount: principal, interestAmount: 0n, protocolFee: 0n };
      }

      const interestTuple = await publicClient.readContract({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "calculateInterestForLoan",
        args: [principal, openedAt],
      });

      const { interestAmount, protocolFee } = normalizeInterestTuple(interestTuple);
      const bufferInterest =
        (principal * 800n * REPAY_INTEREST_BUFFER_SECONDS) / (31_536_000n * 10_000n);
      const repaymentBuffer = bufferInterest > 0n ? bufferInterest + 1n : 1n;

      return {
        repaymentAmount: principal + interestAmount + repaymentBuffer,
        interestAmount,
        protocolFee,
      };
    },
    [publicClient]
  );

  const syncDecryptResultsFromReceipt = useCallback(
    async (action: WalnutAction, receipt: WalnutTxReceipt): Promise<DecryptSyncResult[]> => {
      const syncRequests = extractDecryptRequestIds(receipt, action);
      if (!syncRequests.length) return [];

      if (!cofheClient || !account.address) {
        throw new Error("CoFHE client is not ready to sync encrypted results.");
      }

      const seen = new Set<string>();
      const uniqueSyncRequests = syncRequests.filter(({ requestId, syncFunction }) => {
        const key = `${syncFunction}:${requestId.toString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const results: DecryptSyncResult[] = [];

      for (const { requestId, syncFunction } of uniqueSyncRequests) {
        setStatus("Finalizing encrypted state...");

        // The CoFHE oracle needs a few seconds to process the decrypt request after the
        // tx confirms. Retry with exponential backoff to avoid a premature 404/not-ready
        // error that would falsely show an error notification for a successful transaction.
        const MAX_RETRIES = 8;
        const BASE_DELAY_MS = 3000; // start at 3s, doubles each retry (max ~6 min total)
        let decryptResult: Awaited<ReturnType<typeof cofheClient.decryptForTx.prototype.execute>> | null = null;
        let lastDecryptError: unknown = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            decryptResult = await cofheClient
              .decryptForTx(requestId)
              .setChainId(walnutChainId)
              .setAccount(account.address)
              .withoutPermit()
              .execute();
            lastDecryptError = null;
            break; // success
          } catch (err) {
            lastDecryptError = err;
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            // Only retry on transient not-ready errors (404, pending, not found, timeout)
            const isTransient = msg.includes("404") || msg.includes("not found") ||
              msg.includes("pending") || msg.includes("not ready") || msg.includes("timeout") ||
              msg.includes("fetch") || msg.includes("network");
            if (!isTransient) break; // hard error — don't retry
            if (attempt < MAX_RETRIES - 1) {
              const delayMs = BASE_DELAY_MS * Math.pow(1.5, attempt); // 3s, 4.5s, 6.75s…
              debugWarn(`[syncDecrypt] decryptForTx attempt ${attempt + 1} not ready, retrying in ${Math.round(delayMs / 1000)}s…`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }
        }

        if (!decryptResult) {
          // All retries exhausted — throw so the caller can handle it gracefully
          throw lastDecryptError ?? new Error("CoFHE decrypt timed out. The loan status will refresh automatically.");
        }

        if (decryptResult.decryptedValue > ((1n << 128n) - 1n)) {
          throw new Error("CoFHE decrypted value exceeds uint128.");
        }

        const response = await fetch("/api/walnut/sync-decrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syncFunction,
            requestId: requestId.toString(),
            result: decryptResult.decryptedValue.toString(),
            signature: decryptResult.signature,
          }),
        });

        const syncResult = (await response.json()) as SyncDecryptResponse;
        if (!response.ok || !syncResult.ok) {
          throw new Error(syncResult.message ?? "Failed to finalize encrypted state.");
        }

        results.push({ requestId, syncFunction, decryptedValue: decryptResult.decryptedValue });
      }

      return results;
    },
    [account.address, cofheClient]
  );

  const submitEncryptedAmount = useCallback(
    async (
      action: WalnutAction,
      amount: string,
      loanIndex?: number,
      repayQuote?: RepaySettlementAmounts
    ) => {
      if (txInFlightRef.current) {
        addToast({ variant: "pending", message: "A transaction is already in progress." });
        return false;
      }

      if (!canWrite) {
        addToast({ variant: "error", message: "Connect your wallet to continue." });
        return false;
      }

      const value = parseUSDCAmount(amount);
      if (!value) {
        addToast({ variant: "error", message: "Amount must be a positive integer." });
        return false;
      }

      // Note: We intentionally do NOT validate the repay amount against debtValue here.
      // The debtValue is the total FHE-encrypted on-chain debt and may be 0 or stale if the user
      // hasn't decrypted it. The repay amount is correctly calculated from the actual loan principal
      // + contract interest quote (getLoanSettlementQuote), so it's always valid. On-chain validation
      // will reject any truly invalid amounts at the contract level.

      txInFlightRef.current = true;
      try {
        let repaySettlementAmounts: RepaySettlementAmounts | null = repayQuote ?? null;

        if (action === "repay") {
          setRepaySettlementState("repay_pending");
          setRepaySettlementError(null);
          setRepayTxHash(null);
          setSettlementTxHash(null);
          setLastRepayAmount(value);
          setLastRepaySettlementAmounts(repaySettlementAmounts);

          if (!repaySettlementAmounts && publicClient && account.address && typeof debtValue === "bigint") {
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
        const [encrypted] = await encryptor.encryptInputsAsync({
          items: [Encryptable.uint128(value)],
          account: account.address!,
          chainId: walnutChainId,
        });
        const functionName: "deposit" | "borrow" | "repay" | "withdraw" =
          action === "deposit"
            ? "deposit"
            : action === "borrow"
            ? "borrow"
            : action === "repay"
            ? "repay"
            : "withdraw";

        setStatus("Submitting transaction...");
        // For repay, the contract now requires (encryptedAmount, loanIndex)
        const contractArgs: unknown[] =
          action === "repay" ? [encrypted, BigInt(loanIndex ?? 0)] : [encrypted];
          
        let estimatedGas;
        try {
          if (publicClient) {
            const estimated = await publicClient.estimateContractGas({
              address: walnutContractAddress,
              abi: walnutLendingAbi,
              functionName,
              args: contractArgs,
              account: account.address!,
            });
            if (estimated) {
              estimatedGas = (estimated * 130n) / 100n; // 30% buffer
            }
          }
        } catch (e) {
          console.warn(`Gas estimation failed for ${functionName}, using fallback`, e);
          estimatedGas = 15000000n; // fallback for FHE operations on Arbitrum Sepolia
        }

        const hash = await writeWithGasDebug({
          address: walnutContractAddress,
          abi: walnutLendingAbi,
          functionName,
          args: contractArgs,
          chain: arbitrumSepolia,
          account: account.address!,
          gas: estimatedGas,
        }, { operation: functionName, action });

        setLastTxHash(hash);
        if (action === "repay") {
          setRepayTxHash(hash);
        }
        let syncDecryptFailed = false;
        let syncDecryptErrorMsg = "";

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          assertSuccessReceipt(receipt);
          try {
            const syncResults = await syncDecryptResultsFromReceipt(action, receipt as WalnutTxReceipt);
            const repayResult = syncResults.find((result) => result.syncFunction === "syncLoanRepay");
            if (action === "repay" && repayResult && repayResult.decryptedValue !== 1n) {
              throw new Error("Repayment amount was too low. Please refresh and try again.");
            }
          } catch (syncError) {
            // Check if this was a hard failure we want to propagate (like "Repayment amount was too low")
            const msg = syncError instanceof Error ? syncError.message : String(syncError);
            if (msg.includes("too low")) {
              throw syncError; // Propagate hard failures
            }
            console.warn(`Decryption sync failed/delayed for ${action} transaction ${hash}:`, syncError);
            syncDecryptFailed = true;
            syncDecryptErrorMsg = msg;
          }
        }

        if (action === "repay" && account.address) {
          setRepaySettlementState("repay_confirmed");

          if (!repaySettlementAmounts || repaySettlementAmounts.interestAmount <= 0n) {
            setRepaySettlementState("settlement_confirmed");
            setRepaySettlementError(null);
            if (syncDecryptFailed) {
              addToast({ 
                variant: "pending", 
                message: `Repayment received, but loan details are still syncing in the background — please refresh in a moment.` 
              });
            } else {
              addToast({ variant: "success", message: "Repayment complete. Your loan is now marked paid." });
            }
            setStatus(null);
            await refreshBalances();
            return true;
          }

          addToast({ variant: "pending", message: "Repayment received. Finalizing interest settlement..." });
          setRepaySettlementState("settlement_pending");

          let settlement;
          try {
            settlement = await privara.settleRepayInterest({
              user: account.address,
              amount: value,
              interestAmount: repaySettlementAmounts.interestAmount,
              protocolFee: repaySettlementAmounts.protocolFee,
            });
          } catch (settleError) {
            // Intercept transient gateway errors (e.g. 503 decrypt pending) and process in the background
            console.warn("Privara interest settlement API threw an exception, treating as background processing:", settleError);
            settlement = { ok: false, message: settleError instanceof Error ? settleError.message : String(settleError) };
          }

          if (!settlement.ok || !settlement.hash) {
            // The Privara settlement backend processes asynchronously — the on-chain
            // transaction often lands ~60s after the API returns a non-ok response.
            // Treat this as "processing" rather than a hard failure so we don't
            // show the user a false error when the repayment actually succeeded.
            setRepaySettlementState("settlement_processing");
            setRepaySettlementError(null);
            addToast({ variant: "pending", message: "Settlement is being processed. It usually confirms within 1–2 minutes — you can safely close this page." });
            setStatus(null);
            await refreshBalances();
            return true;  // repay itself succeeded; settlement is in-flight
          }

          setSettlementTxHash(settlement.hash);
          setRepaySettlementState("settlement_confirmed");
          setRepaySettlementError(null);
          addToast({ variant: "success", message: "Repayment complete. Your loan is now marked paid." });
          setStatus(null);
          await refreshBalances();
          return true;
        }

        if (syncDecryptFailed) {
          const friendlyMsg = formatFriendlyError(syncDecryptErrorMsg, action);
          addToast({ 
            variant: "pending", 
            message: friendlyMsg.includes("confirmed") || friendlyMsg.includes("syncing")
              ? friendlyMsg
              : `${action === "borrow" ? "Borrow" : action === "deposit" ? "Deposit" : "Transaction"} confirmed! Details are syncing from the network — please refresh in a moment.`
          });
        } else {
          const successMessage =
            action === "borrow"
              ? "Borrow complete. Your loan is being updated."
              : action === "deposit"
              ? "Deposit complete. Your balance is being updated."
              : action === "withdraw"
              ? "Withdrawal request submitted."
              : "Transaction complete.";
          addToast({ variant: "success", message: successMessage });
        }
        setStatus(null);
        await refreshBalances();
        return true;
      } catch (error) {
        const message = formatFriendlyError(error, action);
        if (action === "repay" && repaySettlementState !== "settlement_failed" && repaySettlementState !== "settlement_processing") {
          setRepaySettlementState("settlement_failed");
          setRepaySettlementError(message);
        }
        addToast({ variant: "error", message });
        setStatus(null);
        return false;
      } finally {
        txInFlightRef.current = false;
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
      syncDecryptResultsFromReceipt,
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

  // ── Multi-loan view hooks ────────────────────────────────────────────────
  const { data: loansData, refetch: refetchLoans } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getLoans",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!account.address },
  });

  const { data: activeLoansData, refetch: refetchActiveLoans } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getActiveLoans",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!account.address },
  });

  const { data: hasActiveLoanData, refetch: refetchHasActiveLoan } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "hasActiveLoan",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!account.address },
  });

  const { data: totalActivePrincipalData } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getTotalActivePrincipal",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!account.address },
  });

  const { data: totalEstimatedInterestData } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "getTotalEstimatedInterest",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!account.address },
  });

  // Normalise loan arrays into a typed array of LoanRecord
  const allLoans: LoanRecord[] = Array.isArray(loansData)
    ? (loansData as unknown[]).map(normalizeLoanRecord)
    : [];

  const activeLoansRaw = Array.isArray(activeLoansData)
    ? (activeLoansData as [unknown[], unknown[]])
    : [[], []] as [unknown[], unknown[]];

  const activeLoans: LoanRecord[] = Array.isArray(activeLoansRaw[0])
    ? (activeLoansRaw[0] as unknown[]).map(normalizeLoanRecord)
    : [];

  const activeLoansIndices: number[] = Array.isArray(activeLoansRaw[1])
    ? (activeLoansRaw[1] as unknown[]).map((i) => Number(i))
    : [];

  const hasActiveLoan = hasActiveLoanData === true;
  const totalActivePrincipal = typeof totalActivePrincipalData === "bigint" ? totalActivePrincipalData : 0n;
  const totalEstimatedInterest = typeof totalEstimatedInterestData === "bigint" ? totalEstimatedInterestData : 0n;

  const recoverPendingLoanPrincipal = useCallback(
    async (loanIndex: number, openedAt: bigint) => {
      if (!publicClient || !cofheClient || !account.address) {
        addToast({ variant: "error", message: "Private loan details are still loading. Please try again shortly." });
        return false;
      }

      if (openedAt <= 0n) {
        addToast({ variant: "error", message: "This loan is missing its open date. Please refresh and try again." });
        return false;
      }

      try {
        setStatus("Loading loan details...");
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock =
          latestBlock > PENDING_LOAN_SYNC_LOOKBACK_BLOCKS
            ? latestBlock - PENDING_LOAN_SYNC_LOOKBACK_BLOCKS
            : 0n;

        const logs = await publicClient.getLogs({
          address: walnutContractAddress,
          event: BORROW_PRINCIPAL_SYNC_EVENT,
          args: { user: account.address },
          fromBlock,
          toBlock: "latest",
        });

        const matchingLog = [...logs]
          .reverse()
          .find((log) => log.args.openedAt === openedAt);

        const requestId = matchingLog?.args.requestId;
        if (requestId === undefined) {
          throw new Error("Could not find the encrypted loan details request.");
        }

        const decryptResult = await cofheClient
          .decryptForTx(requestId)
          .setChainId(walnutChainId)
          .setAccount(account.address)
          .withoutPermit()
          .execute();

        if (decryptResult.decryptedValue > ((1n << 128n) - 1n)) {
          throw new Error("Loan principal is outside the supported range.");
        }

        const response = await fetch("/api/walnut/sync-decrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syncFunction: "syncLoanPrincipal",
            requestId: requestId.toString(),
            result: decryptResult.decryptedValue.toString(),
            signature: decryptResult.signature,
          }),
        });

        const syncResult = (await response.json()) as SyncDecryptResponse;
        if (!response.ok || !syncResult.ok) {
          throw new Error(syncResult.message ?? "Could not update this loan.");
        }

        await Promise.all([refetchLoans(), refetchActiveLoans(), refetchHasActiveLoan()]);
        addToast({ variant: "success", message: `Loan ${loanIndex + 1} details are ready.` });
        setStatus(null);
        return true;
      } catch (error) {
        const message = formatFriendlyError(error);
        addToast({ variant: "error", message });
        setStatus(null);
        return false;
      }
    },
    [
      account.address,
      addToast,
      cofheClient,
      publicClient,
      refetchActiveLoans,
      refetchHasActiveLoan,
      refetchLoans,
    ]
  );

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
    getLoanSettlementQuote,
    recoverPendingLoanPrincipal,
    hasDecryptPending,
    hasDecryptError,
    isWriting,
    isEncrypting,
    encryptor,
    // Multi-loan
    allLoans,
    activeLoans,
    activeLoansIndices,
    hasActiveLoan,
    totalActivePrincipal,
    totalEstimatedInterest,
    refetchLoans,
    refetchActiveLoans,
    refetchHasActiveLoan,
  } as const;
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;

