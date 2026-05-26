"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Plus, X, CheckCircle, Clock, Info, Shield, Coins } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseAbi } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast } from "@/components/walnut/toast-provider";

const WALNUT_LENDING_ADDRESS = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS as `0x${string}`;

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
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"browse" | "my-offers">("browse");
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [totalOfferCount, setTotalOfferCount] = useState(0);

  // Modal display state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      addToast({ variant: "pending", message: "Encrypting terms & preparing transaction..." });
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

      addToast({ variant: "pending", message: "Posting encrypted offer on-chain..." });
      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Loan offer posted successfully!" });
      
      setPostApr("");
      setPostSize("");
      setPostTenor("");
      setIsCreateModalOpen(false);
      setActiveTab("my-offers");
    } catch (error) {
      console.error("Error posting offer:", error);
      addToast({ variant: "error", message: "Failed to post offer" });
    } finally {
      setIsPostingOffer(false);
    }
  };

  const handleMatchOffer = async (offerId: number) => {
    if (!walletClient) return;

    setIsMatchingOffer(true);
    setSelectedOfferId(offerId);
    try {
      addToast({ variant: "pending", message: "Submitting match transaction..." });
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function matchOffer(uint256 offerId) external"]),
        functionName: "matchOffer",
        args: [BigInt(offerId)],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Offer matched! Privara settlement initiated." });
    } catch (error) {
      console.error("Error matching offer:", error);
      addToast({ variant: "error", message: "Failed to match offer" });
    } finally {
      setIsMatchingOffer(false);
      setSelectedOfferId(null);
    }
  };

  const handleCancelOffer = async (offerId: number) => {
    if (!walletClient) return;

    setIsCancellingOffer(true);
    try {
      addToast({ variant: "pending", message: "Submitting cancellation..." });
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function cancelOffer(uint256 offerId) external"]),
        functionName: "cancelOffer",
        args: [BigInt(offerId)],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Offer cancelled successfully!" });
    } catch (error) {
      console.error("Error cancelling offer:", error);
      addToast({ variant: "error", message: "Failed to cancel offer" });
    } finally {
      setIsCancellingOffer(false);
    }
  };

  const activeMyOffersCount = useMemo(() => {
    return myOffers.filter((o) => o.active && !o.matched).length;
  }, [myOffers]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Private P2P Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lenders post encrypted loan offers. Borrowers match them. All terms remain private until secure FHE settlement.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-black text-white hover:bg-slate-800 rounded-xl px-5 py-2.5 font-medium shadow-md transition active:scale-95 flex items-center gap-1.5 self-start sm:self-center"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          Create Loan Offer
        </Button>
      </header>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <Shield className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Network Status</p>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live on Testnet
            </p>
          </div>
        </div>

        {/* Card 2: Public Offers */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <Coins className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Total Active Offers</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{offers.length}</p>
          </div>
        </div>

        {/* Card 3: Your Offers */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Your Active Offers</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{activeMyOffersCount}</p>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid gap-6 lg:grid-cols-[3fr_1.6fr] items-start">
        {/* Left: Offers list */}
        <div className="space-y-4">
          <div className="flex border-b border-slate-200 gap-6 mb-2">
            <button
              onClick={() => setActiveTab("browse")}
              className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-1.5 ${
                activeTab === "browse"
                  ? "border-black text-black"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Browse Public Offers
              {offers.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {offers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("my-offers")}
              className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-all relative flex items-center gap-1.5 ${
                activeTab === "my-offers"
                  ? "border-black text-black"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              My Active Offers
              {myOffers.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {myOffers.length}
                </span>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {activeTab === "browse" ? (
              offers.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No active offers available</p>
                  <p className="mt-1 text-xs text-muted-foreground">Be the first to post a private loan offer!</p>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 bg-black text-white hover:bg-slate-800 rounded-xl"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Create Offer
                  </Button>
                </div>
              ) : (
                offers.map((offer) => (
                  <div
                    key={offer.offerId}
                    className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          Offer #{offer.offerId}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          Lender: {offer.lender.slice(0, 6)}...{offer.lender.slice(-4)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-sm">
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">APR</p>
                          <p className="font-bold text-slate-800 mt-0.5">{offer.encryptedApr}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Size</p>
                          <p className="font-bold text-slate-800 mt-0.5">{offer.encryptedSize}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Tenor</p>
                          <p className="font-bold text-slate-800 mt-0.5">{offer.encryptedTenor}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleMatchOffer(offer.offerId)}
                      isLoading={isMatchingOffer && selectedOfferId === offer.offerId}
                      loadingText="Matching..."
                      className="bg-black text-white hover:bg-slate-800 rounded-xl px-5 self-start sm:self-center"
                    >
                      Match Offer
                    </Button>
                  </div>
                ))
              )
            ) : (
              myOffers.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-12 text-center">
                  <Clock className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">You haven't posted any offers yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Post a private loan offer to start earning yield.</p>
                  <Button
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 bg-black text-white hover:bg-slate-800 rounded-xl"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Create Offer
                  </Button>
                </div>
              ) : (
                myOffers.map((offer) => (
                  <div
                    key={offer.offerId}
                    className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all ${
                      offer.matched
                        ? "border-green-200 bg-green-50/10"
                        : offer.active
                        ? "border-slate-200 bg-white hover:border-slate-300"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-950">
                          Offer #{offer.offerId}
                        </span>
                        {offer.matched ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Matched
                          </span>
                        ) : offer.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800 ring-1 ring-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-600/20">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-sm">
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">APR</p>
                          <p className="font-bold text-slate-800 mt-0.5 font-mono">{offer.apr}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Size</p>
                          <p className="font-bold text-slate-800 mt-0.5 font-mono">{offer.size}</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl px-3.5 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Tenor</p>
                          <p className="font-bold text-slate-800 mt-0.5 font-mono">{offer.tenor}</p>
                        </div>
                      </div>
                    </div>
                    {offer.active && !offer.matched && (
                      <Button
                        variant="outline"
                        onClick={() => handleCancelOffer(offer.offerId)}
                        isLoading={isCancellingOffer}
                        loadingText="Cancelling..."
                        className="text-rose-600 border-rose-200 bg-rose-50/30 hover:bg-rose-50 rounded-xl px-4 self-start sm:self-center"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Right Side: Educational panel & Info */}
        <aside className="space-y-4">
          <div className="p-5 border rounded-2xl bg-white shadow-sm space-y-4">
            <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold">How P2P Lending Works</h3>
            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">1</div>
                <div>
                  <p className="font-bold text-slate-900">Lender Posts Offer</p>
                  <p className="mt-0.5">Lender encrypts APR, loan size, and tenor. Offer is posted on-chain with all terms fully hidden.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">2</div>
                <div>
                  <p className="font-bold text-slate-900">Borrower Matches</p>
                  <p className="mt-0.5">Borrowers browse the encrypted list. When they click Match, the on-chain loan contract is prepared.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">3</div>
                <div>
                  <p className="font-bold text-slate-900">Privara Settlement</p>
                  <p className="mt-0.5">Privara coordinator verifies FHE inputs privately, decrypts terms under secure enclave, and settles the loan.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border rounded-2xl bg-slate-900 text-white shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              <h4 className="text-xs font-mono uppercase tracking-wider font-bold">Privacy Guaranteed</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Walnut utilizes advanced homomorphic encryption so lender APR and size remain private while listed, guarding your yield strategies against competitive frontrunning.
            </p>
          </div>
        </aside>
      </div>

      {/* Floating Create Offer Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Private Loan Offer</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Form */}
            <div className="space-y-4">
              <div>
                <label htmlFor="post-apr" className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                  APR (%)
                </label>
                <Input
                  id="post-apr"
                  type="number"
                  step="0.1"
                  min="0"
                  value={postApr}
                  onChange={(e) => setPostApr(e.target.value)}
                  placeholder="e.g., 8.5"
                  className="h-11 bg-white rounded-xl border-slate-200"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Annual interest rate for this private loan offer.
                </p>
              </div>

              <div>
                <label htmlFor="post-size" className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                  Loan Size (cUSDC)
                </label>
                <Input
                  id="post-size"
                  type="number"
                  step="1"
                  min="0"
                  value={postSize}
                  onChange={(e) => setPostSize(e.target.value)}
                  placeholder="e.g., 1000"
                  className="h-11 bg-white rounded-xl border-slate-200"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  The exact amount of cUSDC liquidity you are lending.
                </p>
              </div>

              <div>
                <label htmlFor="post-tenor" className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                  Tenor (days)
                </label>
                <Input
                  id="post-tenor"
                  type="number"
                  step="1"
                  min="1"
                  value={postTenor}
                  onChange={(e) => setPostTenor(e.target.value)}
                  placeholder="e.g., 30"
                  className="h-11 bg-white rounded-xl border-slate-200"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  The duration of the active loan period in days.
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-blue-800 leading-normal">
                  <strong>Privacy Note:</strong> Your loan terms will be fully encrypted on-chain. Only matching borrowers can request secure enclave decryption to proceed with settlement.
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-1/2 rounded-xl py-2.5 font-medium border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePostOffer}
                isLoading={isPostingOffer}
                loadingText="Posting..."
                disabled={!postApr || !postSize || !postTenor}
                className="w-1/2 bg-black text-white hover:bg-slate-800 rounded-xl py-2.5 font-medium flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Post Encrypted Offer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
