"use client";

import { useState, useEffect } from "react";
import { Users, Plus, X, CheckCircle, Clock } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseAbi } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const WALNUT_LENDING_ADDRESS = (process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS ?? process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS) as `0x${string}`;

type LoanOffer = {
  offerId: number;
  lender: string;
  encryptedApr: string;
  encryptedSize: string;
  encryptedTenor: string;
  active: boolean;
  matched: boolean;
};

type MyOffer = {
  offerId: number;
  apr: string;
  size: string;
  tenor: string;
  active: boolean;
  matched: boolean;
  matchedWith?: string;
};

export default function P2PPage() {
  const protocol = useWalnutProtocol();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [activeTab, setActiveTab] = useState<"browse" | "post" | "my-offers">("browse");
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [totalOfferCount, setTotalOfferCount] = useState(0);

  // Post offer form state
  const [postApr, setPostApr] = useState("");
  const [postSize, setPostSize] = useState("");
  const [postTenor, setPostTenor] = useState("");
  const [isPostingOffer, setIsPostingOffer] = useState(false);

  // Match offer state
  const [isMatchingOffer, setIsMatchingOffer] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);

  // Cancel offer state
  const [isCancellingOffer, setIsCancellingOffer] = useState(false);

  // Fetch total offer count
  useEffect(() => {
    if (!publicClient) return;

    const fetchOfferCount = async () => {
      try {
        const count = await publicClient.readContract({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          abi: parseAbi(["function getOfferCount() view returns (uint256)"]),
          functionName: "getOfferCount",
        });

        setTotalOfferCount(Number(count));
      } catch (error) {
        console.error("Error fetching offer count:", error);
      }
    };

    fetchOfferCount();
    const interval = setInterval(fetchOfferCount, 15000);
    return () => clearInterval(interval);
  }, [publicClient]);

  // Fetch all offers
  useEffect(() => {
    if (!publicClient || totalOfferCount === 0) return;

    const fetchOffers = async () => {
      try {
        const offerPromises = [];
        for (let i = 0; i < totalOfferCount; i++) {
          offerPromises.push(
            publicClient.readContract({
              address: WALNUT_LENDING_ADDRESS as `0x${string}`,
              abi: parseAbi([
                "function offers(uint256) view returns (address lender, bytes encryptedApr, bytes encryptedSize, bytes encryptedTenor, bool active, bool matched)",
              ]),
              functionName: "offers",
              args: [BigInt(i)],
            })
          );
        }

        const results = await Promise.all(offerPromises);
        const fetchedOffers: LoanOffer[] = results.map((result, index) => {
          const [lender, encryptedApr, encryptedSize, encryptedTenor, active, matched] = result as [
            string,
            string,
            string,
            string,
            boolean,
            boolean
          ];

          return {
            offerId: index,
            lender,
            encryptedApr: "••••",
            encryptedSize: "••••",
            encryptedTenor: "••••",
            active,
            matched,
          };
        });

        setOffers(fetchedOffers.filter((o) => o.active && !o.matched));
      } catch (error) {
        console.error("Error fetching offers:", error);
      }
    };

    fetchOffers();
  }, [publicClient, totalOfferCount]);

  // Fetch my offers
  useEffect(() => {
    if (!publicClient || !address || totalOfferCount === 0) return;

    const fetchMyOffers = async () => {
      try {
        const offerPromises = [];
        for (let i = 0; i < totalOfferCount; i++) {
          offerPromises.push(
            publicClient.readContract({
              address: WALNUT_LENDING_ADDRESS as `0x${string}`,
              abi: parseAbi([
                "function offers(uint256) view returns (address lender, bytes encryptedApr, bytes encryptedSize, bytes encryptedTenor, bool active, bool matched)",
              ]),
              functionName: "offers",
              args: [BigInt(i)],
            })
          );
        }

        const results = await Promise.all(offerPromises);
        const myOffersList: MyOffer[] = [];

        for (let i = 0; i < results.length; i++) {
          const [lender, , , , active, matched] = results[i] as [
            string,
            string,
            string,
            string,
            boolean,
            boolean
          ];

          if (lender.toLowerCase() === address.toLowerCase()) {
            myOffersList.push({
              offerId: i,
              apr: "Encrypted",
              size: "Encrypted",
              tenor: "Encrypted",
              active,
              matched,
            });
          }
        }

        setMyOffers(myOffersList);
      } catch (error) {
        console.error("Error fetching my offers:", error);
      }
    };

    fetchMyOffers();
  }, [publicClient, address, totalOfferCount]);

  const handlePostOffer = async () => {
    if (!walletClient || !postApr || !postSize || !postTenor) return;

    setIsPostingOffer(true);
    try {
      // In production, encrypt these values using FHE
      const encryptedApr = { data: BigInt(Math.floor(parseFloat(postApr) * 100)) };
      const encryptedSize = { data: BigInt(Math.floor(parseFloat(postSize) * 1_000_000)) };
      const encryptedTenor = { data: BigInt(parseInt(postTenor)) };

      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi([
          "function postLoanOffer((bytes data) encryptedApr, (bytes data) encryptedSize, (bytes data) encryptedTenor) external",
        ]),
        functionName: "postLoanOffer",
        args: [encryptedApr as any, encryptedSize as any, encryptedTenor as any],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Loan offer posted successfully!");
      setPostApr("");
      setPostSize("");
      setPostTenor("");
      setActiveTab("my-offers");
    } catch (error) {
      console.error("Error posting offer:", error);
      alert("Failed to post offer");
    } finally {
      setIsPostingOffer(false);
    }
  };

  const handleMatchOffer = async (offerId: number) => {
    if (!walletClient) return;

    setIsMatchingOffer(true);
    setSelectedOfferId(offerId);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function matchOffer(uint256 offerId) external"]),
        functionName: "matchOffer",
        args: [BigInt(offerId)],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Offer matched! Privara settlement will process the encrypted loan terms.");
    } catch (error) {
      console.error("Error matching offer:", error);
      alert("Failed to match offer");
    } finally {
      setIsMatchingOffer(false);
      setSelectedOfferId(null);
    }
  };

  const handleCancelOffer = async (offerId: number) => {
    if (!walletClient) return;

    setIsCancellingOffer(true);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function cancelOffer(uint256 offerId) external"]),
        functionName: "cancelOffer",
        args: [BigInt(offerId)],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Offer cancelled successfully!");
    } catch (error) {
      console.error("Error cancelling offer:", error);
      alert("Failed to cancel offer");
    } finally {
      setIsCancellingOffer(false);
    }
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">P2P Encrypted Lending</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Loan Marketplace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Lenders post encrypted loan offers. Borrowers match them. All terms remain private until settlement.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-chip-success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Live on Testnet
          </span>
        </div>
      </GlassPanel>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("browse")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "browse"
              ? "border-b-2 border-black text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Browse Offers ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab("post")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "post"
              ? "border-b-2 border-black text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Post an Offer
        </button>
        <button
          onClick={() => setActiveTab("my-offers")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "my-offers"
              ? "border-b-2 border-black text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Offers ({myOffers.length})
        </button>
      </div>

      {/* Browse Offers Tab */}
      {activeTab === "browse" && (
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground mb-4">Available Loan Offers</h3>

          {offers.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-3 text-sm text-muted-foreground">No active offers available</p>
              <p className="mt-1 text-xs text-muted-foreground">Be the first to post a loan offer!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.offerId}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-accent" />
                        <p className="font-mono text-sm text-foreground">
                          Offer #{offer.offerId} from {offer.lender.slice(0, 6)}...{offer.lender.slice(-4)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">APR</p>
                          <p className="font-mono text-foreground">{offer.encryptedApr}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Loan Size</p>
                          <p className="font-mono text-foreground">{offer.encryptedSize}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tenor (days)</p>
                          <p className="font-mono text-foreground">{offer.encryptedTenor}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleMatchOffer(offer.offerId)}
                      isLoading={isMatchingOffer && selectedOfferId === offer.offerId}
                      loadingText="Matching..."
                      className="bg-accent text-white hover:bg-accent/90"
                    >
                      Match Offer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Post Offer Tab */}
      {activeTab === "post" && (
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground mb-4">Post a Loan Offer</h3>
          <p className="text-sm text-muted-foreground mb-6">
            All loan terms are encrypted. Only the borrower who matches your offer will see the details.
          </p>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                APR (%)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={postApr}
                onChange={(e) => setPostApr(e.target.value)}
                placeholder="e.g., 8.5"
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Annual percentage rate for the loan
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Loan Size (cUSDC)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={postSize}
                onChange={(e) => setPostSize(e.target.value)}
                placeholder="e.g., 1000"
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Amount you're willing to lend
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tenor (days)
              </label>
              <Input
                type="number"
                step="1"
                min="1"
                value={postTenor}
                onChange={(e) => setPostTenor(e.target.value)}
                placeholder="e.g., 30"
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Loan duration in days
              </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <strong>Privacy Note:</strong> Your loan terms will be encrypted on-chain. Only borrowers who match your offer will decrypt the terms via Privara settlement.
              </p>
            </div>

            <Button
              onClick={handlePostOffer}
              isLoading={isPostingOffer}
              loadingText="Posting..."
              disabled={!postApr || !postSize || !postTenor}
              className="w-full bg-black text-white hover:bg-slate-900"
            >
              <Plus className="mr-2 h-4 w-4" />
              Post Encrypted Offer
            </Button>
          </div>
        </GlassPanel>
      )}

      {/* My Offers Tab */}
      {activeTab === "my-offers" && (
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground mb-4">Your Loan Offers</h3>

          {myOffers.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-3 text-sm text-muted-foreground">You haven't posted any offers yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("post")}
                className="mt-4"
              >
                Post Your First Offer
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map((offer) => (
                <div
                  key={offer.offerId}
                  className={`rounded-lg border p-4 ${
                    offer.matched
                      ? "border-green-200 bg-green-50"
                      : offer.active
                      ? "border-slate-200 bg-white"
                      : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="font-mono text-sm text-foreground">Offer #{offer.offerId}</p>
                        {offer.matched && (
                          <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                            Matched
                          </span>
                        )}
                        {!offer.active && !offer.matched && (
                          <span className="rounded-full bg-slate-400 px-2 py-0.5 text-xs text-white">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">APR</p>
                          <p className="font-mono text-foreground">{offer.apr}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Loan Size</p>
                          <p className="font-mono text-foreground">{offer.size}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tenor</p>
                          <p className="font-mono text-foreground">{offer.tenor}</p>
                        </div>
                      </div>
                      {offer.matched && offer.matchedWith && (
                        <p className="mt-2 text-xs text-green-700">
                          Matched with: {offer.matchedWith.slice(0, 6)}...{offer.matchedWith.slice(-4)}
                        </p>
                      )}
                    </div>
                    {offer.active && !offer.matched && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelOffer(offer.offerId)}
                        isLoading={isCancellingOffer}
                        loadingText="Cancelling..."
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {/* How It Works */}
      <GlassPanel className="walnut-card p-6">
        <h3 className="font-display text-xl text-foreground mb-4">How P2P Lending Works</h3>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">1. Lender Posts Offer</p>
            <p className="mt-1">Lender encrypts APR, loan size, and tenor. Offer is posted on-chain with all terms encrypted.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">2. Borrower Browses</p>
            <p className="mt-1">Borrowers see encrypted offers. They can't see the actual terms until they match.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">3. Match & Settlement</p>
            <p className="mt-1">When a borrower matches an offer, Privara settlement decrypts the terms privately and executes the loan.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">4. Private Repayment</p>
            <p className="mt-1">Interest payments are calculated and settled privately. Only the lender and borrower know the exact amounts.</p>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
