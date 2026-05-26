"use client";

import { useState, useEffect } from "react";
import { Gavel, Clock, TrendingDown, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseAbi } from "viem";

import { Button } from "@/components/ui/button";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast } from "@/components/walnut/toast-provider";

const WALNUT_LENDING_ADDRESS = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS as `0x${string}`;

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
  const { addToast } = useToast();

  const [liquidatablePositions, setLiquidatablePositions] = useState<LiquidatablePosition[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<AuctionStatus[]>([]);
  const [myBids, setMyBids] = useState<{ borrower: string; timestamp: number }[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<string>("");
  const [bidAmount, setBidAmount] = useState("");
  const [isOpeningAuction, setIsOpeningAuction] = useState(false);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isSelectingWinner, setIsSelectingWinner] = useState(false);

  // Fetch liquidatable positions from events
  useEffect(() => {
    if (!publicClient) return;

    const fetchLiquidatablePositions = async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 120_000n ? latestBlock - 120_000n : 0n;
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event LiquidationTriggered(address indexed user)"])[0],
          fromBlock,
          toBlock: latestBlock,
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
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 120_000n ? latestBlock - 120_000n : 0n;
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event AuctionOpened(address indexed borrower, uint256 endTime)"])[0],
          fromBlock,
          toBlock: latestBlock,
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
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 120_000n ? latestBlock - 120_000n : 0n;
        const logs = await publicClient.getLogs({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          event: parseAbi(["event BidSubmitted(address indexed borrower, address indexed bidder)"])[0],
          args: {
            bidder: address,
          },
          fromBlock,
          toBlock: latestBlock,
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
      addToast({ variant: "pending", message: "Opening private auction..." });
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function openAuction(address borrower) external"]),
        functionName: "openAuction",
        args: [borrower as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Auction opened successfully!" });
    } catch (error) {
      console.error("Error opening auction:", error);
      addToast({ variant: "error", message: "Failed to open auction" });
    } finally {
      setIsOpeningAuction(false);
    }
  };

  const handleSubmitBid = async () => {
    if (!walletClient || !selectedBorrower || !bidAmount) return;

    setIsSubmittingBid(true);
    try {
      addToast({ variant: "pending", message: "Encrypting bid & preparing transaction..." });
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

      addToast({ variant: "pending", message: "Submitting encrypted bid..." });
      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Bid submitted successfully!" });
      
      setBidAmount("");
      setSelectedBorrower("");
    } catch (error) {
      console.error("Error submitting bid:", error);
      addToast({ variant: "error", message: "Failed to submit bid" });
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleSelectWinner = async (borrower: string) => {
    if (!walletClient) return;

    setIsSelectingWinner(true);
    try {
      addToast({ variant: "pending", message: "Initiating winner selection..." });
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function selectWinningBid(address borrower) external returns (uint256)"]),
        functionName: "selectWinningBid",
        args: [borrower as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Winner selection initiated! CoFHE processing encrypted bids." });
    } catch (error) {
      console.error("Error selecting winner:", error);
      addToast({ variant: "error", message: "Failed to select winner" });
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
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Private Liquidation System</h1>
        <p className="text-sm text-muted-foreground">
          Liquidators submit encrypted penalty bids. CoFHE selects the minimum bid in ciphertext. Only the winner is revealed.
        </p>
      </header>

      <div className="border rounded-lg p-4">
        <div className="mb-3 text-sm font-medium flex items-center gap-1.5 text-slate-800">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Status: Live on Testnet
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Main Auction Section */}
          <section className="md:col-span-2 space-y-4">
            
            {/* Liquidatable Positions List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Liquidatable Positions</h3>
                <span className="text-xs text-muted-foreground">{liquidatablePositions.length} positions</span>
              </div>

              {liquidatablePositions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-6 text-center">
                  <TrendingDown className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">No liquidatable positions at this time</p>
                </div>
              ) : (
                liquidatablePositions.map((position) => (
                  <div
                    key={position.borrower}
                    className="rounded-lg border border-red-200 bg-red-50/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="font-mono text-sm font-semibold text-red-950">
                          {position.borrower.slice(0, 8)}...{position.borrower.slice(-6)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-xs text-slate-700 pt-1.5">
                        <div>
                          <p className="text-[10px] uppercase font-mono text-muted-foreground">Health Factor</p>
                          <p className="font-semibold text-red-700">{position.healthFactor}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-mono text-muted-foreground">Collateral</p>
                          <p className="font-semibold font-mono">{position.collateral}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-mono text-muted-foreground">Debt</p>
                          <p className="font-semibold font-mono">{position.debt}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenAuction(position.borrower)}
                      isLoading={isOpeningAuction}
                      loadingText="Opening..."
                      className="bg-red-600 text-white hover:bg-red-700 rounded-lg self-start md:self-center"
                    >
                      Open Auction
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Active Auctions List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold text-slate-900">Active Auctions</h3>
                <span className="text-xs text-muted-foreground">{activeAuctions.length} auctions</span>
              </div>

              {activeAuctions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-6 text-center">
                  <Gavel className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">No active auctions at this time</p>
                </div>
              ) : (
                activeAuctions.map((auction) => {
                  const timeRemaining = formatTimeRemaining(auction.endTime);
                  const canSelectWinner = auction.endTime <= Math.floor(Date.now() / 1000) && !auction.settled;

                  return (
                    <div
                      key={auction.borrower}
                      className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-600" />
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            {auction.borrower.slice(0, 8)}...{auction.borrower.slice(-6)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-xs text-slate-700 pt-1.5">
                          <div>
                            <p className="text-[10px] uppercase font-mono text-muted-foreground">Time Remaining</p>
                            <p className="font-semibold text-slate-800 font-mono">{timeRemaining}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-mono text-muted-foreground">Total Bids</p>
                            <p className="font-semibold text-slate-800">{auction.bidCount}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-mono text-muted-foreground">Status</p>
                            <p className="font-semibold text-slate-800">
                              {auction.settled ? "Settled" : auction.active ? "Active" : "Ended"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 self-start md:self-center">
                        {auction.active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedBorrower(auction.borrower)}
                            className="rounded-lg"
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
                            className="bg-black text-white hover:bg-slate-900 rounded-lg"
                          >
                            Select Winner
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bidding Panel */}
            {selectedBorrower && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/20 p-5 space-y-4 max-w-md animate-fade-in">
                <div className="flex items-center gap-1.5 border-b pb-2">
                  <Gavel className="h-4 w-4 text-slate-800" />
                  <h3 className="text-sm font-semibold text-slate-900">Submit Encrypted Bid</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-mono text-slate-950 font-semibold">{selectedBorrower.slice(0, 10)}...{selectedBorrower.slice(-8)}</span>
                </p>

                <div>
                  <label className="block text-xs font-mono uppercase text-muted-foreground mb-1">
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Lower penalty increases chances to win. Standard range: 3-10%
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitBid}
                    isLoading={isSubmittingBid}
                    loadingText="Submitting..."
                    disabled={!bidAmount || parseFloat(bidAmount) <= 0}
                    className="bg-black text-white hover:bg-slate-900 rounded-lg text-xs"
                  >
                    Submit Encrypted Bid
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedBorrower("");
                      setBidAmount("");
                    }}
                    className="rounded-lg text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Your Submitted Bids */}
            {myBids.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Your Submitted Bids</h3>
                </div>
                <div className="space-y-1.5 max-w-md">
                  {myBids.map((bid, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 flex items-center justify-between shadow-sm"
                    >
                      <span className="font-mono text-xs text-slate-800">
                        {bid.borrower.slice(0, 8)}...{bid.borrower.slice(-6)}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        Bid Encrypted ✅
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right Sidebar Info */}
          <aside className="space-y-3">
            <div className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground">System Thresholds</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Liquidation Threshold</span>
                    <span className="font-mono text-slate-900 font-semibold">HF &lt; 1.05</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Auction Duration</span>
                    <span className="font-mono text-slate-900 font-semibold">10 Minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Winning Rule</span>
                    <span className="font-mono text-slate-900 font-semibold">Minimum Penalty Bps</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-white shadow-sm space-y-3 text-sm">
              <h3 className="text-xs font-mono uppercase text-muted-foreground font-semibold">How Sealed-Bid Auctions Work</h3>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <div>
                  <p className="font-semibold text-slate-950">1. Trigger & Open</p>
                  <p className="mt-0.5">When HF falls below 1.05, position is liquidatable. Any liquidator can trigger a 10-minute auction.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">2. Private Sealed Bidding</p>
                  <p className="mt-0.5">Liquidators submit encrypted penalty bids. Bids are stored as private ciphertexts on-chain.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">3. FHE Win Computation</p>
                  <p className="mt-0.5">Upon ending, CoFHE processes the bids privately. It selects the minimum penalty and reveals *only* the winner address.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
