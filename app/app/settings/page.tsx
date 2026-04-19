"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { type Address, isAddress } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { usePublicClient } from "wagmi";

const ONBOARD_KEY = "walnut_wave1_onboard_complete";
const PERMIT_STORAGE_PREFIX = "walnut_active_permit_hash_";

function areEnsNameMapsEqual(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

function trimAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function SettingsPage() {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const permit = useWalnutPermit();
  const protocol = useWalnutProtocol({ mode: "advanced" });
  const [ensNameInput, setEnsNameInput] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [showAggregated, setShowAggregated] = useState(false);
  const [resolvedEnsNames, setResolvedEnsNames] = useState<Record<string, string>>({});
  const linkedWalletsKey = useMemo(
    () => protocol.linkedWallets.map((wallet) => wallet.toLowerCase()).sort().join("|"),
    [protocol.linkedWallets]
  );
  const linkedWalletsForEns = useMemo(
    () => (linkedWalletsKey ? (linkedWalletsKey.split("|") as Address[]) : []),
    [linkedWalletsKey]
  );

  useEffect(() => {
    let active = true;

    async function resolveNames() {
      if (!publicClient || linkedWalletsForEns.length === 0) {
        if (active) {
          setResolvedEnsNames((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        }
        return;
      }

      const entries = await Promise.all(
        linkedWalletsForEns.map(async (linkedWallet) => {
          try {
            const resolvedName = await publicClient.getEnsName({ address: linkedWallet });
            return [linkedWallet.toLowerCase(), resolvedName ?? ""] as const;
          } catch {
            return [linkedWallet.toLowerCase(), ""] as const;
          }
        })
      );

      if (!active) return;

      const next: Record<string, string> = {};
      for (const [wallet, ensName] of entries) {
        if (ensName) {
          next[wallet] = ensName;
        }
      }

      setResolvedEnsNames((prev) => (areEnsNameMapsEqual(prev, next) ? prev : next));
    }

    void resolveNames();

    return () => {
      active = false;
    };
  }, [linkedWalletsForEns, publicClient]);

  const linkedWalletDisplayCount = Math.max(1, protocol.linkedWalletCount + 1);
  const walletForSubmit = walletInput.trim();
  const canLinkWallet = Boolean(ensNameInput.trim() && isAddress(walletForSubmit));

  const aggregatedCollateralLabel = useMemo(() => {
    if (!showAggregated || !protocol.canRead) return "******";
    if (protocol.aggregatedCollateralDecrypting) return "Loading...";
    if (typeof protocol.aggregatedCollateralValue === "bigint") {
      return protocol.aggregatedCollateralValue.toString();
    }
    return "0";
  }, [
    protocol.aggregatedCollateralValue,
    protocol.aggregatedCollateralDecrypting,
    protocol.canRead,
    showAggregated,
  ]);

  useEffect(() => {
    if (!showAggregated || !protocol.canRead || !address) return;

    // Avoid repeated signing prompts when the value is already available.
    if (typeof protocol.aggregatedCollateralValue === "bigint") return;

    void protocol.fetchAggregatedCollateral(address as Address);
  }, [
    address,
    protocol.aggregatedCollateralValue,
    protocol.canRead,
    protocol.fetchAggregatedCollateral,
    showAggregated,
  ]);

  function clearOnboardingFlag() {
    window.localStorage.removeItem(ONBOARD_KEY);
  }

  function clearCachedPermitSelection() {
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PERMIT_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }

  async function handleLinkWallet() {
    const normalizedWallet = walletForSubmit;
    if (!isAddress(normalizedWallet)) {
      protocol.setStatus("Additional wallet address is invalid.");
      return;
    }

    const success = await protocol.registerENSWallet(
      ensNameInput.trim(),
      normalizedWallet as Address
    );

    if (success) {
      setWalletInput("");
      await protocol.refreshBalances();
      if (showAggregated) {
        await protocol.fetchAggregatedCollateral(address as Address | undefined);
      }
    }
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Profile</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          View wallet status and use debug controls for local permit/session state.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <GlassPanel className="walnut-card">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="walnut-card">
            <dt className="walnut-label">Wallet</dt>
            <dd className="walnut-meta break-all font-mono text-foreground">{address ?? "Not connected"}</dd>
          </div>
          <div className="walnut-card">
            <dt className="walnut-label">Active Chain</dt>
            <dd className="walnut-meta font-mono text-foreground">{chain?.name ?? "Unknown"}</dd>
          </div>
        </dl>
      </GlassPanel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-4">
          <div>
            <p className="walnut-label">Linked Wallets</p>
            <h2 className="mt-2 font-display text-2xl text-foreground">ENS Aggregation Setup</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Register additional wallets under your ENS identity and aggregate encrypted collateral.
            </p>
          </div>

          <div className="grid gap-3">
            <div>
              <label htmlFor="ens-name" className="mb-2 block text-sm text-foreground">
                ENS Name
              </label>
              <Input
                id="ens-name"
                value={ensNameInput}
                onChange={(event) => setEnsNameInput(event.target.value)}
                placeholder="yourname.eth"
                className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
              />
            </div>

            <div>
              <label htmlFor="linked-wallet" className="mb-2 block text-sm text-foreground">
                Additional Wallet
              </label>
              <Input
                id="linked-wallet"
                value={walletInput}
                onChange={(event) => setWalletInput(event.target.value)}
                placeholder="0x..."
                className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={handleLinkWallet}
              isLoading={protocol.isWriting}
              loadingText="Linking..."
              disabled={!canLinkWallet || protocol.isWriting}
            >
              Link Wallet
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={() => setShowAggregated((value) => !value)}
              isLoading={showAggregated && protocol.aggregatedCollateralDecrypting}
              loadingText="Decrypting..."
            >
              {showAggregated ? "Hide Aggregated Collateral" : "Show Aggregated Collateral"}
            </Button>
          </div>

          {!protocol.permit.hasPermit && (
            <div className="walnut-alert walnut-alert-warning">
              <p className="text-sm text-foreground">Enable private access to decrypt aggregated collateral.</p>
              <Button
                variant="outline"
                className="glass-button mt-3"
                onClick={protocol.permit.requestPermitCreation}
                isLoading={protocol.permit.isPermitInitializing}
                loadingText="Enabling..."
              >
                Enable Private Access
              </Button>
            </div>
          )}
        </GlassPanel>

        <div className="space-y-4">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Aggregated Collateral</p>
            <p className="walnut-value">{aggregatedCollateralLabel}</p>
            <p className="walnut-meta">Aggregated across {linkedWalletDisplayCount} wallets</p>
          </GlassPanel>

          <GlassPanel className="walnut-card space-y-3">
            <p className="walnut-label">Linked Wallet List</p>

            {protocol.linkedWalletsLoading ? (
              <div className="space-y-2">
                <div className="h-14 animate-pulse rounded-xl border border-black/10 bg-black/5" />
                <div className="h-14 animate-pulse rounded-xl border border-black/10 bg-black/5" />
              </div>
            ) : protocol.linkedWallets.length === 0 ? (
              <div className="walnut-alert">
                <p className="text-sm text-muted-foreground">
                  No linked wallets exist yet. Link an additional wallet to start ENS collateral aggregation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {protocol.linkedWallets.map((linkedWallet) => {
                  const ensDisplay = resolvedEnsNames[linkedWallet.toLowerCase()];

                  return (
                    <div key={linkedWallet} className="walnut-progress">
                      <p className="text-sm font-medium text-foreground">{trimAddress(linkedWallet)}</p>
                      <p className="mt-1 text-xs text-muted-foreground break-all">{linkedWallet}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ensDisplay ? `ENS: ${ensDisplay}` : "ENS: not found"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        </div>
      </div>

      <GlassPanel className="walnut-alert walnut-alert-warning">
        <p className="text-sm text-foreground">Debug Controls</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Active permit: {permit.hasPermit ? "Present" : "Missing"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="glass-button" onClick={permit.requestPermitCreation}>
            Re-request Permit
          </Button>
          <Button variant="outline" className="glass-button" onClick={clearCachedPermitSelection}>
            Clear Permit Cache
          </Button>
          <Button variant="outline" className="glass-button" onClick={clearOnboardingFlag}>
            Clear Onboarding Flag
          </Button>
        </div>
      </GlassPanel>

      {protocol.status && (
        <GlassPanel className="walnut-alert border-accent/40">
          <p className="text-sm text-foreground">{protocol.status}</p>
        </GlassPanel>
      )}

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
