"use client";

import {
  useCofheClient,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheSelectPermit,
} from "@cofhe/react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const requestPermitCreation = useCallback(async () => {
    if (!isConnected || !address || !chainId) {
      console.log("[Permit Debug] Cannot create permit - missing requirements:", {
        isConnected,
        address,
        chainId
      });
      return;
    }
    if (!walletClient || !publicClient) {
      console.log("[Permit Debug] Cannot create permit - missing clients:", {
        walletClient: !!walletClient,
        publicClient: !!publicClient
      });
      return;
    }

    console.log("[Permit Debug] Starting permit creation for:", {
      address,
      chainId,
      chainName: chainId === 421614 ? "Arbitrum Sepolia" : "Unknown"
    });

    setPermitError(null);
    setIsCreatingPermit(true);

    try {
      const permit = await cofheClient.permits.getOrCreateSelfPermit(chainId, address);

      console.log("[Permit Debug] Permit created/retrieved:", {
        hash: permit?.hash,
        issuer: permit?.issuer,
      });

      if (permit?.hash) {
        selectPermit(permit.hash);
        console.log("[Permit Debug] Permit selected:", permit.hash);
      } else {
        console.error("[Permit Debug] Permit created but has no hash!");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown permit creation error";
      console.error("[Permit Debug] Permit creation failed:", message, error);
      setPermitError(message);
    } finally {
      setIsCreatingPermit(false);
    }
  }, [address, chainId, cofheClient.permits, isConnected, publicClient, selectPermit, walletClient]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!isConnected || !address || !chainId) return;
    if (!activePermit?.permit?.hash) return;

    const storageKey = getStorageKey(chainId, address);
    window.localStorage.setItem(storageKey, activePermit.permit.hash);
    
    console.log("[Permit Debug] Saved active permit to localStorage:", {
      key: storageKey,
      hash: activePermit.permit.hash,
      issuer: activePermit.permit.issuer,
      isValid: activePermit.isValid
    });
  }, [activePermit?.permit?.hash, activePermit?.isValid, activePermit?.permit?.issuer, address, chainId, hasMounted, isConnected]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!isConnected || !address || !chainId) return;
    if (activePermit?.permit?.hash) {
      console.log("[Permit Debug] Active permit already exists:", activePermit.permit.hash);
      return;
    }
    if (!allPermits.length) {
      console.log("[Permit Debug] No permits available yet");
      return;
    }

    const storageKey = getStorageKey(chainId, address);
    const savedHash = window.localStorage.getItem(storageKey);
    
    console.log("[Permit Debug] Restoring permit from storage:", {
      storageKey,
      savedHash,
      availablePermits: allPermits.length
    });
    
    const match = savedHash
      ? allPermits.find((permit) => permit.hash === savedHash)
      : undefined;

    const permitToSelect = match?.hash ?? allPermits[0].hash;
    if (activePermit?.permit?.hash === permitToSelect) return;
    console.log("[Permit Debug] Selecting permit:", {
      selected: permitToSelect,
      wasFromStorage: !!match,
      fallbackToFirst: !match
    });
    
    selectPermit(permitToSelect);
  }, [activePermit?.permit?.hash, address, allPermits, chainId, hasMounted, isConnected, selectPermit]);

  // Keep permit creation user-initiated to avoid hydration-time state churn/flicker.
  useEffect(() => {
    if (!hasMounted) return;
    if (isConnected && address) return;
    setPermitError(null);
  }, [address, hasMounted, isConnected]);

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
