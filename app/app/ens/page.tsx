"use client";

import { useState, useEffect } from "react";
import { Wallet, Plus, Trash2, Eye, EyeOff, CheckCircle, Link as LinkIcon, Info, Shield, Coins, HelpCircle, KeyRound, Sparkles, X } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { isAddress } from "viem";

import { Button } from "@/components/ui/button";
import { walnutLendingAbi, getGasFeeOverrides } from "@/lib/walnut-contract";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast } from "@/components/walnut/toast-provider";

const WALNUT_LENDING_ADDRESS = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS as `0x${string}`;

type LinkedWallet = {
  address: string;
  collateral: string;
  isEncrypted: boolean;
};

export default function ENSPage() {
  const protocol = useWalnutProtocol();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addToast } = useToast();

  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isRemovingWallet, setIsRemovingWallet] = useState(false);
  const [removingAddress, setRemovingAddress] = useState("");
  const [aggregatedCollateral, setAggregatedCollateral] = useState<string>("••••");
  const [showAggregated, setShowAggregated] = useState(false);
  const [isLoadingAggregated, setIsLoadingAggregated] = useState(false);
  
  // Modal display state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Fetch linked wallets
  useEffect(() => {
    if (!publicClient || !address) return;

    const fetchLinkedWallets = async () => {
      try {
        const wallets = await publicClient.readContract({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          abi: walnutLendingAbi,
          functionName: "getLinkedWallets",
          args: [address as `0x${string}`],
        });

        const linkedWalletsList: LinkedWallet[] = (wallets as string[]).map((addr) => ({
          address: addr,
          collateral: "Encrypted",
          isEncrypted: true,
        }));

        setLinkedWallets(linkedWalletsList);
      } catch (error) {
        console.error("Error fetching linked wallets:", error);
      }
    };

    fetchLinkedWallets();
    const interval = setInterval(fetchLinkedWallets, 30000);
    return () => clearInterval(interval);
  }, [publicClient, address]);

  // Fetch aggregated collateral
  const handleShowAggregated = async () => {
    if (!walletClient || !address) return;

    setIsLoadingAggregated(true);
    try {
      addToast({ variant: "pending", message: "Summing collateral via FHE addition..." });
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutLendingAbi,
        functionName: "getAggregatedCollateral",
        args: [address as `0x${string}`],
        ...feeOverrides,
      });

      addToast({ variant: "pending", message: "Confirming sum transaction on-chain..." });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      setAggregatedCollateral("Aggregated successfully");
      setShowAggregated(true);
      addToast({ variant: "success", message: "Aggregation successfully computed on-chain!" });
    } catch (error) {
      console.error("Error fetching aggregated collateral:", error);
      setAggregatedCollateral("Error loading");
      addToast({ variant: "error", message: "Failed to sum collateral" });
    } finally {
      setIsLoadingAggregated(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!walletClient || !newWalletAddress) return;

    // Validate address
    if (!isAddress(newWalletAddress)) {
      addToast({ variant: "error", message: "Invalid Ethereum address" });
      return;
    }

    // Check if already linked
    if (linkedWallets.some((w) => w.address.toLowerCase() === newWalletAddress.toLowerCase())) {
      addToast({ variant: "error", message: "This wallet is already linked" });
      return;
    }

    // Check if trying to link self
    if (address && newWalletAddress.toLowerCase() === address.toLowerCase()) {
      addToast({ variant: "error", message: "Cannot link your own wallet" });
      return;
    }

    setIsLinkingWallet(true);
    try {
      addToast({ variant: "pending", message: "Submitting link wallet request..." });
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutLendingAbi,
        functionName: "registerLinkedWallet",
        args: [newWalletAddress as `0x${string}`],
        ...feeOverrides,
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Wallet linked successfully!" });
      setNewWalletAddress("");
      setIsLinkModalOpen(false);
    } catch (error) {
      console.error("Error linking wallet:", error);
      addToast({ variant: "error", message: "Failed to link wallet. Make sure it isn't already linked elsewhere." });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleRemoveWallet = async (walletAddress: string) => {
    if (!walletClient) return;

    setIsRemovingWallet(true);
    setRemovingAddress(walletAddress);
    try {
      addToast({ variant: "pending", message: "Submitting unlink wallet request..." });
      const feeOverrides = await getGasFeeOverrides(publicClient);
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutLendingAbi,
        functionName: "removeLinkedWallet",
        args: [walletAddress as `0x${string}`],
        ...feeOverrides,
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      addToast({ variant: "success", message: "Wallet unlinked successfully!" });
    } catch (error) {
      console.error("Error removing wallet:", error);
      addToast({ variant: "error", message: "Failed to unlink wallet" });
    } finally {
      setIsRemovingWallet(false);
      setRemovingAddress("");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Private Wallet Aggregation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidate borrow capacity across multiple wallets with FHE privacy. Aggregate your collateral without merging accounts.
          </p>
        </div>
        <Button
          onClick={() => setIsLinkModalOpen(true)}
          className="bg-black text-white hover:bg-slate-800 rounded-xl px-5 py-2.5 font-medium shadow-md transition active:scale-95 flex items-center gap-1.5 self-start sm:self-center"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          Link Additional Wallet
        </Button>
      </header>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Primary Account */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <Wallet className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Primary Account</p>
            <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
            </p>
          </div>
        </div>

        {/* Card 2: Linked Wallets Count */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <LinkIcon className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Linked Accounts</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{linkedWallets.length} Active</p>
          </div>
        </div>

        {/* Card 3: Total Borrow capacity or aggregated status */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
            <Coins className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Aggregated Collateral</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-800 truncate">
                {showAggregated ? aggregatedCollateral : "•••• Encrypted"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (showAggregated) {
                    setShowAggregated(false);
                  } else {
                    void handleShowAggregated();
                  }
                }}
                disabled={isLoadingAggregated}
                className="text-[10px] font-semibold text-slate-500 hover:text-black underline cursor-pointer disabled:opacity-50"
              >
                {isLoadingAggregated ? "Summing..." : showAggregated ? "Hide" : "Compute Sum"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid gap-6 lg:grid-cols-[3fr_1.6fr] items-start">
        {/* Left column: Wallets listing */}
        <div className="space-y-5">
          {/* Primary Account Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Primary Wallet</h2>
              <span className="ml-auto rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold text-slate-100">
                Connected Owner
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-sm text-slate-800 font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                  {address || "Wallet not connected"}
                </p>
                <p className="text-[11px] text-muted-foreground px-1">
                  This wallet holds the primary FHE-secured collateral and serves as the borrower of record.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl text-center self-start sm:self-center">
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Collateral Status</p>
                <p className="font-bold text-slate-800 font-mono text-xs mt-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  On-chain Encrypted
                </p>
              </div>
            </div>
          </div>

          {/* Linked Wallets List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Linked Collateral Accounts</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {linkedWallets.length} Linked
              </span>
            </div>

            {linkedWallets.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-12 text-center">
                <LinkIcon className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No linked wallets yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Link additional wallets to factor their collateral balances into your borrow capacity.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="mt-4 bg-black text-white hover:bg-slate-800 rounded-xl"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Link Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedWallets.map((wallet) => (
                  <div
                    key={wallet.address}
                    className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between shadow-sm hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-lg">
                          {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800 ring-1 ring-slate-200">
                          Active Link
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-1">
                        Collateral Balance: <span className="font-mono font-semibold text-slate-800">{wallet.collateral} (FHE-Secured)</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveWallet(wallet.address)}
                      isLoading={isRemovingWallet && removingAddress === wallet.address}
                      loadingText="Removing..."
                      className="text-rose-600 border-rose-200 bg-rose-50/30 hover:bg-rose-50 rounded-xl p-2.5 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Rich Educational & FHE Guide */}
        <aside className="space-y-4">
          {/* How it Works panel */}
          <div className="p-5 border rounded-2xl bg-white shadow-sm space-y-4">
            <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold">How Aggregation Works</h3>
            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">1</div>
                <div>
                  <p className="font-bold text-slate-900">Link Owned Wallets</p>
                  <p className="mt-0.5">Register secondary owned wallets. Each wallet continues to privately hold its independent collateral positions on-chain.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">2</div>
                <div>
                  <p className="font-bold text-slate-900">Cryptographic Summing</p>
                  <p className="mt-0.5">We invoke on-chain `FHE.add` calculations. The system sums the encrypted balances inside a secure ciphertext without exposing any plaintext numbers.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 font-mono font-bold text-slate-700">3</div>
                <div>
                  <p className="font-bold text-slate-900">Elevated Borrow Capacity</p>
                  <p className="mt-0.5">Your borrow capacity increases based on the aggregated sum. You enjoy maximum capital efficiency without consolidating assets into a single hot wallet.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy tech card */}
          <div className="p-5 border rounded-2xl bg-slate-900 text-white shadow-md space-y-3.5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4.5 w-4.5 text-slate-400" />
              <h4 className="text-xs font-mono uppercase tracking-wider font-bold">Mathematical Privacy</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Walnut utilizes advanced homomorphic encryption. Even though the protocol computes the sum of your collateral on-chain to authorize loans, the underlying values remain fully encrypted and private to external observers.
            </p>
            <div className="pt-1.5 border-t border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-400">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Fully Homomorphic Encryption (FHE)
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Link Wallet Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Link Additional Wallet</h3>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                  Wallet Address
                </label>
                <Input
                  type="text"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  placeholder="e.g., 0x9522... or 0x..."
                  className="h-11 bg-white rounded-xl border-slate-200 font-mono"
                />
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Enter the Ethereum address of the additional wallet you own.
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-800 leading-normal">
                  <strong>Important:</strong> Only link wallets that you legally control. Once successfully linked, this wallet's on-chain encrypted collateral balance will be aggregated with your primary wallet.
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsLinkModalOpen(false)}
                className="w-1/2 rounded-xl py-2.5 font-medium border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkWallet}
                isLoading={isLinkingWallet}
                loadingText="Linking..."
                disabled={!newWalletAddress || !isAddress(newWalletAddress)}
                className="w-1/2 bg-black text-white hover:bg-slate-800 rounded-xl py-2.5 font-medium flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Link Wallet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
