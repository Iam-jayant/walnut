"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useToast } from "@/components/walnut/toast-provider";
import { TransactionProgressModal, TransactionStage, StepItem } from "@/components/walnut/transaction-progress-modal";
import {
  walnutChainId,
  walnutLendingAbi,
  walnutWrapperAbi,
  erc20Abi,
  getGasFeeOverrides,
  walnutContractAddress as WALNUT_LENDING_ADDRESS,
  walnutWrapperAddress as WRAPPER_ADDRESS,
  walnutMockUsdcAddress as MOCK_USDC_ADDRESS,
  walnutOracleAddress as ORACLE_ADDRESS,
} from "@/lib/walnut-contract";

const DEPOSIT_STEPS: StepItem[] = [
  { id: "encrypt", label: "1. FHE Input Encryption", description: "Encrypting deposit amount into euint64 via CoFHE ZK engine." },
  { id: "deposit", label: "2. Protocol Deposit", description: "Broadcasting confidential deposit transaction to Arbitrum Sepolia." },
];

export default function DepositPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();
  const { tokenBalances, refreshBalances } = useTokenBalances();

  const [amount, setAmount] = useState("");
  const [shieldAmount, setShieldAmount] = useState("");
  
  // Progress modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<TransactionStage>("zk_encrypt");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Faucet & Shielding state
  const [isMinting, setIsMinting] = useState(false);
  const [isShielding, setIsShielding] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Read Raw USDC & wUSDC Balances
  const { data: rawUsdcBalance, refetch: refetchRawUsdc } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account.address) }
  });

  const { data: wUsdcBalance, refetch: refetchWUsdc } = useReadContract({
    address: WRAPPER_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account.address) }
  });

  const parsedAmount = useMemo(() => {
    if (!amount || !/^\d+(\.\d+)?$/.test(amount)) return 0n;
    try {
      const parts = amount.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = (parts[1] || '').padEnd(6, '0').slice(0, 6);
      return BigInt(integerPart + decimalPart);
    } catch { return 0n; }
  }, [amount]);

  const parsedShieldAmount = useMemo(() => {
    if (!shieldAmount || !/^\d+(\.\d+)?$/.test(shieldAmount)) return 0n;
    try {
      const parts = shieldAmount.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = (parts[1] || '').padEnd(6, '0').slice(0, 6);
      return BigInt(integerPart + decimalPart);
    } catch { return 0n; }
  }, [shieldAmount]);

  // Faucet Handlers
  const handleMintFaucet = async () => {
    if (!account.address) return;
    setIsMinting(true);
    try {
      addToast({ variant: "pending", title: "Faucet Request", message: "Minting $1,000 MockUSDC on Arbitrum Sepolia..." });
      const mintAmount = 1000n * 10n ** 6n; // $1,000
      const gasOverrides = await getGasFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "mint",
        args: [account.address, mintAmount],
        ...gasOverrides
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      addToast({ variant: "success", title: "Faucet Complete", message: "Successfully minted $1,000 MockUSDC!", txHash: hash });
      await refetchRawUsdc();
    } catch (err: any) {
      addToast({ variant: "error", title: "Faucet Failed", message: err?.message || err });
    } finally {
      setIsMinting(false);
    }
  };

  const handleShieldUSDC = async () => {
    if (!account.address || parsedShieldAmount === 0n) return;
    setIsShielding(true);
    try {
      addToast({ variant: "pending", title: "Shielding Collateral", message: "Approving MockUSDC to Vault Wrapper..." });
      const gasOverrides = await getGasFeeOverrides(publicClient);
      
      // Step 1: Approve wrapper to pull MockUSDC
      const approveHash = await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [WRAPPER_ADDRESS, parsedShieldAmount],
        ...gasOverrides
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });

      addToast({ variant: "pending", title: "Shielding Collateral", message: "Wrapping USDC into wUSDC vault tokens..." });
      
      // Step 2: Shield to wUSDC
      const shieldHash = await writeContractAsync({
        address: WRAPPER_ADDRESS,
        abi: walnutWrapperAbi,
        functionName: "shield",
        args: [account.address, parsedShieldAmount],
        ...gasOverrides
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: shieldHash });

      addToast({
        variant: "success",
        title: "Shielding Complete",
        message: `Successfully shielded $${(Number(parsedShieldAmount) / 1e6).toFixed(2)} USDC to wUSDC!`,
        txHash: shieldHash
      });

      setShieldAmount("");
      await refetchRawUsdc();
      await refetchWUsdc();
    } catch (err: any) {
      addToast({ variant: "error", title: "Shielding Failed", message: err?.message || err });
    } finally {
      setIsShielding(false);
    }
  };

  // Main Deposit Handler
  const handleDeposit = async () => {
    if (!account.address || parsedAmount === 0n) return;

    setModalOpen(true);
    setModalStage("zk_encrypt");
    setCurrentStepIndex(0);
    setActiveTxHash(null);
    setErrorMessage(null);

    try {
      const gasOverrides = await getGasFeeOverrides(publicClient);

      // ----------------------------------------------------
      // STEP 1: FHE INPUT ENCRYPTION
      // ----------------------------------------------------
      let encryptedAmountVal;
      try {
        const [encAmount] = await protocol.encryptor.encryptInputsAsync({
          items: [Encryptable.uint64(parsedAmount)],
          account: account.address,
          chainId: walnutChainId,
        });
        encryptedAmountVal = encAmount;
      } catch (err) {
        console.error("FHE Encryption error", err);
        throw new Error("Collateral input encryption failed. Please verify your CoFHE wallet connection.");
      }

      // ----------------------------------------------------
      // STEP 2: PROTOCOL DEPOSIT
      // ----------------------------------------------------
      setModalStage("wallet_sign");
      setCurrentStepIndex(1);

      // Check if Lending protocol is operator of wUSDC
      const isOp = await publicClient?.readContract({
        address: WRAPPER_ADDRESS,
        abi: walnutWrapperAbi,
        functionName: "isOperator",
        args: [account.address, WALNUT_LENDING_ADDRESS],
      });

      if (!isOp) {
        addToast({ variant: "pending", title: "Approving Vault", message: "Granting time-bound operator allowance to lending protocol..." });
        const setOpHash = await writeContractAsync({
          address: WRAPPER_ADDRESS,
          abi: walnutWrapperAbi,
          functionName: "setOperator",
          args: [WALNUT_LENDING_ADDRESS, 0xffffffff],
          ...gasOverrides
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: setOpHash });
        addToast({ variant: "success", title: "Approval Complete", message: "Vault operator allowance granted." });
      }

      let depositGasLimit = 15000000n;
      try {
        const estimatedGas = await publicClient?.estimateContractGas({
          address: WALNUT_LENDING_ADDRESS,
          abi: walnutLendingAbi,
          functionName: "deposit",
          args: [WRAPPER_ADDRESS, encryptedAmountVal as any],
          account: account.address,
        });
        if (estimatedGas) {
          depositGasLimit = (estimatedGas * 130n) / 100n;
        }
      } catch (e) {
        console.warn("Deposit gas estimation fallback used", e);
      }

      const depositHash = await writeContractAsync({
        address: WALNUT_LENDING_ADDRESS,
        abi: walnutLendingAbi,
        functionName: "deposit",
        args: [WRAPPER_ADDRESS, encryptedAmountVal as any],
        gas: depositGasLimit,
        ...gasOverrides
      });

      setActiveTxHash(depositHash);
      setModalStage("mining");

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
        if (receipt.status !== "success") throw new Error("Deposit transaction reverted on-chain.");
      }

      setModalStage("completed");
      addToast({
        variant: "success",
        title: "Deposit Confirmed",
        message: `Successfully deposited $${(Number(parsedAmount) / 1e6).toFixed(2)} wUSDC as confidential collateral!`,
        txHash: depositHash
      });

      setAmount("");
      await refetchWUsdc();
      await refreshBalances();
      await protocol.refreshBalances();
    } catch (err: any) {
      console.error("Deposit Execution Failure:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setModalStage("failed");
      addToast({ variant: "error", title: "Deposit Reverted", message: msg });
    }
  };

  const formattedRawUsdc = rawUsdcBalance ? (Number(rawUsdcBalance) / 1e6).toFixed(2) : "0.00";
  const formattedWUsdc = wUsdcBalance ? (Number(wUsdcBalance) / 1e6).toFixed(2) : "0.00";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pb-6 border-b border-black/10">
        <h1 className="text-3xl font-bold tracking-tight text-black">Add Shielded Collateral</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          Deposit wUSDC collateral into WalnutLendingV2. Your collateral amounts are protected with homomorphic FHE encryption and zero plaintext exposure.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Main Panel */}
        <section className="md:col-span-2">
          <div className="bg-white border border-black/10 rounded-md p-6 space-y-8 shadow-none">
            
            {/* Unshielded Balance Box */}
            <div className="bg-slate-50 border border-black/5 rounded-md p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Unshielded Mock USDC Balance</p>
                  <p className="text-3xl font-bold text-black tracking-tight">${formattedRawUsdc} <span className="text-lg font-medium text-slate-400">USDC</span></p>
                </div>
                <Button
                  onClick={handleMintFaucet}
                  disabled={isMinting}
                  variant="outline"
                  className="bg-white border-black/10 text-black hover:bg-slate-50 font-medium rounded-md h-9 px-4 text-xs shadow-none"
                >
                  {isMinting ? "Minting..." : "+ Mint $1,000 Faucet"}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Input
                  value={shieldAmount}
                  onChange={(e) => setShieldAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Amount to shield to wUSDC..."
                  className="text-sm rounded-md h-11 border-black/10 bg-white focus-visible:ring-black/20 shadow-none"
                />
                <Button
                  onClick={handleShieldUSDC}
                  disabled={isShielding || parsedShieldAmount === 0n}
                  className="w-full sm:w-auto bg-black hover:bg-black/90 text-white font-medium h-11 px-6 rounded-md shrink-0 shadow-none"
                >
                  {isShielding ? "Shielding..." : "Shield to wUSDC"}
                </Button>
              </div>
            </div>

            {/* Collateral Token Box */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 ml-1">
                Collateral Token
              </label>
              <div className="bg-slate-50 border border-black/5 rounded-md p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-blue-200/60 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center font-bold text-blue-700 shadow-sm text-[11px] tracking-wide">
                    wUSDC
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black">wUSDC (Walnut Vault Wrapper)</p>
                    <p className="text-xs text-slate-500">Canonical Approved Vault Token</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                  Approved Vault <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Deposit Form */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Deposit Amount (wUSDC)
                </label>
                <span className="text-xs text-slate-500">
                  Shielded Balance: <span className="font-semibold text-black">${formattedWUsdc} wUSDC</span>
                </span>
              </div>
              
              <div className="relative">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="text-2xl font-semibold py-7 pl-4 pr-20 rounded-md border-black/10 bg-white focus-visible:ring-black/20 text-black placeholder:text-slate-300 shadow-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  wUSDC
                </div>
              </div>
              
              {/* Quick Presets */}
              <div className="flex gap-2">
                {[50, 100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="px-4 py-2 border border-black/10 bg-white rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-black transition-colors shadow-none"
                  >
                    ${v}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(formattedWUsdc)}
                  className="px-4 py-2 border border-black/10 bg-white rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-black transition-colors shadow-none"
                >
                  MAX
                </button>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleDeposit}
                  disabled={parsedAmount === 0n}
                  className="w-full bg-black hover:bg-black/90 text-white font-bold h-12 text-[15px] rounded-md shadow-none transition-all disabled:bg-slate-100 disabled:text-slate-400 gap-2 flex items-center justify-center"
                >
                  <Lock className="w-4 h-4" /> Deposit Shielded Collateral
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-md bg-white border border-black/10 shadow-none overflow-hidden">
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> FHE Privacy Guarantee
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your collateral is stored on-chain as an encrypted vault (FHE2B masked). Only your wallet holds the CoFHE permit key to view your balance.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-black/10 flex items-start gap-3">
              <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-700">CoFHE SECURED</p>
                <p className="text-[11px] text-slate-500 mt-0.5">End-to-end encrypted coprocessor</p>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-white border border-black/10 shadow-none">
            <div className="p-4 border-b border-black/10">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Vault Security Parameters</h4>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Vault Contract</span>
                <span className="font-semibold text-black font-mono">WalnutLendingV2</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Vault Whitelist</span>
                <span className="font-semibold text-slate-700">Active (wUSDC)</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Encryption Type</span>
                <span className="font-semibold text-slate-700">InEuint64</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Permit Model</span>
                <span className="font-semibold text-slate-700">CoFHE (Active)</span>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-white border border-black/10 shadow-none p-5">
            <h4 className="text-sm font-bold text-black">Need Help?</h4>
            <p className="text-xs text-slate-500 mt-1 mb-4">Read documentation or join our community</p>
            <div className="flex gap-2">
              <Button variant="outline" className="w-full bg-white border-black/10 text-black shadow-none rounded-md text-xs h-9 font-medium">
                Docs
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Multi-Step Progress Modal */}
      <TransactionProgressModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stage={modalStage}
        currentStepIndex={currentStepIndex}
        steps={DEPOSIT_STEPS}
        txHash={activeTxHash}
        errorMessage={errorMessage}
        title="Deposit Progress"
      />
    </div>
  );
}
