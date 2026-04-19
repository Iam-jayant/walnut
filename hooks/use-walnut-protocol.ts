"use client";

import { Encryptable, FheTypes } from "@cofhe/sdk";
import {
  useCofheClient,
  useCofheEncrypt,
  useCofheReadContractAndDecrypt,
  useCofheWriteContract,
} from "@cofhe/react";
import { useCallback, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";

import {
  walnutContractAddress,
  walnutChainId,
  walnutWave2bContractAddress,
  walnutWave2Abi,
  walnutWave2CoreContractAddress,
} from "@/lib/walnut-contract";
import {
  HEALTH_FACTOR_AT_RISK_THRESHOLD,
  HEALTH_FACTOR_SAFE_THRESHOLD,
} from "@/lib/protocol-constants";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { decodeEventLog, isAddress, type Address, type TransactionReceipt } from "viem";

export type WalnutAction = "deposit" | "borrow";

export type AuctionSummary = {
  borrower: Address;
  endTime: bigint;
  bidCount: bigint;
  settled: boolean;
  active: boolean;
};

export type WalnutProtocolMode = "core" | "advanced";

type WalnutProtocolOptions = {
  mode?: WalnutProtocolMode;
};

type HandleEventName = "HealthFactorHandle" | "AggregatedCollateralHandle";

const READ_REFETCH_INTERVAL_MS = 30_000;

function isRateLimitError(error: unknown) {
  const message = String(error ?? "").toLowerCase();
  return message.includes("429") || message.includes("rate limit");
}

function shouldRetryRead(failureCount: number, error: unknown) {
  if (isRateLimitError(error)) return false;
  return failureCount < 1;
}

function normalizeHexLike(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }

  if (typeof value === "object") {
    const maybeCipher = value as { ctHash?: unknown };
    if (maybeCipher.ctHash !== undefined) {
      return normalizeHexLike(maybeCipher.ctHash);
    }
  }

  return undefined;
}

export function trimHex(hexValue: unknown) {
  const normalized = normalizeHexLike(hexValue);
  if (!normalized) return "Not available";
  if (normalized.length < 16) return normalized;
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

function extractCtHash(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      return BigInt(value);
    }
    return undefined;
  }

  if (typeof value === "object" && "ctHash" in value) {
    const cipherLike = value as { ctHash?: unknown };
    return extractCtHash(cipherLike.ctHash);
  }

  return undefined;
}

type BalanceSnapshot = {
  collateral?: bigint;
  debt?: bigint;
};

function asBigInt(value: unknown): bigint | undefined {
  return typeof value === "bigint" ? value : undefined;
}

function hasCompleteBalanceSnapshot(
  snapshot: BalanceSnapshot | undefined
): snapshot is { collateral: bigint; debt: bigint } {
  return snapshot?.collateral !== undefined && snapshot?.debt !== undefined;
}

function snapshotsEqual(
  before: { collateral: bigint; debt: bigint },
  after: { collateral: bigint; debt: bigint }
) {
  return before.collateral === after.collateral && before.debt === after.debt;
}

export function useWalnutProtocol(options: WalnutProtocolOptions = {}) {
  const { address, isConnected, chainId, status: accountStatus } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const cofheClient = useCofheClient();
  const permit = useWalnutPermit();

  const mode = options.mode ?? "advanced";
  const coreContractAddress =
    walnutWave2CoreContractAddress ?? walnutContractAddress ?? walnutWave2bContractAddress;
  const activeContractAddress =
    mode === "advanced" ? walnutWave2bContractAddress : coreContractAddress;
  const supportsWave2CoreFeatures = mode === "advanced" || Boolean(walnutWave2CoreContractAddress);
  const supportsAdvancedFeatures = mode === "advanced";

  const { encryptInputsAsync, isEncrypting } = useCofheEncrypt();
  const { writeContractAsync, isPending: isWriting } = useCofheWriteContract();

  const [status, setStatus] = useState("");
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);
  const [healthFactorValue, setHealthFactorValue] = useState<bigint | undefined>(undefined);
  const [healthFactorLoading, setHealthFactorLoading] = useState(false);
  const [healthFactorError, setHealthFactorError] = useState<string | null>(null);
  const [aggregatedCollateralValue, setAggregatedCollateralValue] = useState<bigint | undefined>(undefined);
  const [aggregatedCollateralLoading, setAggregatedCollateralLoading] = useState(false);
  const [aggregatedCollateralError, setAggregatedCollateralError] = useState<string | null>(null);

  const canUseContract = Boolean(activeContractAddress);
  const isWalletReady = Boolean(isConnected && address);
  const isConnectionTransient =
    accountStatus === "connecting" ||
    accountStatus === "reconnecting" ||
    (isConnected && (address === undefined || chainId === undefined));
  const isOnTargetChain = chainId === walnutChainId;
  const canRead = Boolean(isWalletReady && canUseContract && isOnTargetChain && !isConnectionTransient);

  const collateral = useCofheReadContractAndDecrypt<
    typeof walnutWave2Abi,
    "getEncryptedCollateral",
    FheTypes.Uint128
  >(
    {
      address: activeContractAddress,
      abi: walnutWave2Abi,
      functionName: "getEncryptedCollateral",
      args: address ? [address] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: canRead,
        refetchInterval: READ_REFETCH_INTERVAL_MS,
        retry: shouldRetryRead,
      },
      decryptingQueryOptions: {
        enabled: canRead && permit.hasPermit,
      },
    }
  );

  const debt = useCofheReadContractAndDecrypt<
    typeof walnutWave2Abi,
    "getEncryptedDebt",
    FheTypes.Uint128
  >(
    {
      address: activeContractAddress,
      abi: walnutWave2Abi,
      functionName: "getEncryptedDebt",
      args: address ? [address] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: canRead,
        refetchInterval: READ_REFETCH_INTERVAL_MS,
        retry: shouldRetryRead,
      },
      decryptingQueryOptions: {
        enabled: canRead && permit.hasPermit,
      },
    }
  );

  const {
    data: linkedWalletsData,
    isLoading: linkedWalletsLoading,
    refetch: refetchLinkedWallets,
  } = useReadContract({
    address: activeContractAddress,
    abi: walnutWave2Abi,
    functionName: "getLinkedWallets",
    args: address ? [address] : undefined,
    query: {
      enabled: canRead && supportsAdvancedFeatures,
      refetchInterval: READ_REFETCH_INTERVAL_MS,
      retry: shouldRetryRead,
    },
  });

  const {
    data: linkedWalletCountData,
    isLoading: linkedWalletCountLoading,
    refetch: refetchLinkedWalletCount,
  } = useReadContract({
    address: activeContractAddress,
    abi: walnutWave2Abi,
    functionName: "getLinkedWalletCount",
    args: address ? [address] : undefined,
    query: {
      enabled: canRead && supportsAdvancedFeatures,
      refetchInterval: READ_REFETCH_INTERVAL_MS,
      retry: shouldRetryRead,
    },
  });

  const {
    data: liquidatable,
    isLoading: liquidatableLoading,
    refetch: refetchLiquidatable,
  } = useReadContract({
    address: activeContractAddress,
    abi: walnutWave2Abi,
    functionName: "liquidatable",
    args: address ? [address] : undefined,
    query: {
      enabled: canRead && supportsWave2CoreFeatures,
      refetchInterval: READ_REFETCH_INTERVAL_MS,
      retry: shouldRetryRead,
    },
  });

  const missingPermit = !permit.hasPermit || !permit.isPermitValid;
  const decryptBlocked =
    collateral.disabledDueToMissingPermit || debt.disabledDueToMissingPermit || missingPermit;

  const cofhejs = useMemo(
    () => ({
      unseal: async (
        ctHash: bigint,
        utype: FheTypes,
        permitIssuer: Address,
        permitHash: string
      ) => {
        return await cofheClient
          .decryptForView(ctHash, utype)
          .setChainId(walnutChainId)
          .setAccount(permitIssuer)
          .withPermit(permitHash)
          .execute();
      },
    }),
    [cofheClient]
  );

  const decodeHandleCtHash = useCallback(
    (receipt: TransactionReceipt, eventName: HandleEventName) => {
      for (const log of receipt.logs) {
        if (
          activeContractAddress &&
          log.address.toLowerCase() !== activeContractAddress.toLowerCase()
        ) {
          continue;
        }

        try {
          const decoded = decodeEventLog({
            abi: walnutWave2Abi,
            data: log.data,
            topics: log.topics,
            strict: false,
          });

          if (decoded.eventName !== eventName) continue;

          const args = decoded.args as { ctHash?: bigint | string | number };
          const handle = args.ctHash;

          if (typeof handle === "bigint") return handle;
          if (typeof handle === "string") return BigInt(handle);
          if (typeof handle === "number") return BigInt(handle);
        } catch {
          // Ignore non-matching logs.
        }
      }

      return undefined;
    },
    [activeContractAddress]
  );

  const collateralCtHash = extractCtHash(collateral.encrypted.data);
  const debtCtHash = extractCtHash(debt.encrypted.data);
  const collateralHasCiphertext = Boolean(collateralCtHash && collateralCtHash > 0n);
  const debtHasCiphertext = Boolean(debtCtHash && debtCtHash > 0n);
  const collateralDecrypting = Boolean(collateralHasCiphertext && collateral.decrypted.isFetching);
  const debtDecrypting = Boolean(debtHasCiphertext && debt.decrypted.isFetching);
  const aggregatedCollateralDecrypting = aggregatedCollateralLoading;

  const hasDecryptPending = Boolean(
    canRead &&
      permit.hasPermit &&
      (collateralDecrypting || debtDecrypting || healthFactorLoading || (supportsAdvancedFeatures && aggregatedCollateralDecrypting))
  );
  const hasDecryptError = Boolean(
    (collateralHasCiphertext && collateral.decrypted.error) ||
    (debtHasCiphertext && debt.decrypted.error) ||
    Boolean(healthFactorError) ||
    Boolean(aggregatedCollateralError)
  );
  const hasEncryptedReadError = Boolean(
    collateral.encrypted.error ||
      debt.encrypted.error
  );
  const contractReachable = Boolean(canRead && !hasEncryptedReadError);

  const healthFactorDecrypting = healthFactorLoading;

  const healthFactorStatus: "safe" | "at-risk" | "liquidatable" | "unknown" = (() => {
    const decryptedValue = healthFactorValue;
    if (decryptedValue === undefined) return "unknown";
    if (decryptedValue >= HEALTH_FACTOR_SAFE_THRESHOLD) return "safe";
    if (decryptedValue >= HEALTH_FACTOR_AT_RISK_THRESHOLD) return "at-risk";
    return "liquidatable";
  })();

  const ensureRightChain = useCallback(async () => {
    if (chainId === walnutChainId) return;
    await switchChainAsync({ chainId: walnutChainId });
  }, [chainId, switchChainAsync]);

  const refreshBalances = useCallback(async (): Promise<BalanceSnapshot> => {
    const [decryptedResults] = await Promise.all([
      Promise.all([collateral.decrypted.refetch(), debt.decrypted.refetch()]),
      Promise.all([collateral.encrypted.refetch(), debt.encrypted.refetch()]),
    ]);

    const [collateralDecryptedResult, debtDecryptedResult] = decryptedResults;

    const refreshJobs: Array<Promise<unknown>> = [];

    if (supportsWave2CoreFeatures) {
      refreshJobs.push(refetchLiquidatable());
    }

    if (supportsAdvancedFeatures) {
      refreshJobs.push(
        refetchLinkedWallets(),
        refetchLinkedWalletCount()
      );
    }

    if (refreshJobs.length > 0) {
      await Promise.all(refreshJobs);
    }

    return {
      collateral: asBigInt(collateralDecryptedResult.data),
      debt: asBigInt(debtDecryptedResult.data),
    };
  }, [
    collateral.decrypted,
    collateral.encrypted,
    debt.decrypted,
    debt.encrypted,
    refetchLinkedWalletCount,
    refetchLinkedWallets,
    refetchLiquidatable,
    supportsAdvancedFeatures,
    supportsWave2CoreFeatures,
  ]);

  const fetchHealthFactor = useCallback(
    async (userAddress?: Address): Promise<bigint | undefined> => {
      try {
        setHealthFactorError(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return undefined;
        }

        if (!activeContractAddress || !supportsWave2CoreFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return undefined;
        }

        if (!permit.permitHash || !permit.permitIssuer) {
          setStatus("Enable private access before fetching health factor.");
          return undefined;
        }

        const targetUser = userAddress ?? address;
        if (!isAddress(targetUser)) {
          setStatus("Target user address is invalid.");
          return undefined;
        }

        setHealthFactorLoading(true);
        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "getHealthFactor",
          args: [targetUser as Address],
        });

        setLastTxHash(hash);
        setStatus("Fetching health factor...");

        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;

        if (!receipt) {
          setStatus("Health factor request submitted.");
          return undefined;
        }

        const ctHash = decodeHandleCtHash(receipt, "HealthFactorHandle");
        if (ctHash === undefined) {
          setHealthFactorError("HealthFactorHandle event not found in receipt logs.");
          setStatus("Could not decode health factor handle.");
          return undefined;
        }

        const result = await cofhejs.unseal(
          ctHash,
          FheTypes.Uint128,
          permit.permitIssuer,
          permit.permitHash
        );

        const plaintext = typeof result === "bigint" ? result : BigInt(result as string | number);
        setHealthFactorValue(plaintext);
        setStatus("Health factor updated.");
        return plaintext;
      } catch {
        setHealthFactorError("Failed to fetch health factor.");
        setStatus("Something went wrong. Please try again.");
        return undefined;
      } finally {
        setHealthFactorLoading(false);
      }
    },
    [
      activeContractAddress,
      address,
      cofhejs,
      decodeHandleCtHash,
      ensureRightChain,
      isConnected,
      permit.permitHash,
      permit.permitIssuer,
      publicClient,
      supportsWave2CoreFeatures,
      writeContractAsync,
    ]
  );

  const fetchAggregatedCollateral = useCallback(
    async (primaryWallet?: Address): Promise<bigint | undefined> => {
      try {
        setAggregatedCollateralError(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return undefined;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return undefined;
        }

        if (!permit.permitHash || !permit.permitIssuer) {
          setStatus("Enable private access before fetching aggregated collateral.");
          return undefined;
        }

        const targetWallet = primaryWallet ?? address;
        if (!isAddress(targetWallet)) {
          setStatus("Primary wallet address is invalid.");
          return undefined;
        }

        setAggregatedCollateralLoading(true);
        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "getAggregatedCollateral",
          args: [targetWallet as Address],
        });

        setLastTxHash(hash);
        setStatus("Fetching aggregated collateral...");

        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;

        if (!receipt) {
          setStatus("Aggregated collateral request submitted.");
          return undefined;
        }

        const ctHash = decodeHandleCtHash(receipt, "AggregatedCollateralHandle");
        if (ctHash === undefined) {
          setAggregatedCollateralError("AggregatedCollateralHandle event not found in receipt logs.");
          setStatus("Could not decode aggregated collateral handle.");
          return undefined;
        }

        const result = await cofhejs.unseal(
          ctHash,
          FheTypes.Uint128,
          permit.permitIssuer,
          permit.permitHash
        );

        const plaintext = typeof result === "bigint" ? result : BigInt(result as string | number);
        setAggregatedCollateralValue(plaintext);
        setStatus("Aggregated collateral updated.");
        return plaintext;
      } catch {
        setAggregatedCollateralError("Failed to fetch aggregated collateral.");
        setStatus("Something went wrong. Please try again.");
        return undefined;
      } finally {
        setAggregatedCollateralLoading(false);
      }
    },
    [
      activeContractAddress,
      address,
      cofhejs,
      decodeHandleCtHash,
      ensureRightChain,
      isConnected,
      permit.permitHash,
      permit.permitIssuer,
      publicClient,
      supportsAdvancedFeatures,
      writeContractAsync,
    ]
  );

  const submitEncryptedAmount = useCallback(
    async (action: WalnutAction, rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        const actionLabel = action === "deposit" ? "Deposit" : "Borrow";
        const preTxSnapshot: BalanceSnapshot | undefined =
          action === "borrow"
            ? {
                collateral: asBigInt(collateral.decrypted.data),
                debt: asBigInt(debt.decrypted.data),
              }
            : undefined;

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!canUseContract || !activeContractAddress) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!rawAmount || !/^\d+$/.test(rawAmount)) {
          setStatus("Amount must be a positive whole number.");
          return false;
        }

        if (BigInt(rawAmount) <= 0n) {
          setStatus("Amount must be greater than zero.");
          return false;
        }

        await ensureRightChain();

        const encrypted = await encryptInputsAsync([
          Encryptable.uint128(BigInt(rawAmount)),
        ]);

        const encryptedAmount = encrypted[0];
        const encodedForContract = {
          ctHash: encryptedAmount.ctHash,
          securityZone: encryptedAmount.securityZone,
          utype: encryptedAmount.utype,
          signature: encryptedAmount.signature as `0x${string}`,
        };

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: action,
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus(`${actionLabel} is being processed...`);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        let postTxSnapshot: BalanceSnapshot | undefined;
        try {
          postTxSnapshot = await refreshBalances();
        } catch (error) {
          console.error(`Failed to refresh balances after ${action} confirmation`, error);
          setStatus(`${actionLabel} confirmed, but balances may be stale. Please refresh.`);
          return true;
        }

        if (
          action === "borrow" &&
          hasCompleteBalanceSnapshot(preTxSnapshot) &&
          hasCompleteBalanceSnapshot(postTxSnapshot) &&
          snapshotsEqual(preTxSnapshot, postTxSnapshot)
        ) {
          setStatus(
            "Borrow transaction confirmed, but your position did not change. This usually means the request exceeded protocol limits (for example the LTV cap)."
          );
          return false;
        }

        setStatus(`${actionLabel} confirmed.`);
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      activeContractAddress,
      canUseContract,
      collateral.decrypted.data,
      debt.decrypted.data,
      encryptInputsAsync,
      ensureRightChain,
      isConnected,
      publicClient,
      refreshBalances,
      writeContractAsync,
    ]
  );

  const submitRepay = useCallback(
    async (rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsWave2CoreFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!rawAmount || !/^\d+$/.test(rawAmount)) {
          setStatus("Amount must be a positive whole number.");
          return false;
        }

        if (BigInt(rawAmount) <= 0n) {
          setStatus("Amount must be greater than zero.");
          return false;
        }

        await ensureRightChain();

        const encrypted = await encryptInputsAsync([
          Encryptable.uint128(BigInt(rawAmount)),
        ]);

        const encryptedAmount = encrypted[0];
        const encodedForContract = {
          ctHash: encryptedAmount.ctHash,
          securityZone: encryptedAmount.securityZone,
          utype: encryptedAmount.utype,
          signature: encryptedAmount.signature as `0x${string}`,
        };

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "repay",
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus("Repayment is being processed...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        try {
          await refreshBalances();
        } catch (error) {
          console.error("Failed to refresh balances after repay confirmation", error);
          setStatus("Repayment confirmed, but balances may be stale. Please refresh.");
          return true;
        }

        setStatus("Repayment confirmed.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      activeContractAddress,
      encryptInputsAsync,
      ensureRightChain,
      isConnected,
      publicClient,
      refreshBalances,
      supportsWave2CoreFeatures,
      writeContractAsync,
    ]
  );

  const submitWithdraw = useCallback(
    async (rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        const preTxSnapshot: BalanceSnapshot = {
          collateral: asBigInt(collateral.decrypted.data),
          debt: asBigInt(debt.decrypted.data),
        };

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsWave2CoreFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!rawAmount || !/^\d+$/.test(rawAmount)) {
          setStatus("Amount must be a positive whole number.");
          return false;
        }

        if (BigInt(rawAmount) <= 0n) {
          setStatus("Amount must be greater than zero.");
          return false;
        }

        await ensureRightChain();

        const encrypted = await encryptInputsAsync([
          Encryptable.uint128(BigInt(rawAmount)),
        ]);

        const encryptedAmount = encrypted[0];
        const encodedForContract = {
          ctHash: encryptedAmount.ctHash,
          securityZone: encryptedAmount.securityZone,
          utype: encryptedAmount.utype,
          signature: encryptedAmount.signature as `0x${string}`,
        };

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "withdraw",
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus("Withdrawal is being processed...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        let postTxSnapshot: BalanceSnapshot | undefined;
        try {
          postTxSnapshot = await refreshBalances();
        } catch (error) {
          console.error("Failed to refresh balances after withdraw confirmation", error);
          setStatus("Withdrawal confirmed, but balances may be stale. Please refresh.");
          return true;
        }

        if (
          hasCompleteBalanceSnapshot(preTxSnapshot) &&
          hasCompleteBalanceSnapshot(postTxSnapshot) &&
          snapshotsEqual(preTxSnapshot, postTxSnapshot)
        ) {
          setStatus(
            "Withdrawal transaction confirmed, but your position did not change. This usually means the requested amount exceeded available collateral."
          );
          return false;
        }

        setStatus("Withdrawal confirmed.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      activeContractAddress,
      collateral.decrypted.data,
      debt.decrypted.data,
      encryptInputsAsync,
      ensureRightChain,
      isConnected,
      publicClient,
      refreshBalances,
      supportsWave2CoreFeatures,
      writeContractAsync,
    ]
  );

  const requestLiquidationCheck = useCallback(async () => {
    try {
      if (!isConnected || !address) {
        setStatus("Please connect your wallet.");
        return;
      }

      if (!activeContractAddress || !supportsWave2CoreFeatures) {
        setStatus("Walnut is not available right now. Please try again later.");
        return;
      }

      await ensureRightChain();

      setStatus("Checking your position risk...");

      const hash = await writeContractAsync({
        chain: undefined,
        account: address,
        address: activeContractAddress,
        abi: walnutWave2Abi,
        functionName: "requestLiquidationCheck",
        args: [address],
      });

      setLastTxHash(hash);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setStatus("Risk check requested. Please refresh in a moment.");
    } catch {
      setStatus("Something went wrong. Please try again.");
    }
  }, [address, ensureRightChain, isConnected, publicClient, writeContractAsync]);

  const openAuction = useCallback(
    async (borrower: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!isAddress(borrower)) {
          setStatus("Borrower address is invalid.");
          return false;
        }

        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "openAuction",
          args: [borrower as Address],
        });

        setLastTxHash(hash);
        setStatus("Opening auction...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Auction opened.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [address, ensureRightChain, isConnected, publicClient, writeContractAsync]
  );

  const submitLiquidationBid = useCallback(
    async (borrower: string, rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!isAddress(borrower)) {
          setStatus("Borrower address is invalid.");
          return false;
        }

        if (!rawAmount || !/^\d+$/.test(rawAmount)) {
          setStatus("Bid must be a positive whole number.");
          return false;
        }

        if (BigInt(rawAmount) <= 0n) {
          setStatus("Bid must be greater than zero.");
          return false;
        }

        await ensureRightChain();

        const encrypted = await encryptInputsAsync([Encryptable.uint128(BigInt(rawAmount))]);
        const encryptedAmount = encrypted[0];
        const encodedForContract = {
          ctHash: encryptedAmount.ctHash,
          securityZone: encryptedAmount.securityZone,
          utype: encryptedAmount.utype,
          signature: encryptedAmount.signature as `0x${string}`,
        };

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "submitBid",
          args: [borrower as Address, encodedForContract],
        });

        setLastTxHash(hash);
        setStatus("Submitting encrypted bid...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Bid submitted.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [address, encryptInputsAsync, ensureRightChain, isConnected, publicClient, writeContractAsync]
  );

  const selectWinningBid = useCallback(
    async (borrower: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!isAddress(borrower)) {
          setStatus("Borrower address is invalid.");
          return false;
        }

        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "selectWinningBid",
          args: [borrower as Address],
        });

        setLastTxHash(hash);
        setStatus("Selecting winning bid...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Winner selection requested.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [address, ensureRightChain, isConnected, publicClient, writeContractAsync]
  );

  const finalizeWinnerSelection = useCallback(
    async (reqIdInput: bigint | number | string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        let reqId: bigint;
        if (typeof reqIdInput === "bigint") {
          reqId = reqIdInput;
        } else if (typeof reqIdInput === "number" && Number.isInteger(reqIdInput) && reqIdInput >= 0) {
          reqId = BigInt(reqIdInput);
        } else if (typeof reqIdInput === "string" && /^\d+$/.test(reqIdInput)) {
          reqId = BigInt(reqIdInput);
        } else {
          setStatus("Request id is invalid.");
          return false;
        }

        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "finalizeWinnerSelection",
          args: [reqId],
        });

        setLastTxHash(hash);
        setStatus("Finalizing winner selection...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Auction settled.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [address, ensureRightChain, isConnected, publicClient, writeContractAsync]
  );

  const registerENSWallet = useCallback(
    async (ensName: string, additionalWallet: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!activeContractAddress || !supportsAdvancedFeatures) {
          setStatus("Walnut is not available right now. Please try again later.");
          return false;
        }

        if (!ensName.trim()) {
          setStatus("ENS name is required.");
          return false;
        }

        if (!isAddress(additionalWallet)) {
          setStatus("Additional wallet address is invalid.");
          return false;
        }

        await ensureRightChain();

        const hash = await writeContractAsync({
          chain: undefined,
          account: address,
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "registerENSWallet",
          args: [ensName.trim(), additionalWallet as Address],
        });

        setLastTxHash(hash);
        setStatus("Linking wallet...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Wallet linked.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [address, ensureRightChain, isConnected, publicClient, writeContractAsync]
  );

  const getAuctionSummary = useCallback(
    async (borrower: string): Promise<AuctionSummary | null> => {
      if (!publicClient || !activeContractAddress || !supportsAdvancedFeatures || !isAddress(borrower)) {
        return null;
      }

      try {
        const summary = await publicClient.readContract({
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "getAuctionSummary",
          args: [borrower as Address],
        });

        const [auctionBorrower, endTime, bidCount, settled, active] =
          summary as [Address, bigint, bigint, boolean, boolean];

        return {
          borrower: auctionBorrower,
          endTime,
          bidCount,
          settled,
          active,
        };
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  const getAuctionBorrowers = useCallback(async (): Promise<Address[]> => {
    if (!publicClient || !activeContractAddress || !supportsAdvancedFeatures) {
      return [];
    }

    try {
      const borrowers = await publicClient.readContract({
        address: activeContractAddress,
        abi: walnutWave2Abi,
        functionName: "getAuctionBorrowers",
        args: [],
      });

      return borrowers as Address[];
    } catch {
      return [];
    }
  }, [publicClient]);

  const getPendingWinnerRequestId = useCallback(
    async (borrower: string): Promise<bigint | null> => {
      if (!publicClient || !activeContractAddress || !supportsAdvancedFeatures || !isAddress(borrower)) {
        return null;
      }

      try {
        const reqId = await publicClient.readContract({
          address: activeContractAddress,
          abi: walnutWave2Abi,
          functionName: "getPendingWinnerRequestId",
          args: [borrower as Address],
        });

        return reqId as bigint;
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  const getCurrentBlockTimestamp = useCallback(async (): Promise<bigint | null> => {
    if (!publicClient) {
      return null;
    }

    try {
      const block = await publicClient.getBlock({ blockTag: "latest" });
      return block.timestamp;
    } catch {
      return null;
    }
  }, [publicClient]);

  const linkedWallets = (linkedWalletsData ?? []) as Address[];
  const linkedWalletCount =
    typeof linkedWalletCountData === "bigint"
      ? Number(linkedWalletCountData)
      : linkedWallets.length;

  return {
    address,
    aggregatedCollateralValue,
    aggregatedCollateralDecrypting,
    aggregatedCollateralError,
    canRead,
    canUseContract,
    mode,
    activeContractAddress,
    supportsWave2CoreFeatures,
    supportsAdvancedFeatures,
    collateral,
    collateralDecrypting,
    collateralHasCiphertext,
    contractReachable,
    debt,
    debtDecrypting,
    debtHasCiphertext,
    hasDecryptError,
    hasDecryptPending,
    hasEncryptedReadError,
    decryptBlocked,
    healthFactorValue,
    healthFactorDecrypting,
    healthFactorError,
    healthFactorStatus,
    isConnectionTransient,
    isOnTargetChain,
    isConnected,
    isWalletReady,
    isEncrypting,
    isWriting,
    lastTxHash,
    liquidatable: liquidatable ?? false,
    liquidatableLoading,
    linkedWalletCount,
    linkedWalletCountLoading,
    linkedWallets,
    linkedWalletsLoading,
    permit,
    fetchAggregatedCollateral,
    fetchHealthFactor,
    finalizeWinnerSelection,
    getAuctionBorrowers,
    getPendingWinnerRequestId,
    getAuctionSummary,
    getCurrentBlockTimestamp,
    openAuction,
    refreshBalances,
    registerENSWallet,
    requestLiquidationCheck,
    selectWinningBid,
    setStatus,
    status,
    submitEncryptedAmount,
    submitLiquidationBid,
    submitRepay,
    submitWithdraw,
  };
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;
