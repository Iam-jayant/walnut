"use client";

import {
  useCofheClient,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheSelectPermit,
} from "@cofhe/react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

type WalnutPermitContextValue = {
  hasPermit: boolean;
  isPermitValid: boolean;
  permitHash?: string;
  permitIssuer?: `0x${string}`;
  permitCount: number;
  isPermitInitializing: boolean;
  permitError: string | null;
  requestPermitCreation: () => void;
};

const WalnutPermitContext = createContext<WalnutPermitContextValue | null>(null);

function getStorageKey(chainId: number | undefined, address: string | undefined) {
  return `walnut_active_permit_hash_${chainId ?? "unknown"}_${(address ?? "unknown").toLowerCase()}`;
}

export function WalnutPermitProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const cofheClient = useCofheClient();
  const { walletClient, publicClient } = useCofheConnection();
  const activePermit = useCofheActivePermit();
  const allPermits = useCofheAllPermits();
  const selectPermit = useCofheSelectPermit();
  const [isCreatingPermit, setIsCreatingPermit] = useState(false);
  const [permitError, setPermitError] = useState<string | null>(null);
  const autoRequestedRef = useRef(false);

  const requestPermitCreation = useCallback(async () => {
    if (!isConnected || !address || !chainId) return;
    if (!walletClient || !publicClient) return;

    setPermitError(null);
    setIsCreatingPermit(true);

    try {
      const permit = await cofheClient.permits.getOrCreateSelfPermit(chainId, address);

      if (permit?.hash) {
        selectPermit(permit.hash);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown permit creation error";
      setPermitError(message);
    } finally {
      setIsCreatingPermit(false);
    }
  }, [address, chainId, cofheClient.permits, isConnected, publicClient, selectPermit, walletClient]);

  useEffect(() => {
    if (!isConnected || !address) return;
    if (!activePermit?.permit?.hash || !chainId) return;

    window.localStorage.setItem(getStorageKey(chainId, address), activePermit.permit.hash);
  }, [activePermit?.permit?.hash, address, chainId, isConnected]);

  useEffect(() => {
    if (!isConnected || !address || !chainId) return;
    if (activePermit?.permit?.hash) return;
    if (!allPermits.length) return;

    const storageKey = getStorageKey(chainId, address);
    const savedHash = window.localStorage.getItem(storageKey);
    const match = savedHash
      ? allPermits.find((permit) => permit.hash === savedHash)
      : undefined;

    selectPermit(match?.hash ?? allPermits[0].hash);
  }, [activePermit?.permit?.hash, address, allPermits, chainId, isConnected, selectPermit]);

  useEffect(() => {
    if (!isConnected || !address) {
      autoRequestedRef.current = false;
      setPermitError(null);
      return;
    }

    if (activePermit?.permit?.hash || allPermits.length > 0) return;
    if (autoRequestedRef.current) return;

    autoRequestedRef.current = true;
    void requestPermitCreation();
  }, [activePermit?.permit?.hash, address, allPermits.length, isConnected, requestPermitCreation]);

  const value = useMemo<WalnutPermitContextValue>(
    () => ({
      hasPermit: Boolean(activePermit?.permit?.hash),
      isPermitValid: Boolean(activePermit?.isValid),
      permitHash: activePermit?.permit?.hash,
      permitIssuer: activePermit?.permit?.issuer as `0x${string}` | undefined,
      permitCount: allPermits.length,
      isPermitInitializing: Boolean(
        isCreatingPermit || (isConnected && !activePermit?.permit?.hash && allPermits.length === 0),
      ),
      permitError,
      requestPermitCreation: () => {
        void requestPermitCreation();
      },
    }),
    [activePermit?.isValid, activePermit?.permit?.hash, allPermits.length, isConnected, isCreatingPermit, permitError, requestPermitCreation],
  );

  return <WalnutPermitContext.Provider value={value}>{children}</WalnutPermitContext.Provider>;
}

export function useWalnutPermit() {
  const context = useContext(WalnutPermitContext);
  if (!context) {
    throw new Error("useWalnutPermit must be used inside WalnutPermitProvider");
  }

  return context;
}
