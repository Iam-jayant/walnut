"use client";

import { useCallback, useMemo, useState } from "react";
import { useWalletClient } from "wagmi";
import type { Address, Hash } from "viem";

import { walnutChainId } from "@/lib/walnut-contract";

type SettlementKind = "repay_interest" | "p2p_match";
type SettlementState =
  | "idle"
  | "initializing"
  | "settlement_pending"
  | "settlement_confirmed"
  | "settlement_failed";

export type PrivaraSettlementResult = {
  ok: boolean;
  hash?: Hash;
  message?: string;
};

type SettlementContext = {
  user: Address;
  amount: bigint;
  interestAmount?: bigint;
  protocolFee?: bigint;
  counterparty?: Address;
};

function getNetworkName(chainId: number | undefined): "testnet" | "mainnet" {
  // Walnut currently runs on Arbitrum Sepolia.
  if (chainId === walnutChainId) return "testnet";
  return "testnet";
}

function normalizeSettlementError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const raw = String((error as { message?: unknown }).message ?? "");
    if (raw.trim()) return raw;
  }

  const reineiraCode = (error as { code?: string } | undefined)?.code;
  if (reineiraCode) return `Privara settlement failed (${reineiraCode}).`;

  return "Privara settlement failed.";
}

export function usePrivara() {
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<SettlementState>("idle");
  const [lastKind, setLastKind] = useState<SettlementKind | null>(null);
  const [lastHash, setLastHash] = useState<Hash | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const canSettle = useMemo(
    () => Boolean(walletClient?.account?.address && walletClient?.chain?.id),
    [walletClient?.account?.address, walletClient?.chain?.id]
  );

  const settle = useCallback(
    async (kind: SettlementKind, context: SettlementContext): Promise<PrivaraSettlementResult> => {
      if (!walletClient || !walletClient.account?.address) {
        const message = "Wallet connection is required for private settlement.";
        setState("settlement_failed");
        setLastError(message);
        return { ok: false, message };
      }

      const interestAmount = context.interestAmount ?? context.amount;
      const protocolFee = context.protocolFee ?? 0n;

      if (interestAmount <= 0n) {
        const message = "Settlement amount must be greater than zero.";
        setState("settlement_failed");
        setLastError(message);
        return { ok: false, message };
      }

      setLastKind(kind);
      setLastHash(null);
      setLastError(null);
      setState("initializing");

      try {
        setState("settlement_pending");
        const response = await fetch("/api/privara/settle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind,
            user: context.user,
            counterparty: context.counterparty,
            amount: context.amount.toString(),
            interestAmount: interestAmount.toString(),
            protocolFee: protocolFee.toString(),
            network: getNetworkName(walletClient.chain?.id),
            chainId: walletClient.chain?.id ?? walnutChainId,
          }),
        });

        const payload = (await response.json()) as
          | { ok: true; hash: string }
          | { ok: false; message: string };

        if (!response.ok || !payload.ok) {
          const message = payload.ok ? "Privara settlement failed." : payload.message;
          setLastError(message);
          setState("settlement_failed");
          return { ok: false, message };
        }

        const hash = payload.hash as Hash;

        setLastHash(hash);
        setState("settlement_confirmed");
        return { ok: true, hash };
      } catch (error) {
        const message = normalizeSettlementError(error);
        setLastError(message);
        setState("settlement_failed");
        return { ok: false, message };
      }
    },
    [walletClient]
  );

  const settleRepayInterest = useCallback(
    async (context: SettlementContext) => settle("repay_interest", context),
    [settle]
  );

  const settleP2PMatch = useCallback(
    async (context: SettlementContext) => settle("p2p_match", context),
    [settle]
  );

  const reset = useCallback(() => {
    setState("idle");
    setLastKind(null);
    setLastHash(null);
    setLastError(null);
  }, []);

  return {
    canSettle,
    state,
    lastKind,
    lastHash,
    lastError,
    settleRepayInterest,
    settleP2PMatch,
    reset,
  } as const;
}
