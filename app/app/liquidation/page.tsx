"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hourglass, RefreshCcw, Gavel } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useAccount } from "wagmi";
import { isAddress, type Address } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { HealthFactorCard } from "@/components/walnut/health-factor-card";
import { LiquidationBadge } from "@/components/walnut/liquidation-badge";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { type AuctionSummary, useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import {
  HEALTH_FACTOR_AT_RISK_THRESHOLD,
  HEALTH_FACTOR_SAFE_THRESHOLD,
} from "@/lib/protocol-constants";
import { wagmiConfig } from "@/lib/web3-config";
import { walnutChainId } from "@/lib/walnut-contract";

type AuctionRow = AuctionSummary & {
  pendingRequestId: bigint;
  secondsLeft: bigint;
};

type LiquidationActionKey =
  | "risk-check"
  | "open-connected"
  | "open-auction"
  | "submit-bid"
  | "select-winner"
  | "finalize-winner";

const AUCTION_REFRESH_INTERVAL_MS = 30_000;
const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCountdown(secondsLeft: bigint) {
  if (secondsLeft <= 0n) return "Bidding closed";

  const hours = secondsLeft / 3600n;
  const minutes = (secondsLeft % 3600n) / 60n;
  const seconds = secondsLeft % 60n;

  if (hours > 0n) {
    return `${hours.toString()}h ${minutes.toString().padStart(2, "0")}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  }

  return `${minutes.toString()}m ${seconds.toString().padStart(2, "0")}s`;
}

function getHealthStatus(
  value: bigint | undefined,
  showDecrypted: boolean,
  decrypting: boolean
): "safe" | "at-risk" | "liquidatable" | "unknown" {
  if (!showDecrypted || decrypting || value === undefined) return "unknown";
  if (value >= HEALTH_FACTOR_SAFE_THRESHOLD) return "safe";
  if (value >= HEALTH_FACTOR_AT_RISK_THRESHOLD) return "at-risk";
  return "liquidatable";
}

export default function LiquidationPage() {
  const protocol = useWalnutProtocol({ mode: "advanced" });
  const { address } = useAccount();

  const [borrowerInput, setBorrowerInput] = useState("");
  const [bidAmountInput, setBidAmountInput] = useState("");
  const [finalizeRequestIdInput, setFinalizeRequestIdInput] = useState("");
  const [showBorrowerHealth, setShowBorrowerHealth] = useState(false);
  const [auctionRows, setAuctionRows] = useState<AuctionRow[]>([]);
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [borrowerHealthValue, setBorrowerHealthValue] = useState<bigint | undefined>(undefined);
  const [borrowerHealthLoading, setBorrowerHealthLoading] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<LiquidationActionKey | null>(null);
  const isRefreshingAuctionRowsRef = useRef(false);
  const anyActionInFlight = actionInFlight !== null;

  const inspectedBorrower = useMemo(() => {
    const trimmed = borrowerInput.trim();
    return isAddress(trimmed) ? (trimmed as Address) : undefined;
  }, [borrowerInput]);

  useEffect(() => {
    if (!showBorrowerHealth || !inspectedBorrower || !protocol.canRead) return;

    let active = true;
    setBorrowerHealthLoading(true);

    void protocol
      .fetchHealthFactor(inspectedBorrower)
      .then((value) => {
        if (!active) return;
        setBorrowerHealthValue(value);
      })
      .finally(() => {
        if (!active) return;
        setBorrowerHealthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inspectedBorrower, protocol, protocol.canRead, protocol.fetchHealthFactor, showBorrowerHealth]);

  const refreshAuctionRows = useCallback(async () => {
    if (!protocol.canRead) {
      setAuctionRows([]);
      return;
    }

    if (isRefreshingAuctionRowsRef.current) {
      return;
    }

    isRefreshingAuctionRowsRef.current = true;

    setAuctionLoading(true);

    try {
      const [borrowers, currentTimestamp] = await Promise.all([
        protocol.getAuctionBorrowers(),
        protocol.getCurrentBlockTimestamp(),
      ]);

      const summaries = await Promise.all(
        borrowers.map(async (borrowerAddress) => {
          const [summary, pendingRequestId] = await Promise.all([
            protocol.getAuctionSummary(borrowerAddress),
            protocol.getPendingWinnerRequestId(borrowerAddress),
          ]);

          if (!summary) return null;

          const secondsLeft =
            currentTimestamp !== null && summary.endTime > currentTimestamp
              ? summary.endTime - currentTimestamp
              : 0n;

          return {
            ...summary,
            pendingRequestId: pendingRequestId ?? 0n,
            secondsLeft,
          } satisfies AuctionRow;
        })
      );

      const normalized = summaries
        .filter((item): item is AuctionRow => item !== null)
        .filter((item) => item.active || item.pendingRequestId > 0n)
        .sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          if (a.endTime === b.endTime) return 0;
          return a.endTime < b.endTime ? -1 : 1;
        });

      setAuctionRows(normalized);
    } catch {
      // Keep the last successful rows when RPC is temporarily unavailable.
    } finally {
      isRefreshingAuctionRowsRef.current = false;
      setAuctionLoading(false);
    }
  }, [
    isRefreshingAuctionRowsRef,
    protocol,
    protocol.canRead,
    protocol.getAuctionBorrowers,
    protocol.getAuctionSummary,
    protocol.getCurrentBlockTimestamp,
    protocol.getPendingWinnerRequestId,
  ]);

  useEffect(() => {
    void refreshAuctionRows();

    const intervalId = window.setInterval(() => {
      void refreshAuctionRows();
    }, AUCTION_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshAuctionRows]);

  const focusedAuction = useMemo(() => {
    if (!inspectedBorrower) return null;
    return (
      auctionRows.find((item) => item.borrower.toLowerCase() === inspectedBorrower.toLowerCase()) ?? null
    );
  }, [auctionRows, inspectedBorrower]);

  const borrowerHealthStatus = getHealthStatus(
    borrowerHealthValue,
    showBorrowerHealth,
    borrowerHealthLoading
  );

  const pendingFinalizeRequestId = useMemo(() => {
    if (focusedAuction && focusedAuction.pendingRequestId > 0n) {
      return focusedAuction.pendingRequestId.toString();
    }
    return "";
  }, [focusedAuction]);

  const effectiveFinalizeRequestId = finalizeRequestIdInput.trim() || pendingFinalizeRequestId;

  const canSubmitBid = Boolean(
    inspectedBorrower &&
      focusedAuction &&
      focusedAuction.active &&
      !focusedAuction.settled &&
      focusedAuction.secondsLeft > 0n
  );

  const canSelectWinner = Boolean(
    inspectedBorrower &&
      focusedAuction &&
      focusedAuction.active &&
      !focusedAuction.settled &&
      focusedAuction.secondsLeft === 0n &&
      focusedAuction.bidCount > 0n
  );

  const canFinalize = Boolean(effectiveFinalizeRequestId && inspectedBorrower);

  const runAndRefresh = useCallback(
    async (actionKey: LiquidationActionKey, action: () => Promise<boolean>, onSuccess?: () => void) => {
      if (actionInFlight) return;

      setActionInFlight(actionKey);
      try {
        const success = await action();
        if (!success) return;

        onSuccess?.();

        try {
          await Promise.all([protocol.refreshBalances(), refreshAuctionRows()]);
        } catch {
          // Transaction was already confirmed; keep UI moving even if refresh is temporarily unavailable.
        }
      } finally {
        setActionInFlight(null);
      }
    },
    [actionInFlight, protocol, refreshAuctionRows]
  );

  async function handleOpenAuction() {
    if (!inspectedBorrower) {
      protocol.setStatus("Borrower address is invalid.");
      return;
    }

    await runAndRefresh("open-auction", () => protocol.openAuction(inspectedBorrower));
  }

  async function handleSubmitBid() {
    if (!inspectedBorrower) {
      protocol.setStatus("Borrower address is invalid.");
      return;
    }

    await runAndRefresh(
      "submit-bid",
      () => protocol.submitLiquidationBid(inspectedBorrower, bidAmountInput),
      () => setBidAmountInput("")
    );
  }

  async function handleSelectWinner() {
    if (!inspectedBorrower) {
      protocol.setStatus("Borrower address is invalid.");
      return;
    }

    await runAndRefresh("select-winner", () => protocol.selectWinningBid(inspectedBorrower));
  }

  async function handleFinalizeWinner() {
    if (!effectiveFinalizeRequestId) {
      protocol.setStatus("No pending winner request id found for this borrower.");
      return;
    }

    await runAndRefresh(
      "finalize-winner",
      () => protocol.finalizeWinnerSelection(effectiveFinalizeRequestId),
      () => setFinalizeRequestIdInput("")
    );
  }

  async function handleConnectedRiskCheck() {
    if (actionInFlight) return;

    setActionInFlight("risk-check");
    try {
      await protocol.requestLiquidationCheck();
      try {
        await Promise.all([protocol.refreshBalances(), refreshAuctionRows()]);
      } catch {
        // Non-blocking refresh failure.
      }
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleOpenConnectedAuction() {
    if (!address) {
      protocol.setStatus("Please connect your wallet.");
      return;
    }

    await runAndRefresh("open-connected", () => protocol.openAuction(address));
  }

  const borrowerHealthCard = inspectedBorrower ? (
    <HealthFactorCard
      healthFactor={borrowerHealthValue}
      isDecrypting={borrowerHealthLoading}
      showDecrypted={showBorrowerHealth}
      status={borrowerHealthStatus}
    />
  ) : (
    <GlassPanel className="walnut-card">
      <p className="walnut-label">Borrower Health Factor</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter a borrower wallet address to inspect health factor and auction status.
      </p>
    </GlassPanel>
  );

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Liquidation</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Sealed-Bid Liquidation Desk</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Watch liquidatable borrowers, run private bid auctions, and finalize winners through on-chain status transitions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted Bids</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">Helper View Backed</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">{targetChainName}</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />
      <LiquidationBadge liquidatable={protocol.liquidatable} />

      <div className="grid items-start gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <GlassPanel className="walnut-card walnut-card-strong space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="walnut-label">Connected Wallet Risk</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Run liquidation checks on your own position and open an auction when your address is flagged.
                </p>
              </div>
              <span className="walnut-status-chip walnut-status-chip-ghost">
                {protocol.liquidatable ? "Liquidatable" : "Not Liquidatable"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="glass-button"
                onClick={handleConnectedRiskCheck}
                isLoading={actionInFlight === "risk-check"}
                loadingText="Checking..."
                disabled={!protocol.isConnected || anyActionInFlight}
              >
                Run Risk Check
              </Button>
              <Button
                className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
                onClick={handleOpenConnectedAuction}
                isLoading={actionInFlight === "open-connected"}
                loadingText="Opening..."
                disabled={!protocol.liquidatable || !protocol.isConnected || anyActionInFlight}
              >
                Open Auction For My Wallet
              </Button>
            </div>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor="inspect-borrower" className="mb-2 block text-sm text-foreground">
                  Borrower Address
                </label>
                <Input
                  id="inspect-borrower"
                  value={borrowerInput}
                  onChange={(event) => setBorrowerInput(event.target.value)}
                  placeholder="0x..."
                  className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
                />
              </div>
              <Button
                variant="outline"
                className="glass-button"
                onClick={() => setShowBorrowerHealth((value) => !value)}
                disabled={!inspectedBorrower}
                isLoading={showBorrowerHealth && borrowerHealthLoading}
                loadingText="Decrypting..."
              >
                {showBorrowerHealth ? (
                  <EyeOff className="h-4 w-4 transition-all duration-200 ease-out rotate-0 scale-100" />
                ) : (
                  <Eye className="h-4 w-4 transition-all duration-200 ease-out scale-100" />
                )}
                {showBorrowerHealth ? "Hide Health" : "Show Health"}
              </Button>
            </div>

            {!protocol.permit.hasPermit && (
              <div className="walnut-alert walnut-alert-warning">
                <p className="text-sm text-foreground">Enable private access to decrypt borrower health factor.</p>
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

            {borrowerHealthCard}
          </GlassPanel>

          <GlassPanel className="walnut-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="walnut-label">Active Auctions</p>
              <Button
                size="sm"
                variant="outline"
                className="glass-button"
                onClick={() => void refreshAuctionRows()}
                isLoading={auctionLoading}
                loadingText="Refreshing..."
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            {auctionLoading && auctionRows.length === 0 ? (
              <div className="space-y-2">
                <div className="h-16 animate-pulse rounded-xl border border-black/10 bg-black/5" />
                <div className="h-16 animate-pulse rounded-xl border border-black/10 bg-black/5" />
              </div>
            ) : auctionRows.length === 0 ? (
              <div className="walnut-alert">
                <p className="text-sm text-muted-foreground">
                  No active auctions yet. Open an auction from a liquidatable borrower to start bidding.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {auctionRows.map((auction) => (
                  <div key={auction.borrower} className="walnut-progress">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{shortAddress(auction.borrower)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Bids: {auction.bidCount.toString()} · {formatCountdown(auction.secondsLeft)}
                        </p>
                        {auction.pendingRequestId > 0n && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Pending request id: {auction.pendingRequestId.toString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="walnut-status-chip walnut-status-chip-ghost">
                          {auction.active ? "Open" : "Awaiting Finalize"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="glass-button"
                          onClick={() => {
                            setBorrowerInput(auction.borrower);
                            if (auction.pendingRequestId > 0n) {
                              setFinalizeRequestIdInput(auction.pendingRequestId.toString());
                            }
                          }}
                        >
                          Load
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>

        <GlassPanel className="walnut-card walnut-card-strong space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Bidder Workflow</p>
              <h2 className="mt-2 font-display text-2xl text-foreground">Auction Controls</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use real borrower state transitions: open auction, submit encrypted bids, select winner, then finalize.
              </p>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">No Log Scans</span>
          </div>

          <div>
            <label htmlFor="bid-amount" className="mb-2 block text-sm text-foreground">
              Encrypted Penalty Bid
            </label>
            <Input
              id="bid-amount"
              inputMode="numeric"
              value={bidAmountInput}
              onChange={(event) => setBidAmountInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="25"
              className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
            />
          </div>

          <div>
            <label htmlFor="finalize-request" className="mb-2 block text-sm text-foreground">
              Finalize Request Id
            </label>
            <Input
              id="finalize-request"
              inputMode="numeric"
              value={finalizeRequestIdInput}
              onChange={(event) => setFinalizeRequestIdInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={pendingFinalizeRequestId || "Pending request id"}
              className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={handleOpenAuction}
              isLoading={actionInFlight === "open-auction"}
              loadingText="Opening..."
              disabled={!inspectedBorrower || anyActionInFlight}
            >
              Open Auction
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={handleSubmitBid}
              isLoading={actionInFlight === "submit-bid" || protocol.isEncrypting}
              loadingText={protocol.isEncrypting ? "Encrypting..." : "Submitting..."}
              disabled={!inspectedBorrower || !bidAmountInput || !canSubmitBid || anyActionInFlight}
            >
              Submit Encrypted Bid
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={handleSelectWinner}
              isLoading={actionInFlight === "select-winner"}
              loadingText="Selecting..."
              disabled={!canSelectWinner || anyActionInFlight}
            >
              <Gavel className="mr-2 h-4 w-4" />
              Select Winner
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={handleFinalizeWinner}
              isLoading={actionInFlight === "finalize-winner"}
              loadingText="Finalizing..."
              disabled={!canFinalize || anyActionInFlight}
            >
              <Hourglass className="mr-2 h-4 w-4" />
              Finalize Winner
            </Button>
          </div>

          {focusedAuction ? (
            <div className="walnut-progress space-y-2">
              <p className="walnut-label">Selected Borrower Summary</p>
              <p className="text-sm text-foreground">Borrower: {shortAddress(focusedAuction.borrower)}</p>
              <p className="text-sm text-foreground">Bid count: {focusedAuction.bidCount.toString()}</p>
              <p className="text-sm text-foreground">Countdown: {formatCountdown(focusedAuction.secondsLeft)}</p>
              <p className="text-sm text-foreground">
                Pending request: {focusedAuction.pendingRequestId > 0n ? focusedAuction.pendingRequestId.toString() : "None"}
              </p>
            </div>
          ) : (
            <div className="walnut-alert">
              <p className="text-sm text-muted-foreground">
                Load an auction from the left panel or paste a borrower address to begin.
              </p>
            </div>
          )}
        </GlassPanel>
      </div>

      {protocol.status && (
        <GlassPanel className="walnut-alert border-accent/40">
          <p className="text-sm text-foreground">{protocol.status}</p>
        </GlassPanel>
      )}

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
