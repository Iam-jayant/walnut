"use client";

import { Encryptable, FheTypes } from "@cofhe/sdk";
import {
  useCofheEncrypt,
  useCofheReadContractAndDecrypt,
  useCofheWriteContract,
} from "@cofhe/react";
import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain } from "wagmi";

import {
  walnutChainId,
  walnutContractAddress,
  walnutWave1Abi,
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

  const canUseContract = Boolean(walnutContractAddress);
  const isOnTargetChain = chainId === walnutChainId;
  const canRead = Boolean(isConnected && address && canUseContract && isOnTargetChain);

  const collateral = useCofheReadContractAndDecrypt<
    typeof walnutWave1Abi,
    "getEncryptedCollateral",
    FheTypes.Uint128
  >(
    {
      address: walnutContractAddress,
      abi: walnutWave1Abi,
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
    typeof walnutWave1Abi,
    "getEncryptedDebt",
    FheTypes.Uint128
  >(
    {
      address: walnutContractAddress,
      abi: walnutWave1Abi,
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
    ]);
  }, [collateral.decrypted, collateral.encrypted, debt.decrypted, debt.encrypted]);

  const submitEncryptedAmount = useCallback(
    async (action: WalnutAction, rawAmount: string) => {
      try {
        setStatus("");
        setLastTxHash(null);

        if (!isConnected || !address) {
          setStatus("Connect wallet first.");
          return false;
        }

        if (!canUseContract || !walnutContractAddress) {
          setStatus("Set NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS in your environment.");
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
          address: walnutContractAddress,
          abi: walnutWave1Abi,
          functionName: action,
          args: [encodedForContract],
        });

        setLastTxHash(hash);
        setStatus(`${action === "deposit" ? "Deposit" : "Borrow"} submitted.`);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        await refreshBalances();

        setStatus(`${action === "deposit" ? "Deposit" : "Borrow"} confirmed.`);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setStatus(`Failed: ${message}`);
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
    isOnTargetChain,
    isConnected,
    isEncrypting,
    isWriting,
    lastTxHash,
    permit,
    refreshBalances,
    setStatus,
    status,
    submitEncryptedAmount,
  };
}

export type WalnutProtocolState = ReturnType<typeof useWalnutProtocol>;
