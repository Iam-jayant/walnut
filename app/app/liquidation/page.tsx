"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Gavel, 
  Clock, 
  ShieldCheck, 
  HelpCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Coins, 
  ArrowRight,
  RefreshCw,
  Zap
} from "lucide-react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { useCofheEncrypt } from "@cofhe/react";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { parseUnits, formatUnits, isAddress, parseAbiItem, decodeEventLog } from "viem";
import { walnutContractAddress, walnutLendingAbi, getGasFeeOverrides } from "@/lib/walnut-contract";
import { useToast } from "@/components/walnut/toast-provider";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { useCofheClient } from "@cofhe/react";

const liquidationCheckEvent = parseAbiItem("event LiquidationCheckRequested(address indexed borrower, uint256 requestId)");
const winnerSelectionEvent = parseAbiItem("event WinnerSelectionRequested(address indexed borrower, uint256 requestId)");

function sanitizeError(err: any, fallback: string): string {
  const raw = err?.shortMessage || err?.message || "";
  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) return "Request cancelled in your wallet.";
  if (lower.includes("insufficient funds")) return "Not enough gas in your wallet for this transaction.";
  if (lower.includes("stale price")) return "Price oracle data is temporarily outdated. Please try again shortly.";
  if (lower.includes("nonce too")) return "A previous transaction is still pending. Please wait and retry.";
  if (process.env.NODE_ENV === "development") return raw.length > 120 ? raw.slice(0, 117) + "..." : (raw || fallback);
  return fallback;
}

enum AuctionState {
  IDLE = 0,
  OPEN = 1,
  SELECTION_PENDING = 2,
  SETTLED = 3,
}

const AUCTION_STATE_LABELS: Record<AuctionState, { label: string; color: string }> = {
  [AuctionState.IDLE]: { label: "No Active Auction", color: "bg-slate-100 text-slate-700 border-slate-200" },
  [AuctionState.OPEN]: { label: "Bidding Open", color: "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse" },
  [AuctionState.SELECTION_PENDING]: { label: "Winner Selection Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  [AuctionState.SETTLED]: { label: "Liquidation Settled", color: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default function LiquidationPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { permitHash } = useWalnutPermit();
  const cofheClient = useCofheClient();

  const [targetBorrower, setTargetBorrower] = useState<string>("");
  const [bidAmount, setBidAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"auctions" | "how-it-works">("auctions");

  // Read auction state for target borrower
  const { data: rawAuctionData, refetch: refetchAuction } = useReadContract({
    address: walnutContractAddress,
    abi: walnutLendingAbi,
    functionName: "liquidations",
    args: isAddress(targetBorrower) ? [targetBorrower as `0x${string}`] : undefined,
    query: {
      enabled: isAddress(targetBorrower),
      refetchInterval: 10_000,
    },
  });

  const auctionData = rawAuctionData ? {
    startTime: Number((rawAuctionData as any)[0] || 0),
    biddersCount: Number((rawAuctionData as any)[1] || 0),
    state: Number((rawAuctionData as any)[2] || 0) as AuctionState,
    winner: (rawAuctionData as any)[3] as string,
  } : null;

  // FHE Encryption hook for bids
  const encryptor = useCofheEncrypt();

  // Calculate time remaining for open auction (10 min duration = 600s)
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  useEffect(() => {
    if (!auctionData || auctionData.state !== AuctionState.OPEN || auctionData.startTime === 0) {
      setTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor(Date.now() / 1000) - auctionData.startTime;
      const remaining = Math.max(0, 600 - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [auctionData]);

  // Sync Relay Helper matching use-walnut-protocol.ts
  const doSyncDecrypt = async (txHash: `0x${string}`, isWinnerSelection: boolean) => {
    try {
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      const eventAbi = isWinnerSelection ? winnerSelectionEvent : liquidationCheckEvent;
      const syncFunction = isWinnerSelection ? "syncWinnerSelection" : "syncLiquidationCheck";
      
      let requestId: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === (isWinnerSelection ? "WinnerSelectionRequested" : "LiquidationCheckRequested")) {
            requestId = (decoded.args as any).requestId.toString();
            break;
          }
        } catch (e) {}
      }

      if (!requestId) {
        throw new Error("Could not find Request ID in transaction logs.");
      }

      let decryptResult: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const builder = cofheClient
            .decryptForTx(requestId)
            .setChainId(Number(process.env.NEXT_PUBLIC_CHAIN_ID || 421614))
            .setAccount(address!);
          
          const withPermit = permitHash ? builder.withPermit(permitHash) : builder.withPermit();
          decryptResult = await withPermit.execute();
          break;
        } catch (err: any) {
          const msg = err?.message?.toLowerCase() || String(err).toLowerCase();
          const isTransient = msg.includes("404") || msg.includes("not found") || msg.includes("pending") || msg.includes("timeout") || msg.includes("fetch");
          if (!isTransient) throw err;
          if (attempt < 7) {
            await new Promise(r => setTimeout(r, 3000 * Math.pow(1.5, attempt)));
          }
        }
      }

      if (!decryptResult) throw new Error("CoFHE decrypt timed out.");

      const res = await fetch("/api/walnut/sync-decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncFunction,
          requestId,
          result: decryptResult.decryptedValue.toString(),
          signature: decryptResult.signature,
        })
      });
      
      const resData = await res.json();
      if (!res.ok || !resData.ok) {
        throw new Error(resData.message || "Failed to sync decrypt result.");
      }
      return true;
    } catch (err: any) {
      console.error("Sync error:", err);
      throw err;
    }
  };

  // Handler: Request Liquidation Check
  const handleTriggerCheck = async () => {
    if (!isAddress(targetBorrower)) {
      addToast({ message: "Please enter a valid EVM borrower address.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "requestLiquidationCheck",
        args: [targetBorrower as `0x${string}`],
        ...feeOverrides,
      });

      addToast({ 
        message: `Liquidation Check Requested: ${hash.slice(0, 10)}... Fetching FHE calculation & synchronizing on-chain...`,
        variant: "pending" 
      });
      
      try {
        await doSyncDecrypt(hash, false);
        addToast({ message: "Sync successful! Auction is now OPEN.", variant: "success" });
      } catch (syncErr: any) {
        addToast({ message: syncErr.message || "Sync failed. Try again.", variant: "error" });
      }
      
      await refetchAuction();
    } catch (err: any) {
      addToast({ message: sanitizeError(err, "Failed to trigger liquidation check."), variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Submit Sealed Bid
  const handleSubmitBid = async () => {
    if (!isAddress(targetBorrower) || !address) {
      addToast({ message: "Please specify a valid borrower address and connect wallet.", variant: "error" });
      return;
    }

    const numBid = parseFloat(bidAmount);
    if (isNaN(numBid) || numBid <= 0) {
      addToast({ message: "Enter a valid bid amount in cUSDC.", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedBid = parseUnits(bidAmount, 6);
      addToast({ message: "Generating FHE ciphertext for confidential submission...", variant: "pending" });

      const [encBid] = await encryptor.encryptInputsAsync({
        items: [Encryptable.uint128(parsedBid)],
        account: address,
        chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 421614),
      });

      const feeOverrides = await getGasFeeOverrides(publicClient);

      const hash = await writeContractAsync({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "submitLiquidationBid",
        args: [targetBorrower as `0x${string}`, encBid],
        ...feeOverrides,
      });

      addToast({ message: `Sealed Bid Submitted: ${bidAmount} cUSDC encrypted and placed on-chain. Tx: ${hash.slice(0, 10)}...`, variant: "success" });
      setBidAmount("");
      await refetchAuction();
    } catch (err: any) {
      addToast({ message: sanitizeError(err, "Failed to submit encrypted bid."), variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Resolve Winner Selection
  const handleSelectWinner = async () => {
    if (!isAddress(targetBorrower)) return;

    setIsSubmitting(true);
    try {
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "selectWinningBid",
        args: [targetBorrower as `0x${string}`],
        ...feeOverrides,
      });

      addToast({ message: `Selection Requested: CoFHE computing maximum bid... Synchronizing result on-chain...`, variant: "pending" });
      
      try {
        await doSyncDecrypt(hash, true);
        addToast({ message: "Sync successful! Winner selected.", variant: "success" });
      } catch (syncErr: any) {
        addToast({ message: syncErr.message || "Winner Sync failed.", variant: "error" });
      }
      
      await refetchAuction();
    } catch (err: any) {
      addToast({ message: sanitizeError(err, "Failed to initiate winner selection."), variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Settle Liquidation
  const handleSettleLiquidation = async () => {
    if (!isAddress(targetBorrower)) return;

    setIsSubmitting(true);
    try {
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: walnutContractAddress,
        abi: walnutLendingAbi,
        functionName: "settleLiquidation",
        args: [targetBorrower as `0x${string}`],
        ...feeOverrides,
      });

      addToast({ message: `Liquidation Settled: Collateral transferred to winner & debt cleared. Tx: ${hash.slice(0, 10)}...`, variant: "success" });
      await refetchAuction();
    } catch (err: any) {
      addToast({ message: sanitizeError(err, "Failed to settle liquidation."), variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto min-h-screen text-slate-900">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Gavel className="h-6 w-6 text-slate-800" />
            Sealed-Bid Liquidation Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            MEV-resistant confidential auctions using Fhenix Fully Homomorphic Encryption (FHE).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("auctions")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "auctions"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Live Auctions
          </button>
          <button
            onClick={() => setActiveTab("how-it-works")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "how-it-works"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Mechanism Architecture
          </button>
        </div>
      </header>

      {activeTab === "auctions" ? (
        <div className="space-y-6">
          {/* Target Borrower Lookup & Trigger Card */}
          <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-500" />
                Target Borrower Position Lookup
              </h2>
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                Liquidation LTV Threshold: 80%
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Enter Borrower Address (0x...)"
                  value={targetBorrower}
                  onChange={(e) => setTargetBorrower(e.target.value.trim())}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
              </div>

              <button
                onClick={handleTriggerCheck}
                disabled={isSubmitting || !isAddress(targetBorrower)}
                className="w-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 text-amber-400" />
                )}
                Check Eligibility & Trigger
              </button>
            </div>
          </div>

          {/* Auction State Card */}
          {isAddress(targetBorrower) && auctionData && (
            <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
                    Target Borrower State
                  </span>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                    {targetBorrower}
                  </p>
                </div>

                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${AUCTION_STATE_LABELS[auctionData.state].color}`}>
                  {AUCTION_STATE_LABELS[auctionData.state].label}
                </div>
              </div>

              {/* IDLE State */}
              {auctionData.state === AuctionState.IDLE && (
                <div className="py-6 text-center space-y-3">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
                  <h3 className="text-base font-semibold text-slate-900">No Open Auction for this Position</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    If this position's Health Factor drops below 1.0 (LTV &gt; 80%), click "Check Eligibility &amp; Trigger" above to initiate a sealed-bid auction.
                  </p>
                </div>
              )}

              {/* OPEN State: Sealed Bidding */}
              {auctionData.state === AuctionState.OPEN && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs text-slate-400 font-medium">Bidding Window Remaining</span>
                      <p className="text-lg font-bold font-mono text-emerald-600 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-4 w-4 animate-spin text-emerald-500" />
                        {formatSeconds(timeRemaining)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium">Total Bids Placed</span>
                      <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                        {auctionData.biddersCount} / 10
                      </p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-xs text-slate-400 font-medium">Privacy Status</span>
                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1 mt-1.5">
                        <Lock className="h-3.5 w-3.5 text-slate-500" /> All Bids Encrypted (FHE)
                      </p>
                    </div>
                  </div>

                  {/* Submit Sealed Bid Box */}
                  <div className="p-5 border border-slate-200 rounded-xl bg-slate-900 text-white space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Coins className="h-4 w-4 text-emerald-400" />
                      Submit Encrypted Sealed Bid (cUSDC)
                    </h3>
                    <p className="text-xs text-slate-300 leading-normal">
                      Your bid amount is encrypted locally via Fhenix SDK prior to submission. The contract compares bids in ciphertext without ever decrypting your valuation.
                    </p>

                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="Bid Amount in cUSDC (e.g. 500)"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition-all"
                        />
                        <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">
                          cUSDC
                        </span>
                      </div>

                      <button
                        onClick={handleSubmitBid}
                        disabled={isSubmitting || !bidAmount}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl px-6 py-2.5 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Encrypt &amp; Submit Bid
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SELECTION_PENDING State */}
              {auctionData.state === AuctionState.SELECTION_PENDING && (
                <div className="p-6 border border-amber-200 rounded-xl bg-amber-50/50 space-y-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-1">
                    <Clock className="h-6 w-6 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">10-Minute Bidding Period Closed</h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    The bidding window has elapsed. Anyone can now trigger the FHE Winner Selection phase to compute the highest bid homomorphically.
                  </p>

                  <button
                    onClick={handleSelectWinner}
                    disabled={isSubmitting}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl px-6 py-2.5 flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                    Compute FHE Winner Selection
                  </button>
                </div>
              )}

              {/* SETTLED State */}
              {auctionData.state === AuctionState.SETTLED && (
                <div className="p-6 border border-blue-200 rounded-xl bg-blue-50/50 space-y-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-blue-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">Winner Selected</h3>
                  <p className="text-xs font-mono text-slate-600">
                    Winning Liquidator: <span className="font-bold text-slate-900">{auctionData.winner}</span>
                  </p>

                  <button
                    onClick={handleSettleLiquidation}
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl px-6 py-2.5 flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Finalize &amp; Settle Liquidation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Architecture Tab */
        <div className="border border-slate-200 rounded-2xl bg-white p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-slate-700" />
            Sealed-Bid Liquidation State Machine
          </h2>

          <div className="grid md:grid-cols-4 gap-4 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <span className="font-mono font-bold text-slate-400">STATE 0</span>
              <h3 className="font-bold text-slate-900 text-sm">1. Eligibility Check</h3>
              <p className="text-slate-600 leading-normal">
                `requestLiquidationCheck()` verifies if debt * 10000 &gt;= collateral * 8000 in ciphertext via CoFHE oracle.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <span className="font-mono font-bold text-slate-400">STATE 1</span>
              <h3 className="font-bold text-slate-900 text-sm">2. Sealed Bidding</h3>
              <p className="text-slate-600 leading-normal">
                10-minute window opens. Liquidators submit `submitLiquidationBid()` with encrypted cUSDC token burns.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <span className="font-mono font-bold text-slate-400">STATE 2</span>
              <h3 className="font-bold text-slate-900 text-sm">3. FHE Winner Selection</h3>
              <p className="text-slate-600 leading-normal">
                `selectWinningBid()` loops over bids in ciphertext using `FHE.gt()` to identify winner index without decrypting individual bids.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
              <span className="font-mono font-bold text-slate-400">STATE 3</span>
              <h3 className="font-bold text-slate-900 text-sm">4. Settlement</h3>
              <p className="text-slate-600 leading-normal">
                `settleLiquidation()` transfers 100% collateral to winner, clears borrower debt up to bid size, and refunds losing bidders.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
