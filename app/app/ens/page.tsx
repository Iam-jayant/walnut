"use client";

import { useState, useEffect } from "react";
import { Wallet, Plus, Trash2, Eye, EyeOff, CheckCircle, Link as LinkIcon } from "lucide-react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseAbi, isAddress } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const WALNUT_LENDING_ADDRESS = (process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS ?? process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS) as `0x${string}`;

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

  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isRemovingWallet, setIsRemovingWallet] = useState(false);
  const [removingAddress, setRemovingAddress] = useState("");
  const [aggregatedCollateral, setAggregatedCollateral] = useState<string>("••••");
  const [showAggregated, setShowAggregated] = useState(false);
  const [isLoadingAggregated, setIsLoadingAggregated] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Fetch linked wallets
  useEffect(() => {
    if (!publicClient || !address) return;

    const fetchLinkedWallets = async () => {
      try {
        const wallets = await publicClient.readContract({
          address: WALNUT_LENDING_ADDRESS as `0x${string}`,
          abi: parseAbi(["function getLinkedWallets(address) view returns (address[])"]),
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
      // getAggregatedCollateral is a state-changing function (not view)
      // It calls FHE.allow() which modifies state
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function getAggregatedCollateral(address) returns (uint256)"]),
        functionName: "getAggregatedCollateral",
        args: [address as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      
      // After transaction confirms, show that aggregation was computed
      setAggregatedCollateral("Aggregated (check events for ciphertext handle)");
      setShowAggregated(true);
    } catch (error) {
      console.error("Error fetching aggregated collateral:", error);
      setAggregatedCollateral("Error loading");
    } finally {
      setIsLoadingAggregated(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!walletClient || !newWalletAddress) return;

    // Validate address
    if (!isAddress(newWalletAddress)) {
      alert("Invalid Ethereum address");
      return;
    }

    // Check if already linked
    if (linkedWallets.some((w) => w.address.toLowerCase() === newWalletAddress.toLowerCase())) {
      alert("This wallet is already linked");
      return;
    }

    // Check if trying to link self
    if (address && newWalletAddress.toLowerCase() === address.toLowerCase()) {
      alert("Cannot link your own wallet");
      return;
    }

    setIsLinkingWallet(true);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function registerLinkedWallet(address additionalWallet) external"]),
        functionName: "registerLinkedWallet",
        args: [newWalletAddress as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Wallet linked successfully!");
      setNewWalletAddress("");
    } catch (error) {
      console.error("Error linking wallet:", error);
      alert("Failed to link wallet. Make sure the wallet isn't already linked to another account.");
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleRemoveWallet = async (walletAddress: string) => {
    if (!walletClient) return;

    setIsRemovingWallet(true);
    setRemovingAddress(walletAddress);
    try {
      const hash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: parseAbi(["function removeLinkedWallet(address wallet) external"]),
        functionName: "removeLinkedWallet",
        args: [walletAddress as `0x${string}`],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      alert("Wallet unlinked successfully!");
    } catch (error) {
      console.error("Error removing wallet:", error);
      alert("Failed to unlink wallet");
    } finally {
      setIsRemovingWallet(false);
      setRemovingAddress("");
    }
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ENS Multi-Wallet Aggregation</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Aggregate Your Collateral</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Link multiple wallets to your primary account. Borrow against your combined encrypted collateral across all wallets.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-chip-success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Live on Testnet
          </span>
        </div>
      </GlassPanel>

      {/* Your Linked Wallets */}
      <GlassPanel className="walnut-card walnut-card-strong p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-xl text-foreground">Your Linked Wallets</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Wallets linked to your primary account
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">{linkedWallets.length} linked</span>
          </div>
        </div>

        {/* Primary Wallet */}
        <div className="mb-4 rounded-lg border-2 border-accent bg-accent/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Primary Wallet
                </span>
              </div>
              <p className="font-mono text-sm text-foreground">
                {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : "Not connected"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Collateral: <span className="font-mono">Encrypted</span>
              </p>
            </div>
          </div>
        </div>

        {/* Linked Wallets */}
        {linkedWallets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <LinkIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-3 text-sm text-muted-foreground">No linked wallets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link additional wallets to aggregate your collateral
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedWallets.map((wallet) => (
              <div
                key={wallet.address}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-foreground">
                      {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Collateral: <span className="font-mono">{wallet.collateral}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveWallet(wallet.address)}
                    isLoading={isRemovingWallet && removingAddress === wallet.address}
                    loadingText="Removing..."
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Add Wallet */}
      <GlassPanel className="walnut-card walnut-card-strong p-6">
        <h3 className="font-display text-xl text-foreground mb-4">Link a New Wallet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter the address of another wallet you own. Its collateral will be aggregated with your primary wallet.
        </p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Wallet Address
            </label>
            <Input
              type="text"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Must be a valid Ethereum address
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Only link wallets you control. The linked wallet's collateral will be accessible for borrowing from your primary account.
            </p>
          </div>

          <Button
            onClick={handleLinkWallet}
            isLoading={isLinkingWallet}
            loadingText="Linking..."
            disabled={!newWalletAddress || !isAddress(newWalletAddress)}
            className="w-full bg-black text-white hover:bg-slate-900"
          >
            <Plus className="mr-2 h-4 w-4" />
            Link Wallet
          </Button>
        </div>
      </GlassPanel>

      {/* Aggregated Collateral */}
      <GlassPanel className="walnut-card walnut-card-strong p-6">
        <h3 className="font-display text-xl text-foreground mb-4">Aggregated Collateral</h3>
        <p className="text-sm text-muted-foreground mb-4">
          View your total collateral across all linked wallets. This encrypted value determines your maximum borrow capacity.
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Collateral (USD)
              </p>
              <p className="mt-2 font-mono text-2xl text-foreground">
                {showAggregated ? aggregatedCollateral : "••••"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (showAggregated) {
                  setShowAggregated(false);
                } else {
                  handleShowAggregated();
                }
              }}
              isLoading={isLoadingAggregated}
              loadingText="Loading..."
            >
              {showAggregated ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show Aggregated
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <p className="text-xs text-muted-foreground">Primary Wallet</p>
              <p className="mt-1 font-mono text-sm text-foreground">Encrypted</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Linked Wallets</p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {linkedWallets.length} × Encrypted
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            <strong>Privacy Note:</strong> Clicking "Show Aggregated" triggers a transaction that computes your total collateral using FHE addition on encrypted values. The result is an encrypted ciphertext handle emitted in the transaction events.
          </p>
        </div>
      </GlassPanel>

      {/* How It Works */}
      <GlassPanel className="walnut-card p-6">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="font-display text-xl text-foreground">How ENS Aggregation Works</h3>
          <span className="text-muted-foreground">{showHowItWorks ? "−" : "+"}</span>
        </button>

        {showHowItWorks && (
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">1. Link Multiple Wallets</p>
              <p className="mt-1">
                Connect additional wallets you own to your primary account. Each wallet maintains its own encrypted collateral balance.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. FHE Aggregation</p>
              <p className="mt-1">
                When you request aggregated collateral, the contract uses FHE.add to sum encrypted collateral values across all wallets. The computation happens on encrypted data.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">3. Borrow Against Total</p>
              <p className="mt-1">
                Your maximum borrow capacity is calculated from the aggregated encrypted collateral. You can borrow more without moving funds between wallets.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">4. Privacy Preserved</p>
              <p className="mt-1">
                Individual wallet balances remain encrypted. Only you can decrypt the aggregated total. Other users see only encrypted values.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">5. ENS Integration (Future)</p>
              <p className="mt-1">
                In production, you'll be able to link wallets using ENS names instead of addresses, making multi-wallet management even easier.
              </p>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
