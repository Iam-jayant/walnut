"use client";

import { useState, useEffect, useRef } from "react";
import { Wallet, Clock, Link as LinkIcon, Unlink, Key, ShieldCheck, HelpCircle } from "lucide-react";
import { useAccount, useSignTypedData, useWriteContract, useReadContract, useChainId, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/walnut/toast-provider";
import walnutABI from "@/abis/WalnutLending.deployed.json";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { walnutContractAddress as WALNUT_LENDING_ADDRESS } from "@/lib/walnut-contract";

export default function ENSSettingsPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const { collateral, decryptForView } = useWalnutProtocol();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"primary" | "secondary">("primary");

  // Secondary Wallet Flow (Sign Consent)
  const [primaryAddressToLink, setPrimaryAddressToLink] = useState("");
  const { signTypedDataAsync } = useSignTypedData();
  const [generatedSignature, setGeneratedSignature] = useState("");

  // Primary Wallet Flow (Submit Signature)
  const [secondaryAddressToSubmit, setSecondaryAddressToSubmit] = useState("");
  const [signatureToSubmit, setSignatureToSubmit] = useState("");
  const { writeContractAsync: writeLink, isPending: isLinking } = useWriteContract();

  // Primary Wallet Flow (Unlink)
  const [secondaryAddressToUnlink, setSecondaryAddressToUnlink] = useState("");
  const { writeContractAsync: writeUnlink, isPending: isUnlinking } = useWriteContract();

  // Aggregation State
  const [linkedAddresses, setLinkedAddresses] = useState<string[]>([]);
  const [linkedCollaterals, setLinkedCollaterals] = useState<Record<string, bigint>>({});
  
  // Initial load tracking to avoid flicker
  const hasLoadedLinked = useRef(false);



  // Fetch linked wallets array from contract using publicClient loop
  useEffect(() => {
    let mounted = true;
    const fetchLinked = async () => {
      if (!address || !publicClient) return;
      const linked: string[] = [];
      for (let i = 0; i < 20; i++) {
        try {
          const secondary = await publicClient.readContract({
            address: WALNUT_LENDING_ADDRESS,
            abi: walnutABI,
            functionName: "linkedWallets",
            args: [address, BigInt(i)]
          });
          if (secondary) linked.push(secondary as string);
        } catch (e) {
          break; // Array out of bounds
        }
      }
      if (mounted) {
        setLinkedAddresses(linked);
        hasLoadedLinked.current = true;
      }
    };
    fetchLinked();
    const interval = setInterval(fetchLinked, 10000); // poll every 10s
    return () => { mounted = false; clearInterval(interval); };
  }, [address, publicClient, isLinking, isUnlinking]);

  // Decrypt secondary wallets collateral
  useEffect(() => {
    let mounted = true;
    const fetchSecondaryCollaterals = async () => {
      if (!publicClient || !decryptForView || !address || linkedAddresses.length === 0) return;
      
      const newColls: Record<string, bigint> = {};
      for (const linkedAddress of linkedAddresses) {
        try {
          const ctHash = await publicClient.readContract({
            address: WALNUT_LENDING_ADDRESS,
            abi: walnutABI,
            functionName: "getEncryptedCollateral",
            args: [linkedAddress]
          });
          
          if (ctHash && ctHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const decrypted = await decryptForView(ctHash as string, address as `0x${string}`);
            if (decrypted !== undefined) {
              newColls[linkedAddress] = decrypted;
            } else {
              newColls[linkedAddress] = 0n; // Failed to decrypt or permit invalid
            }
          } else {
             newColls[linkedAddress] = 0n;
          }
        } catch (e) {
          console.error("Error decrypting secondary collateral for", linkedAddress, e);
          newColls[linkedAddress] = 0n;
        }
      }
      if (mounted) setLinkedCollaterals(newColls);
    };
    
    fetchSecondaryCollaterals();
    const interval = setInterval(fetchSecondaryCollaterals, 15000); // poll every 15s
    return () => { mounted = false; clearInterval(interval); };
  }, [linkedAddresses, decryptForView, publicClient, address]);

  const handleSignConsent = async () => {
    if (!address || !publicClient) return;
    try {
      // Fetch nonce precisely at the time of signing
      const currentNonce = await publicClient.readContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "nonces",
        args: [address]
      });

      const domain = {
        name: "WalnutLending",
        version: "2",
        chainId: chainId,
        verifyingContract: WALNUT_LENDING_ADDRESS as `0x${string}`,
      };

      const types = {
        LinkWallet: [
          { name: "primary", type: "address" },
          { name: "secondary", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "consentMessage", type: "string" }
        ],
      };

      const message = {
        primary: primaryAddressToLink as `0x${string}`,
        secondary: address as `0x${string}`,
        nonce: BigInt(currentNonce as any),
        consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet."
      };

      const sig = await signTypedDataAsync({
        domain,
        types,
        primaryType: "LinkWallet",
        message,
      });

      setGeneratedSignature(sig);
    } catch (e) {
      console.error(e);
      addToast({ variant: "error", message: "Failed to sign consent" });
    }
  };

  const handleSubmitLink = async () => {
    try {
      const txHash = await writeLink({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "linkWallet",
        args: [secondaryAddressToSubmit as `0x${string}`, signatureToSubmit as `0x${string}`],
      });
      addToast({ 
        variant: "pending", 
        message: "Link transaction submitted! Waiting for confirmation...", 
        title: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` 
      });
      
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'success') {
          addToast({ variant: "success", message: "Successfully linked wallet on-chain!" });
          setSecondaryAddressToSubmit("");
          setSignatureToSubmit("");
          hasLoadedLinked.current = false; // trigger refresh
        } else {
          addToast({ variant: "error", message: "Transaction reverted on-chain!" });
        }
      }
    } catch (e: any) {
      console.error(e);
      addToast({ 
        variant: "error", 
        message: "Failed to link wallet", 
        title: e.shortMessage || e.message 
      });
    }
  };

  const handleUnlink = async () => {
    try {
      const txHash = await writeUnlink({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "unlinkWallet",
        args: [secondaryAddressToUnlink as `0x${string}`],
      });
      addToast({ 
        variant: "pending", 
        message: "Unlink transaction submitted! Waiting for confirmation...", 
        title: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` 
      });
      
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'success') {
          addToast({ variant: "success", message: "Successfully unlinked wallet on-chain!" });
          setSecondaryAddressToUnlink("");
          hasLoadedLinked.current = false; // trigger refresh
        } else {
          addToast({ variant: "error", message: "Transaction reverted on-chain!" });
        }
      }
    } catch (e: any) {
      console.error(e);
      addToast({ 
        variant: "error", 
        message: "Failed to unlink wallet", 
        title: e.shortMessage || e.message 
      });
    }
  };

  const primaryBal = collateral?.decrypted?.data ? BigInt(collateral.decrypted.data) : 0n;
  const secondarySum = Object.values(linkedCollaterals).reduce((sum, val) => sum + val, 0n);
  const totalAggregated = primaryBal + secondarySum;

  const isValidSignature = signatureToSubmit.startsWith("0x") && signatureToSubmit.length >= 130;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-slate-700" />
          Private Wallet Aggregation
        </h1>
        <p className="text-sm text-muted-foreground">
          Consolidate borrow capacity across multiple wallets with FHE privacy.
        </p>
      </header>

      <div className="flex space-x-2">
        <Button 
          variant={activeTab === "primary" ? "default" : "outline"} 
          onClick={() => setActiveTab("primary")}
        >
          I am the Primary Wallet
        </Button>
        <Button 
          variant={activeTab === "secondary" ? "default" : "outline"} 
          onClick={() => setActiveTab("secondary")}
        >
          I am a Secondary Wallet
        </Button>
      </div>

      <div className="space-y-6">
        {activeTab === "secondary" && (
          <div className="max-w-2xl border border-slate-200 rounded-xl bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Key className="h-5 w-5 text-slate-600" />
              Sign Consent
            </h2>
            <p className="text-sm text-slate-600">
              Provide consent for a Primary Wallet to aggregate your collateral and debt.
              You must sign a secure EIP-712 message.
            </p>
            <div className="space-y-3">
              <label className="text-sm font-semibold">Primary Wallet Address</label>
              <Input 
                placeholder="0x..." 
                value={primaryAddressToLink}
                onChange={(e) => setPrimaryAddressToLink(e.target.value)}
              />
              <Button onClick={handleSignConsent} disabled={!primaryAddressToLink || !address} className="w-full">
                Sign Consent Payload
              </Button>
            </div>

            {generatedSignature && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg break-all text-xs text-slate-700 font-mono mt-4 relative">
                <p className="font-semibold text-slate-900 mb-1">Generated Signature:</p>
                {generatedSignature}
                <div className="mt-4 text-slate-500 bg-white p-2 rounded border border-slate-100 text-center font-medium">
                  Copy this exact signature and paste it into the "Consent Signature" field on the Primary Wallet.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "primary" && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                Aggregated Collateral
              </h2>
              
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-slate-600">Your Own Collateral:</span>
                <span className="font-semibold text-slate-900">{formatUnits(primaryBal, 6)} USDC</span>
              </div>
              
              {linkedAddresses.map(addr => (
                <div key={addr} className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Linked Wallet ({addr.slice(0,6)}...{addr.slice(-4)}):</span>
                  <span className="font-semibold text-slate-900">{formatUnits(linkedCollaterals[addr] || 0n, 6)} USDC</span>
                </div>
              ))}
              
              {linkedAddresses.length === 0 && hasLoadedLinked.current && (
                <div className="text-sm text-slate-500 italic p-2">
                  No linked wallets active.
                </div>
              )}
              
              <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-lg border border-indigo-100 mt-2">
                <span className="text-sm font-semibold text-indigo-900">Total Borrowing Power:</span>
                <span className="text-xl font-bold text-indigo-900">{formatUnits(totalAggregated, 6)} USDC</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-slate-600" />
                  Link Secondary Wallet
                </h2>
                <p className="text-sm text-slate-600">
                  Register a secondary wallet to pool its collateral and debt with your own. You need its EIP-712 consent signature.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Secondary Wallet Address</label>
                    <Input 
                      placeholder="0x..." 
                      className="mt-1"
                      value={secondaryAddressToSubmit}
                      onChange={(e) => setSecondaryAddressToSubmit(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Consent Signature</label>
                    <Input 
                      placeholder="0x..." 
                      className="mt-1"
                      value={signatureToSubmit}
                      onChange={(e) => setSignatureToSubmit(e.target.value)}
                    />
                    {signatureToSubmit && !isValidSignature && (
                      <p className="text-xs text-red-500 mt-1 font-medium">Please enter a valid signature starting with 0x (approx 130+ characters), NOT an address.</p>
                    )}
                  </div>
                  <Button onClick={handleSubmitLink} disabled={isLinking || !isValidSignature || !secondaryAddressToSubmit} className="w-full">
                    {isLinking ? "Submitting..." : "Submit Link"}
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm space-y-4 h-fit">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Unlink className="h-5 w-5 text-slate-600" />
                  Unlink Wallet
                </h2>
                <p className="text-sm text-slate-600">
                  Remove a previously linked secondary wallet. Fails if this causes undercollateralization.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Secondary Wallet Address</label>
                    <Input 
                      placeholder="0x..." 
                      className="mt-1"
                      value={secondaryAddressToUnlink}
                      onChange={(e) => setSecondaryAddressToUnlink(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={handleUnlink} disabled={isUnlinking || !secondaryAddressToUnlink} className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    {isUnlinking ? "Submitting..." : "Unlink Wallet"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
