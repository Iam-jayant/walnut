"use client";

import {
  useCofheClient,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheSelectPermit,
  useCofheRemovePermit,
} from "@cofhe/react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { debugPermit, debugError } from "@/lib/debug";

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
  const [hasMounted, setHasMounted] = useState(false);
  const [isCreatingPermit, setIsCreatingPermit] = useState(false);
  const [permitError, setPermitError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const cofheClient = useCofheClient();
  const { walletClient, publicClient } = useCofheConnection();
  const activePermit = useCofheActivePermit();
  const allPermits = useCofheAllPermits();
  const selectPermit = useCofheSelectPermit();
  const removePermit = useCofheRemovePermit();

  const requestPermitCreation = useCallback(async () => {
    if (!isConnected || !address || !chainId) {
      debugPermit("Cannot create permit - missing requirements:", {
        isConnected,
        address,
        chainId
      });
      return;
    }
    if (!walletClient || !publicClient) {
      debugPermit("Cannot create permit - missing clients:", {
        walletClient: !!walletClient,
        publicClient: !!publicClient
      });
      return;
    }

    debugPermit("Starting permit creation for:", {
      address,
      chainId,
      chainName: chainId === 421614 ? "Arbitrum Sepolia" : "Unknown"
    });

    setPermitError(null);
    setIsCreatingPermit(true);

    try {
      const permit = await cofheClient.permits.getOrCreateSelfPermit(chainId, address);

      debugPermit("Permit created/retrieved:", {
        hash: permit?.hash,
        issuer: permit?.issuer,
      });

      if (permit?.hash) {
        selectPermit(permit.hash);
        debugPermit("Permit selected:", permit.hash);
      } else {
        debugError("Permit created but has no hash!");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown permit creation error";
      debugError(`Permit creation failed: ${message}`, error);
      setPermitError(message);
    } finally {
      setIsCreatingPermit(false);
    }
  }, [address, chainId, cofheClient.permits, isConnected, publicClient, selectPermit, walletClient]);

  const activeHash = activePermit?.permit?.hash || (activePermit as any)?.hash;
  const isPermitCurrentlyValid = Boolean(activePermit?.isValid);

  // Automatically remove permit if it is expired/invalid, forcing a clean signature flow next time
  useEffect(() => {
    if (!hasMounted) return;
    if (activeHash && activePermit && !isPermitCurrentlyValid) {
      debugPermit("Active permit is expired/invalid. Removing it to force a fresh permit signature.", activeHash);
      if (chainId && address) {
        const storageKey = getStorageKey(chainId, address);
        window.localStorage.removeItem(storageKey);
      }
      void removePermit(activeHash);
    }
  }, [activeHash, isPermitCurrentlyValid, activePermit, chainId, address, hasMounted, removePermit]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!isConnected || !address || !chainId) return;
    if (!activeHash || !isPermitCurrentlyValid) return;

    const storageKey = getStorageKey(chainId, address);
    window.localStorage.setItem(storageKey, activeHash);
    
    debugPermit("Saved active permit to localStorage:", {
      key: storageKey,
      hash: activeHash,
      issuer: activePermit?.permit?.issuer,
      isValid: activePermit?.isValid
    });
  }, [activeHash, isPermitCurrentlyValid, activePermit?.isValid, activePermit?.permit?.issuer, address, chainId, hasMounted, isConnected]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!isConnected || !address || !chainId) return;
    if (activeHash) {
      debugPermit("Active permit already exists:", activeHash);
      return;
    }
    if (!allPermits.length) {
      debugPermit("No permits available yet");
      return;
    }

    const storageKey = getStorageKey(chainId, address);
    const savedHash = window.localStorage.getItem(storageKey);
    
    debugPermit("Restoring permit from storage:", {
      storageKey,
      savedHash,
      availablePermits: allPermits.length
    });
    
    const match = savedHash
      ? allPermits.find((permit) => permit.hash === savedHash)
      : undefined;

    const permitToSelect = match?.hash ?? allPermits[0].hash;
    if (activeHash === permitToSelect) return;
    debugPermit("Selecting permit:", {
      selected: permitToSelect,
      wasFromStorage: !!match,
      fallbackToFirst: !match
    });
    
    selectPermit(permitToSelect);
  }, [activeHash, address, allPermits, chainId, hasMounted, isConnected, selectPermit]);

  // Keep permit creation user-initiated to avoid hydration-time state churn/flicker.
  useEffect(() => {
    if (!hasMounted) return;
    if (isConnected && address) return;
    setPermitError(null);
  }, [address, hasMounted, isConnected]);

  const value = useMemo<WalnutPermitContextValue>(
    () => ({
      hasPermit: Boolean(activeHash && isPermitCurrentlyValid),
      isPermitValid: isPermitCurrentlyValid,
      permitHash: isPermitCurrentlyValid ? activeHash : undefined,
      permitIssuer: activePermit?.permit?.issuer as `0x${string}` | undefined,
      permitCount: allPermits.length,
      isPermitInitializing: Boolean(
        isCreatingPermit || (isConnected && (!activeHash || !isPermitCurrentlyValid) && allPermits.length === 0),
      ),
      permitError,
      requestPermitCreation: () => {
        void requestPermitCreation();
      },
    }),
    [isPermitCurrentlyValid, activeHash, activePermit?.permit?.issuer, allPermits.length, isConnected, isCreatingPermit, permitError, requestPermitCreation],
  );

  // Always provide context, even before mount to avoid context errors
  return <WalnutPermitContext.Provider value={value}>{children}</WalnutPermitContext.Provider>;
}

export function useWalnutPermit() {
  const context = useContext(WalnutPermitContext);
  if (!context) {
    throw new Error("useWalnutPermit must be used inside WalnutPermitProvider");
  }

  return context;
}
