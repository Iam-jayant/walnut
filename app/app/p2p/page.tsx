"use client";

import { useMemo, useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { Users, Lock, ArrowRight, ShieldCheck, CheckCircle2, Clock, Sparkles, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast } from "@/components/walnut/toast-provider";
import { TransactionProgressModal, TransactionStage, StepItem } from "@/components/walnut/transaction-progress-modal";
import {
  walnutChainId,
  walnutP2pAbi,
  getGasFeeOverrides,
  walnutP2PAddress as P2P_ADDRESS,
} from "@/lib/walnut-contract";

const P2P_MATCH_STEPS: StepItem[] = [
  { id: "encrypt", label: "1. Encrypt Counterparty Terms", description: "Encrypting matching principal, rate, and duration via CoFHE ZK engine." },
  { id: "match", label: "2. Submit Match Request", description: "Broadcasting matchOffer to WalnutP2P on Arbitrum Sepolia." },
  { id: "settle", label: "3. CoFHE Threshold Settlement", description: "Verifying encrypted term equality and settling loan on-chain." },
];

export default function P2PPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();

  // Create Offer Form
  const [offerType, setOfferType] = useState<"LEND" | "BORROW">("LEND");
  const [principal, setPrincipal] = useState("30");
  const [interestRate, setInterestRate] = useState("5");
  const [durationDays, setDurationDays] = useState("30");

  // Matching Modal State
  const [matchingOfferId, setMatchingOfferId] = useState<bigint | null>(null);
  const [matchPrincipal, setMatchPrincipal] = useState("");
  const [matchRate, setMatchRate] = useState("");
  const [matchDuration, setMatchDuration] = useState("");

  // Progress Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<TransactionStage>("zk_encrypt");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Read total offer count
  const { data: offerCountData, refetch: refetchOfferCount } = useReadContract({
    address: P2P_ADDRESS,
    abi: walnutP2pAbi,
    functionName: "offerCount",
  });

  const offerCount = useMemo(() => {
    return offerCountData ? Number(offerCountData) : 0;
  }, [offerCountData]);

  // Create P2P Offer Handler
  const handleCreateOffer = async () => {
    if (!account.address) return;
    setIsSubmittingOffer(true);
    try {
      addToast({ variant: "pending", title: "Encrypted Offer", message: "Generating ZK proof for P2P loan terms..." });

      const pUnits = BigInt(Math.floor(Number(principal) * 1e6));
      const rUnits = BigInt(Math.floor(Number(interestRate) * 100)); // bps
      const dUnits = BigInt(Math.floor(Number(durationDays) * 86400)); // seconds

      const encInputs = await protocol.encryptor.encryptInputsAsync({
        items: [
          Encryptable.uint128(pUnits),
          Encryptable.uint128(rUnits),
          Encryptable.uint128(dUnits)
        ],
        account: account.address,
        chainId: walnutChainId,
      });

      const typeEnum = offerType === "LEND" ? 0 : 1;

      addToast({ variant: "pending", title: "Broadcasting Offer", message: "Posting encrypted P2P offer to WalnutP2P..." });

      const gasOverrides = await getGasFeeOverrides(publicClient);

      const hash = await writeContractAsync({
        address: P2P_ADDRESS,
        abi: walnutP2pAbi,
        functionName: "createOffer",
        args: [typeEnum, encInputs[0] as any, encInputs[1] as any, encInputs[2] as any],
        ...gasOverrides
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      addToast({
        variant: "success",
        title: "P2P Offer Created",
        message: `Successfully posted confidential ${offerType} offer!`,
        txHash: hash
      });

      await refetchOfferCount();
    } catch (err: any) {
      addToast({ variant: "error", title: "Offer Creation Failed", message: err?.message || err });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // Match Offer Handler
  const handleMatchOffer = async () => {
    if (!account.address || !matchingOfferId) return;

    setModalOpen(true);
    setModalStage("zk_encrypt");
    setCurrentStepIndex(0);
    setActiveTxHash(null);
    setErrorMessage(null);

    try {
      const gasOverrides = await getGasFeeOverrides(publicClient);

      const pUnits = BigInt(Math.floor(Number(matchPrincipal || principal) * 1e6));
      const rUnits = BigInt(Math.floor(Number(matchRate || interestRate) * 100));
      const dUnits = BigInt(Math.floor(Number(matchDuration || durationDays) * 86400));

      const encInputs = await protocol.encryptor.encryptInputsAsync({
        items: [
          Encryptable.uint128(pUnits),
          Encryptable.uint128(rUnits),
          Encryptable.uint128(dUnits)
        ],
        account: account.address,
        chainId: walnutChainId,
      });

      setModalStage("wallet_sign");
      setCurrentStepIndex(1);

      const matchHash = await writeContractAsync({
        address: P2P_ADDRESS,
        abi: walnutP2pAbi,
        functionName: "matchOffer",
        args: [matchingOfferId, encInputs[0] as any, encInputs[1] as any, encInputs[2] as any],
        ...gasOverrides
      });

      setActiveTxHash(matchHash);
      setModalStage("mining");
      setCurrentStepIndex(2);

      let receipt;
      if (publicClient) {
        receipt = await publicClient.waitForTransactionReceipt({ hash: matchHash });
      }

      setModalStage("completed");
      addToast({
        variant: "success",
        title: "Match Submitted",
        message: `P2P match request confirmed! Settlement callback initiated.`,
        txHash: matchHash
      });

      setMatchingOfferId(null);
      await refetchOfferCount();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setModalStage("failed");
      addToast({ variant: "error", title: "Match Failed", message: msg });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pb-6 border-b border-black/10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black rounded-md">Confidential P2P Lending</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl rounded-md">
            Create and match P2P loans with end-to-end homomorphic privacy. Principal, interest rate, and duration remain fully encrypted.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3 rounded-md">
        {/* Create Offer Panel */}
        <section className="md:col-span-1 space-y-6 bg-white border border-black/10 p-6 rounded-md">
          <h2 className="text-base font-bold text-black flex items-center gap-2 rounded-md">
             Create Encrypted Offer
          </h2>

          <div className="grid grid-cols-2 gap-0 border border-black/10 rounded-md">
            <button
              onClick={() => setOfferType("LEND")}
              className={`py-3 text-xs font-bold transition rounded-md ${offerType === "LEND" ? "bg-black text-white" : "bg-white text-slate-500 hover:text-black"}`}
            >
              LEND (Supply)
            </button>
            <button
              onClick={() => setOfferType("BORROW")}
              className={`py-3 text-xs font-bold transition rounded-md border-l border-black/10 ${offerType === "BORROW" ? "bg-black text-white" : "bg-white text-slate-500 hover:text-black"}`}
            >
              BORROW (Request)
            </button>
          </div>

          <div className="space-y-4 rounded-md">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 rounded-md">
                Principal Amount ($)
              </label>
              <Input
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="30"
                className="text-lg font-semibold h-12 border-black/10 focus-visible:ring-0 focus-visible:border-black/20 rounded-md"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 rounded-md">
                Interest Rate (% APR)
              </label>
              <Input
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="5"
                className="text-lg font-semibold h-12 border-black/10 focus-visible:ring-0 focus-visible:border-black/20 rounded-md"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 rounded-md">
                Duration (Days)
              </label>
              <Input
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="30"
                className="text-lg font-semibold h-12 border-black/10 focus-visible:ring-0 focus-visible:border-black/20 rounded-md"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateOffer}
            disabled={isSubmittingOffer}
            className="w-full bg-black hover:bg-black/90 text-white font-bold h-12 text-[15px] rounded-md shadow-none"
          >
            {isSubmittingOffer ? "Encrypting..." : `Post ${offerType} Offer`}
          </Button>
        </section>

        {/* Offers Directory */}
        <section className="md:col-span-2 space-y-6 bg-white border border-black/10 p-6 rounded-md">
          <div className="flex items-center justify-between border-b border-black/10 pb-4 rounded-md">
            <div>
              <h2 className="text-lg font-bold text-black rounded-md">Active P2P Listings</h2>
              <p className="text-xs text-slate-500 mt-1 rounded-md">Live encrypted offers on Arbitrum Sepolia ({offerCount} Total)</p>
            </div>
            <Button onClick={() => refetchOfferCount()} variant="outline" size="sm" className="text-xs font-medium border-black/10 text-black hover:bg-slate-50 rounded-md shadow-none h-9 px-4">
               Refresh
            </Button>
          </div>

          {offerCount === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-black/10 rounded-md space-y-3">
              <p className="text-sm font-semibold text-black rounded-md">No P2P Listings Found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto rounded-md">Create the first encrypted P2P LEND or BORROW offer using the panel on the left.</p>
            </div>
          ) : (
            <div className="space-y-3 rounded-md">
              {Array.from({ length: Math.min(offerCount, 5) }).map((_, idx) => {
                const id = BigInt(idx + 1);
                return (
                  <div
                    key={id.toString()}
                    className="p-4 border border-black/10 bg-white hover:bg-slate-50 transition flex items-center justify-between rounded-md shadow-none"
                  >
                    <div className="flex items-center gap-4 rounded-md">
                      <div className="w-10 h-10 border border-black/10 bg-black text-white font-bold flex items-center justify-center text-xs rounded-md">
                        #{id.toString()}
                      </div>
                      <div className="rounded-md">
                        <div className="flex items-center gap-3 mb-1 rounded-md">
                          <span className="text-sm font-bold uppercase text-black rounded-md">P2P Offer</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-black border border-black/10 px-2 py-0.5 rounded-md">
                            Encrypted
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono rounded-md">
                          Principal: [euint128] | APR: [euint128] | Duration: [euint128]
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setMatchingOfferId(id);
                        handleMatchOffer();
                      }}
                      size="sm"
                      className="bg-black hover:bg-black/90 text-white text-xs font-bold rounded-md h-9 px-5 shadow-none"
                    >
                      Match Terms
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Progress Modal */}
      <TransactionProgressModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stage={modalStage}
        currentStepIndex={currentStepIndex}
        steps={P2P_MATCH_STEPS}
        txHash={activeTxHash}
        errorMessage={errorMessage}
        title="P2P Match Execution"
      />
    </div>
  );
}
