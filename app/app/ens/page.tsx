"use client";

import { useState, useEffect, useRef } from "react";
import { Wallet, Clock, Link as LinkIcon, Unlink, Key, ShieldCheck, HelpCircle, Copy, Check } from "lucide-react";
import { useAccount, useSignTypedData, useReadContract, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits, verifyTypedData } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/walnut/toast-provider";
import walnutABI from "@/abis/WalnutLending.deployed.json";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { walnutContractAddress as WALNUT_LENDING_ADDRESS, getGasFeeOverrides } from "@/lib/walnut-contract";

export default function ENSSettingsPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addToast } = useToast();
  const { collateral, decryptForView } = useWalnutProtocol();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"primary" | "secondary">("primary");

  // Secondary Wallet Flow (Sign Consent)
  const [primaryAddressToLink, setPrimaryAddressToLink] = useState("");
  const { signTypedDataAsync } = useSignTypedData();
  const [generatedSignature, setGeneratedSignature] = useState("");
  const [copiedSignature, setCopiedSignature] = useState(false);

  // Primary Wallet Flow (Submit Signature)
  const [secondaryAddressToSubmit, setSecondaryAddressToSubmit] = useState("");
  const [signatureToSubmit, setSignatureToSubmit] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  // Primary Wallet Flow (Unlink)
  const [secondaryAddressToUnlink, setSecondaryAddressToUnlink] = useState("");
  const [isUnlinking, setIsUnlinking] = useState(false);

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
    if (!walletClient || !publicClient || !address) return;
    setIsLinking(true);
    try {
      // 1. Verify the signature matches the input address AND the connected primary address
      const currentNonce = await publicClient.readContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "nonces",
        args: [secondaryAddressToSubmit as `0x${string}`]
      });

      const isValid = await verifyTypedData({
        address: secondaryAddressToSubmit as `0x${string}`,
        domain: {
          name: "WalnutLending",
          version: "2",
          chainId: chainId,
          verifyingContract: WALNUT_LENDING_ADDRESS as `0x${string}`,
        },
        types: {
          LinkWallet: [
            { name: "primary", type: "address" },
            { name: "secondary", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "consentMessage", type: "string" }
          ],
        },
        primaryType: "LinkWallet",
        message: {
          primary: address as `0x${string}`,
          secondary: secondaryAddressToSubmit as `0x${string}`,
          nonce: BigInt(currentNonce as any),
          consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet."
        },
        signature: signatureToSubmit as `0x${string}`,
      });

      if (!isValid) {
        addToast({ 
          variant: "error", 
          title: "Invalid Signature", 
          message: "The signature is invalid. Ensure you are connected to the correct Primary wallet and entered the correct Secondary address." 
        });
        setIsLinking(false);
        return;
      }

      const gasOverrides = await getGasFeeOverrides(publicClient);
      const txHash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "linkWallet",
        args: [secondaryAddressToSubmit as `0x${string}`, signatureToSubmit as `0x${string}`],
        account: address,
        chain: walletClient.chain,
        ...gasOverrides
      });
      addToast({ 
        variant: "pending", 
        message: "Link transaction submitted! Waiting for confirmation...", 
        title: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` 
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        addToast({ variant: "success", message: "Successfully linked wallet on-chain!" });
        setSecondaryAddressToSubmit("");
        setSignatureToSubmit("");
        hasLoadedLinked.current = false; // trigger refresh
      } else {
        addToast({ variant: "error", message: "Transaction reverted on-chain!" });
      }
    } catch (e: any) {
      console.error(e);
      addToast({ 
        variant: "error", 
        message: "Failed to link wallet", 
        title: e.shortMessage || e.message 
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!walletClient || !publicClient || !address) return;
    setIsUnlinking(true);
    try {
      const gasOverrides = await getGasFeeOverrides(publicClient);
      const txHash = await walletClient.writeContract({
        address: WALNUT_LENDING_ADDRESS as `0x${string}`,
        abi: walnutABI,
        functionName: "requestUnlink", // It's requestUnlink in V2, not unlinkWallet
        args: [secondaryAddressToUnlink as `0x${string}`],
        account: address,
        chain: walletClient.chain,
        ...gasOverrides
      });
      addToast({ 
        variant: "pending", 
        message: "Unlink transaction submitted! Waiting for confirmation...", 
        title: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` 
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        addToast({ variant: "success", message: "Successfully unlinked wallet on-chain!" });
        setSecondaryAddressToUnlink("");
        hasLoadedLinked.current = false; // trigger refresh
      } else {
        addToast({ variant: "error", message: "Transaction reverted on-chain!" });
      }
    } catch (e: any) {
      console.error(e);
      addToast({ 
        variant: "error", 
        message: "Failed to unlink wallet", 
        title: e.shortMessage || e.message 
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const primaryBal = collateral?.decrypted?.data ? BigInt(collateral.decrypted.data) : 0n;
  const secondarySum = Object.values(linkedCollaterals).reduce((sum, val) => sum + val, 0n);
  const totalAggregated = primaryBal + secondarySum;

  const isValidSignature = signatureToSubmit.startsWith("0x") && signatureToSubmit.length >= 130;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-black/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-black flex items-center gap-2">
          <Wallet className="h-6 w-6 text-black" />
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
          <div className="max-w-2xl border border-black/10 rounded-md bg-white p-6 shadow-none space-y-4">
            <h2 className="text-lg font-semibold text-black flex items-center gap-2">
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
              <div className="p-5 bg-[#fafafa] border border-black/10 rounded-md relative group">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-black">Generated Signature</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#1EAEA1] hover:bg-[#1EAEA1]/10 hover:text-[#1EAEA1] h-8 px-3"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSignature);
                      setCopiedSignature(true);
                      setTimeout(() => setCopiedSignature(false), 2000);
                    }}
                  >
                    {copiedSignature ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copiedSignature ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-md border border-black/10 font-mono text-[11px] leading-relaxed text-black break-all shadow-none">
                  {generatedSignature}
                </div>
                <div className="mt-4 text-white bg-[#1EAEA1] p-3 rounded-md text-center text-sm font-medium shadow-none">
                  Copy this exact signature and paste it into the "Consent Signature" field on the Primary Wallet.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "primary" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-black/10 rounded-md bg-white p-6 shadow-none flex flex-col h-full">
                <div className="flex-1 space-y-4">
                  <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-slate-600" />
                    Link Secondary Wallet
                  </h2>
                  <p className="text-sm text-slate-600">
                    Register a secondary wallet to pool its collateral and debt with your own. You need its EIP-712 consent signature.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-black">Secondary Wallet Address</label>
                      <Input 
                        placeholder="0x..." 
                        className="mt-1"
                        value={secondaryAddressToSubmit}
                        onChange={(e) => setSecondaryAddressToSubmit(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-black">Consent Signature</label>
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
                  </div>
                </div>
                <div className="mt-6">
                  <Button onClick={handleSubmitLink} disabled={isLinking || !isValidSignature || !secondaryAddressToSubmit} className="w-full bg-black text-white hover:bg-black/90">
                    {isLinking ? "Submitting..." : "Submit Link"}
                  </Button>
                </div>
              </div>

              <div className="border border-black/10 rounded-md bg-white p-6 shadow-none flex flex-col h-full">
                <div className="flex-1 space-y-4">
                  <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                    <Unlink className="h-5 w-5 text-slate-600" />
                    Unlink Wallet
                  </h2>
                  <p className="text-sm text-slate-600">
                    Remove a previously linked secondary wallet. Fails if this causes undercollateralization.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-black">Secondary Wallet Address</label>
                      <Input 
                        placeholder="0x..." 
                        className="mt-1"
                        value={secondaryAddressToUnlink}
                        onChange={(e) => setSecondaryAddressToUnlink(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Button variant="outline" onClick={handleUnlink} disabled={isUnlinking || !secondaryAddressToUnlink} className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    {isUnlinking ? "Submitting..." : "Unlink Wallet"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border border-black/10 rounded-md bg-white p-6 shadow-none space-y-4">
              <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-600" />
                Aggregated Collateral
              </h2>
              
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md">
                <span className="text-sm font-medium text-slate-600">Your Own Collateral:</span>
                <span className="font-semibold text-black">{formatUnits(primaryBal, 6)} USDC</span>
              </div>
              
              {linkedAddresses.map(addr => (
                <div key={addr} className="flex justify-between items-center bg-slate-50 p-4 rounded-md border border-black/10">
                  <span className="text-sm font-medium text-slate-600">Linked Wallet ({addr.slice(0,6)}...{addr.slice(-4)}):</span>
                  <span className="font-semibold text-black">{formatUnits(linkedCollaterals[addr] || 0n, 6)} USDC</span>
                </div>
              ))}
              
              {linkedAddresses.length === 0 && hasLoadedLinked.current && (
                <div className="text-sm text-slate-500 italic p-2">
                  No linked wallets active.
                </div>
              )}
              
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md border border-black/10 mt-2">
                <span className="text-sm font-semibold text-black">Total Borrowing Power:</span>
                <span className="text-xl font-bold text-black">{formatUnits(totalAggregated, 6)} USDC</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
