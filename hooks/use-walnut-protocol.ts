"use client";

import { Encryptable, FheTypes } from "@cofhe/sdk";
import {
  useCofheEncrypt,
  useCofheReadContractAndDecrypt,
  useCofheWriteContract,
} from "@cofhe/react";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";

import {
  walnutChainId,
  walnutWave2Abi,
  walnutWave2ContractAddress,
} from "@/lib/walnut-contract";
import { useWalnutPermit } from "@/components/walnut/permit-provider";

export type WalnutAction = "deposit" | "borrow";

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

export function useWalnutProtocol() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const permit = useWalnutPermit();

  const { encryptInputsAsync, isEncrypting } = useCofheEncrypt();
  const { writeContractAsync, isPending: isWriting } = useCofheWriteContract();

  const [status, setStatus] = useState("");
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const canUseContract = Boolean(walnutWave2ContractAddress);
  const isOnTargetChain = chainId === walnutChainId;
  const canRead = Boolean(isConnected && address && canUseContract && isOnTargetChain);

  const collateral = useCofheReadContractAndDecrypt<
    typeof walnutWave2Abi,
    "getEncryptedCollateral",
    FheTypes.Uint128
  >(
    {
      address: walnutWave2ContractAddress,
      abi: walnutWave2Abi,
      functionName: "getEncryptedCollateral",
      args: address ? [address] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: canRead,
        refetchInterval: 15000,
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
      address: walnutWave2ContractAddress,
      abi: walnutWave2Abi,
      functionName: "getEncryptedDebt",
      args: address ? [address] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: canRead,
        refetchInterval: 15000,
      },
      decryptingQueryOptions: {
        enabled: canRead && permit.hasPermit,
      },
    }
  );

  const healthFactor = useCofheReadContractAndDecrypt<
    typeof walnutWave2Abi,
    "getHealthFactor",
    FheTypes.Uint128
  >(
    {
      address: walnutWave2ContractAddress,
      abi: walnutWave2Abi,
      functionName: "getHealthFactor",
      args: address ? [address] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: canRead,
        refetchInterval: 15000,
      },
      decryptingQueryOptions: {
        enabled: canRead && permit.hasPermit,
      },
    }
  );

  const { data: liquidatable, isLoading: liquidatableLoading } = useReadContract({
    address: walnutWave2ContractAddress,
    abi: walnutWave2Abi,
    functionName: "liquidatable",
    args: address ? [address] : undefined,
    query: {
      enabled: canRead,
      refetchInterval: 15000,
    },
  });

  const missingPermit = !permit.hasPermit || !permit.isPermitValid;
  const decryptBlocked =
    collateral.disabledDueToMissingPermit || debt.disabledDueToMissingPermit || missingPermit;

  const collateralCtHash = extractCtHash(collateral.encrypted.data);
  const debtCtHash = extractCtHash(debt.encrypted.data);
  const collateralHasCiphertext = Boolean(collateralCtHash && collateralCtHash > 0n);
  const debtHasCiphertext = Boolean(debtCtHash && debtCtHash > 0n);
  const collateralDecrypting = Boolean(collateralHasCiphertext && collateral.decrypted.isFetching);
  const debtDecrypting = Boolean(debtHasCiphertext && debt.decrypted.isFetching);

  const hasDecryptPending = Boolean(
    canRead && permit.hasPermit && (collateralDecrypting || debtDecrypting)
  );
  const hasDecryptError = Boolean(
    (collateralHasCiphertext && collateral.decrypted.error) ||
    (debtHasCiphertext && debt.decrypted.error)
  );
  const hasEncryptedReadError = Boolean(collateral.encrypted.error || debt.encrypted.error);
  const contractReachable = Boolean(canRead && !hasEncryptedReadError);

  const healthFactorCtHash = extractCtHash(healthFactor.encrypted.data);
  const healthFactorHasCiphertext = Boolean(healthFactorCtHash && healthFactorCtHash > 0n);
  const healthFactorDecrypting = Boolean(
    healthFactorHasCiphertext && healthFactor.decrypted.isFetching
  );

  const healthFactorStatus: "safe" | "at-risk" | "liquidatable" | "unknown" = (() => {
    const decryptedValue = healthFactor.decrypted.data;
    if (decryptedValue === undefined) return "unknown";
    if (decryptedValue >= 15000n) return "safe";
    if (decryptedValue >= 10500n) return "at-risk";
    return "liquidatable";
  })();

  const ensureRightChain = useCallback(async () => {
    if (chainId === walnutChainId) return;
    await switchChainAsync({ chainId: walnutChainId });
  }, [chainId, switchChainAsync]);

  const refreshBalances = useCallback(async () => {
    await Promise.all([
      collateral.encrypted.refetch(),
      collateral.decrypted.refetch(),
      debt.encrypted.refetch(),
      debt.decrypted.refetch(),
      healthFactor.encrypted.refetch(),
      healthFactor.decrypted.refetch(),
    ]);
  }, [
    collateral.decrypted,
    collateral.encrypted,
    debt.decrypted,
    debt.encrypted,
    healthFactor.decrypted,
    healthFactor.encrypted,
  ]);

  const submitEncryptedAmount = useCallback(
    async (action: WalnutAction, rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!canUseContract || !walnutWave2ContractAddress) {
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
          address: walnutWave2ContractAddress,
          abi: walnutWave2Abi,
          functionName: action,
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus(`${action === "deposit" ? "Deposit" : "Borrow"} is being processed...`);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        await refreshBalances();

        setStatus(`${action === "deposit" ? "Deposit" : "Borrow"} confirmed.`);
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      canUseContract,
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

        if (!walnutWave2ContractAddress) {
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
          address: walnutWave2ContractAddress,
          abi: walnutWave2Abi,
          functionName: "repay",
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus("Repayment is being processed...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        await refreshBalances();

        setStatus("Repayment confirmed.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      encryptInputsAsync,
      ensureRightChain,
      isConnected,
      publicClient,
      refreshBalances,
      writeContractAsync,
    ]
  );

  const submitWithdraw = useCallback(
    async (rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Please connect your wallet.");
          return false;
        }

        if (!walnutWave2ContractAddress) {
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
          address: walnutWave2ContractAddress,
          abi: walnutWave2Abi,
          functionName: "withdraw",
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus("Withdrawal is being processed...");

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        await refreshBalances();

        setStatus("Withdrawal confirmed.");
        return true;
      } catch {
        setStatus("Something went wrong. Please try again.");
        return false;
      }
    },
    [
      address,
      encryptInputsAsync,
      ensureRightChain,
      isConnected,
      publicClient,
      refreshBalances,
      writeContractAsync,
    ]
  );

  const requestLiquidationCheck = useCallback(async () => {
    try {
      if (!isConnected || !address) {
        setStatus("Please connect your wallet.");
        return;
      }

      if (!walnutWave2ContractAddress) {
        setStatus("Walnut is not available right now. Please try again later.");
        return;
      }

      await ensureRightChain();

      setStatus("Checking your position risk...");

      const hash = await writeContractAsync({
        chain: undefined,
        account: address,
        address: walnutWave2ContractAddress,
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

  return {
    address,
    canRead,
    canUseContract,
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
    healthFactor,
    healthFactorDecrypting,
    healthFactorStatus,
    isOnTargetChain,
    isConnected,
    isEncrypting,
    isWriting,
    lastTxHash,
    liquidatable: liquidatable ?? false,
    liquidatableLoading,
    permit,
    refreshBalances,
    requestLiquidationCheck,
    setStatus,
    status,
    submitEncryptedAmount,
    submitRepay,
    submitWithdraw,
  };
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;
