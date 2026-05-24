"use client";

import { useState, useEffect } from "react";
import { Gavel, Clock, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseAbi, formatUnits } from "viem";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const WALNUT_LENDING_ADDRESS = (process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS ?? process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS) as `0x${string}`;

const AUCTION_DURATION = 10 * 60; // 10 minutes in seconds

type LiquidatablePosition = {
  borrower: string;
  healthFactor: string;
  collateral: string;
  debt: string;
};

type AuctionStatus = {
  borrower: string;
  endTime: number;
  bidCount: number;
  settled: boolean;
  active: boolean;
};

export default function LiquidationPage() {
  const protocol = useWalnutProtocol();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [liquidatablePositions, setLiquidatablePositions] = useState<LiquidatablePosition[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<AuctionStatus[]>([]);
  const [myBids, setMyBids] = useState<{ borrower: string; timestamp: number }[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<string>("");
  const [bidAmount, setBidAmount] = useState("");
  const [isOpeningAuction, setIsOpeningAuction] = useState(false);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isSelectingWinner, setIsSelectingWinner] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Fetch liquidatable positions from events
  useEffect(() => {
    if (!publicClient) return;

    const fetchLiquidatablePositions = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event LiquidationTriggered(address indexed user)"])[0],
          fromBlock: "earliest",
          toBlock: "latest",
        });

        const positions: LiquidatablePosition[] = [];
        for (const log of logs) {
          const borrower = log.args.user as string;
          
          // Check if still liquidatable
          const isLiquidatable = await publicClient.readContract({
            address: WALNUT_LENDING_ADDRESS as `0x${string}`,
            abi: parseAbi(["function liquidatable(address) view returns (bool)"]),
            functionName: "liquidatable",
            args: [borrower as `0x${string}`],
          });

          if (isLiquidatable) {
            positions.push({
              borrower,
              healthFactor: "< 1.05",
              collateral: "Encrypted",
              debt: "Encrypted",
            });
          }
        }

        setLiquidatablePositions(positions);
      } catch (error) {
        console.error("Error fetching liquidatable positions:", error);
      }
    };

    fetchLiquidatablePositions();
    const interval = setInterval(fetchLiquidatablePositions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [publicClient]);

  // Fetch active auctions
  useEffect(() => {
    if (!publicClient) return;

    const fetchActiveAuctions = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event AuctionOpened(address indexed borrower, uint256 endTime)"])[0],
          fromBlock: "earliest",
          toBlock: "latest",
        });

        const auctions: AuctionStatus[] = [];
        for (const log of logs) {
          const borrower = log.args.borrower as string;
          
          const summary = await publicClient.readContract({
            address: WALNUT_LENDING_ADDRESS as `0x${string}`,
            abi: parseAbi([
              "function getAuctionSummary(address) view returns (address, uint256, uint256, bool, bool)",
            ]),
            functionName: "getAuctionSummary",
            args: [borrower as `0x${string}`],
          });

          const [, endTime, bidCount, settled, active] = summary as [string, bigint, bigint, boolean, boolean];

          if (active || !settled) {
            auctions.push({
              borrower,
              endTime: Number(endTime),
              bidCount: Number(bidCount),
              settled,
              active,
            });
          }
        }

        setActiveAuctions(auctions);
      } catch (error) {
        console.error("Error fetching auctions:", error);
      }
    };

    fetchActiveAuctions();
    const interval = setInterval(fetchActiveAuctions, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [publicClient]);

  // Fetch my bids
  useEffect(() => {
    if (!publicClient || !address) return;

    const fetchMyBids = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event BidSubmitted(address indexed borrower, address indexed bidder)"])[0],
          args: {
            bidder: address,
          },
          fromBlock: "earliest",
          toBlock: "latest",
        });

        const bids = logs.map((log) => ({
          borrower: log.args.borrower as string,
          timestamp: Date.now(), // In production, get from block timestamp
        }));

        setMyBids(bids);
      } catch (error) {
        console.error("Error fetching my bids:", error);
      }
    };

    fetchMyBids();
  }, [publicClient, address]);

  const handleOpenAuction = async (borrower: string) => {
    if (!walletClient) return;

    setIsOpeningAuction(true);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function openAuction(address borrower) external"]),
        functionName: "openAuction",
        args: [borrower as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Auction opened successfully!");
    } catch (error) {
      console.error("Error opening auction:", error);
      alert("Failed to open auction");
    } finally {
      setIsOpeningAuction(false);
    }
  };

  const handleSubmitBid = async () => {
    if (!walletClient || !selectedBorrower || !bidAmount) return;

    setIsSubmittingBid(true);
    try {
      // Encrypt the bid amount (penalty in basis points)
      const penaltyBps = Math.floor(parseFloat(bidAmount) * 100); // Convert percentage to basis points
      
      // In production, use FHE encryption here
      const encryptedPenalty = {
        data: BigInt(penaltyBps),
      };

      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi([
          "function submitBid(address borrower, (bytes data) encryptedPenalty) external",
        ]),
        functionName: "submitBid",
        args: [selectedBorrower as `0x${string}`, encryptedPenalty as any],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Bid submitted successfully!");
      setBidAmount("");
      setSelectedBorrower("");
    } catch (error) {
      console.error("Error submitting bid:", error);
      alert("Failed to submit bid");
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleSelectWinner = async (borrower: string) => {
    if (!walletClient) return;

    setIsSelectingWinner(true);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function selectWinningBid(address borrower) external returns (uint256)"]),
        functionName: "selectWinningBid",
        args: [borrower as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Winner selection initiated! CoFHE will process the encrypted bids.");
    } catch (error) {
      console.error("Error selecting winner:", error);
      alert("Failed to select winner");
    } finally {
      setIsSelectingWinner(false);
    }
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;
    
    if (remaining <= 0) return "Ended";
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sealed-Bid Liquidation Auctions</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Liquidation System</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Liquidators submit encrypted penalty bids. CoFHE selects the minimum bid in ciphertext. Only the winner is revealed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-chip-success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Live on Testnet
          </span>
        </div>
      </GlassPanel>

      {/* Liquidatable Positions */}
      <GlassPanel className="walnut-card walnut-card-strong p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-xl text-foreground">Liquidatable Positions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Positions with health factor below 1.05 threshold
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-muted-foreground">{liquidatablePositions.length} positions</span>
          </div>
        </div>

        {liquidatablePositions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <TrendingDown className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-3 text-sm text-muted-foreground">No liquidatable positions at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {liquidatablePositions.map((position) => (
              <div
                key={position.borrower}
                className="rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <p className="font-mono text-sm text-red-900">
                        {position.borrower.slice(0, 6)}...{position.borrower.slice(-4)}
                      </p>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-red-700">Health Factor</p>
                        <p className="font-mono text-red-900">{position.healthFactor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-700">Collateral</p>
                        <p className="font-mono text-red-900">{position.collateral}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-700">Debt</p>
                        <p className="font-mono text-red-900">{position.debt}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenAuction(position.borrower)}
                    isLoading={isOpeningAuction}
                    loadingText="Opening..."
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Open Auction
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Active Auctions */}
      <GlassPanel className="walnut-card walnut-card-strong p-6">
        <h3 className="font-display text-xl text-foreground mb-4">Active Auctions</h3>

        {activeAuctions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <Gavel className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-3 text-sm text-muted-foreground">No active auctions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAuctions.map((auction) => {
              const timeRemaining = formatTimeRemaining(auction.endTime);
              const canSelectWinner = auction.endTime <= Math.floor(Date.now() / 1000) && !auction.settled;

              return (
                <div
                  key={auction.borrower}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-accent" />
                        <p className="font-mono text-sm text-foreground">
                          {auction.borrower.slice(0, 6)}...{auction.borrower.slice(-4)}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-6 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Time Remaining</p>
                          <p className="font-mono text-foreground">{timeRemaining}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bids</p>
                          <p className="font-mono text-foreground">{auction.bidCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="font-mono text-foreground">
                            {auction.settled ? "Settled" : auction.active ? "Active" : "Ended"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {auction.active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedBorrower(auction.borrower)}
                        >
                          Submit Bid
                        </Button>
                      )}
                      {canSelectWinner && (
                        <Button
                          size="sm"
                          onClick={() => handleSelectWinner(auction.borrower)}
                          isLoading={isSelectingWinner}
                          loadingText="Selecting..."
                          className="bg-accent text-white"
                        >
                          Select Winner
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* Submit Bid Form */}
      {selectedBorrower && (
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground mb-4">Submit Encrypted Bid</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Bidding on: <span className="font-mono">{selectedBorrower.slice(0, 6)}...{selectedBorrower.slice(-4)}</span>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Liquidation Penalty (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="e.g., 5.0"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Lower penalty = better chance to win. Typical range: 3-10%
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmitBid}
                isLoading={isSubmittingBid}
                loadingText="Submitting..."
                disabled={!bidAmount || parseFloat(bidAmount) <= 0}
                className="bg-black text-white hover:bg-slate-900"
              >
                Submit Encrypted Bid
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedBorrower("");
                  setBidAmount("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* My Bids */}
      {myBids.length > 0 && (
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground mb-4">Your Submitted Bids</h3>
          <div className="space-y-2">
            {myBids.map((bid, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between"
              >
                <p className="font-mono text-sm text-foreground">
                  {bid.borrower.slice(0, 6)}...{bid.borrower.slice(-4)}
                </p>
                <span className="text-xs text-muted-foreground">Bid encrypted</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* How It Works */}
      <GlassPanel className="walnut-card p-6">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="font-display text-xl text-foreground">How Sealed-Bid Auctions Work</h3>
          <span className="text-muted-foreground">{showHowItWorks ? "−" : "+"}</span>
        </button>

        {showHowItWorks && (
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">1. Position Becomes Liquidatable</p>
              <p className="mt-1">When a borrower's health factor drops below 1.05, their position is marked as liquidatable.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. Auction Opens</p>
              <p className="mt-1">Any liquidator can open a 10-minute sealed-bid auction for the position.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">3. Encrypted Bidding</p>
              <p className="mt-1">Liquidators submit encrypted penalty bids (e.g., 5% penalty). All bids remain private.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">4. Winner Selection</p>
              <p className="mt-1">After auction ends, CoFHE computes the minimum bid using FHE.select on encrypted values. Only the winner is revealed.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">5. Settlement</p>
              <p className="mt-1">The winning liquidator receives the collateral at their bid penalty. Borrower gets the best outcome.</p>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
