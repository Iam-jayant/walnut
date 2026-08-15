"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { ShieldAlert, Lock, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
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
} from "@/lib/walnut-contract";

const WITHDRAW_STEPS: StepItem[] = [
  { id: "encrypt", label: "1. FHE Input Encryption", description: "Encrypting withdrawal amount into euint128 via CoFHE ZK engine." },
  { id: "withdraw", label: "2. Protocol Withdrawal", description: "Broadcasting confidential withdrawal to WalnutLendingV2." },
  { id: "health_check", label: "3. Homomorphic Health Check", description: "Contract verifies position health and releases wUSDC collateral." },
];

export default function WithdrawPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();

  const [amount, setAmount] = useState("");
  const [unshieldAmount, setUnshieldAmount] = useState("");
  
  // Progress modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<TransactionStage>("zk_encrypt");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isUnshielding, setIsUnshielding] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Read wUSDC Balance
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

  const parsedUnshieldAmount = useMemo(() => {
    if (!unshieldAmount || !/^\d+(\.\d+)?$/.test(unshieldAmount)) return 0n;
    try {
      const parts = unshieldAmount.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = (parts[1] || '').padEnd(6, '0').slice(0, 6);
      return BigInt(integerPart + decimalPart);
    } catch { return 0n; }
  }, [unshieldAmount]);

  const hasActiveLoan = protocol.hasActiveLoan;

  // Unshield Handler (wUSDC -> Raw MockUSDC)
  const handleUnshieldUSDC = async () => {
    if (!account.address || parsedUnshieldAmount === 0n) return;
    setIsUnshielding(true);
    try {
      addToast({ variant: "pending", title: "Unshielding Collateral", message: "Broadcasting unshield request to WalnutVaultWrapper..." });

      const gasOverrides = await getGasFeeOverrides(publicClient);

      const unshieldHash = await writeContractAsync({
        address: WRAPPER_ADDRESS,
        abi: walnutWrapperAbi,
        functionName: "unshield",
        args: [account.address, account.address, parsedUnshieldAmount],
        ...gasOverrides
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: unshieldHash });

      addToast({
        variant: "success",
        title: "Unshield Request Placed",
        message: `Unshield request submitted! Your wUSDC is pending unshielding back to raw USDC.`,
        txHash: unshieldHash
      });

      setUnshieldAmount("");
      await refetchWUsdc();
    } catch (err: any) {
      addToast({ variant: "error", title: "Unshield Failed", message: err?.message || err });
    } finally {
      setIsUnshielding(false);
    }
  };

  // Main Withdraw Handler
  const handleWithdraw = async () => {
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
          items: [Encryptable.uint128(parsedAmount)],
          account: account.address,
          chainId: walnutChainId,
        });
        encryptedAmountVal = encAmount;
      } catch (err) {
        console.error("FHE Encryption error", err);
        throw new Error("Withdrawal input encryption failed. Please verify your CoFHE wallet connection.");
      }

      // ----------------------------------------------------
      // STEP 2: PROTOCOL WITHDRAWAL
      // ----------------------------------------------------
      setModalStage("wallet_sign");
      setCurrentStepIndex(1);

      let withdrawGasLimit = 15000000n;
      try {
        const estimatedGas = await publicClient?.estimateContractGas({
          address: WALNUT_LENDING_ADDRESS,
          abi: walnutLendingAbi,
          functionName: "withdraw",
          args: [WRAPPER_ADDRESS, encryptedAmountVal as any],
          account: account.address,
        });
        if (estimatedGas) {
          withdrawGasLimit = (estimatedGas * 130n) / 100n;
        }
      } catch (e) {
        console.warn("Withdraw gas estimation fallback used", e);
      }

      const withdrawHash = await writeContractAsync({
        address: WALNUT_LENDING_ADDRESS,
        abi: walnutLendingAbi,
        functionName: "withdraw",
        args: [WRAPPER_ADDRESS, encryptedAmountVal as any],
        gas: withdrawGasLimit,
        ...gasOverrides
      });

      setActiveTxHash(withdrawHash);
      setModalStage("mining");
      setCurrentStepIndex(2);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
        if (receipt.status !== "success") throw new Error("Withdraw transaction reverted on-chain.");
      }

      setModalStage("completed");
      addToast({
        variant: "success",
        title: "Withdrawal Confirmed",
        message: `Withdrawal transaction mined! Homomorphic health check verified your position safety.`,
        txHash: withdrawHash
      });

      setAmount("");
      await refetchWUsdc();
      await protocol.refreshBalances();
    } catch (err: any) {
      console.error("Withdrawal Execution Failure:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setModalStage("failed");
      addToast({ variant: "error", title: "Withdrawal Reverted", message: msg });
    }
  };

  const formattedWUsdc = wUsdcBalance ? (Number(wUsdcBalance) / 1e6).toFixed(2) : "0.00";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pb-6 border-b border-black/5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Withdraw Collateral</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Withdraw wUSDC collateral from WalnutLendingV2. The contract homomorphically caps withdrawals to maintain safe LTV ratios without disclosing your position.
          </p>
        </div>
      </div>

      {hasActiveLoan && (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-900 block mb-0.5">Active Borrow Position Detected</strong>
            <span className="text-amber-800/80">Withdrawal requests that would push your account position unhealthy are homomorphically capped to zero by the contract.</span>
          </div>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        {/* Main Panel */}
        <section className="md:col-span-2">
          <div className="bg-white border border-black/10 rounded-md p-6 space-y-8 shadow-none">
            
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

            {/* Withdraw Form */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Withdrawal Amount (wUSDC)
                </label>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full">
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="text-sm h-11 pr-16 rounded-md border-black/10 bg-white focus-visible:ring-black/20 text-black placeholder:text-slate-400 shadow-none"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                    wUSDC
                  </div>
                </div>
                
                <Button
                  onClick={handleWithdraw}
                  disabled={parsedAmount === 0n}
                  className="w-full sm:w-auto bg-black hover:bg-black/90 text-white font-medium h-11 px-6 rounded-md shadow-none shrink-0 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Withdraw Collateral
                </Button>
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
              </div>
            </div>

            {/* Unshield Section */}
            <div className="bg-slate-50 border border-black/5 rounded-md p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Unshield wUSDC</p>
                  <p className="text-3xl font-bold text-black tracking-tight">${formattedWUsdc} <span className="text-lg font-medium text-slate-400">wUSDC</span></p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Input
                  value={unshieldAmount}
                  onChange={(e) => setUnshieldAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Amount to unshield to USDC..."
                  className="text-sm rounded-md h-11 border-black/10 bg-white focus-visible:ring-black/20 shadow-none"
                />
                <Button
                  onClick={handleUnshieldUSDC}
                  disabled={isUnshielding || parsedUnshieldAmount === 0n}
                  className="w-full sm:w-auto bg-black hover:bg-black/90 text-white font-medium h-11 px-6 rounded-md shrink-0 shadow-none"
                >
                  {isUnshielding ? "Processing..." : "Unshield to USDC"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Info Sidebar */}
        <aside className="space-y-6">
          <div className="p-5 rounded-md bg-white border border-black/5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-400" /> Health Factor Safety
            </h3>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              WalnutLendingV2 computes your maximum safe withdrawal limit on encrypted balances using CoFHE. If a requested withdrawal breaches the 80% LTV threshold, the contract automatically zeroes the withdrawn amount.
            </p>
          </div>

          <div className="p-5 rounded-md bg-white border border-black/5 shadow-sm space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Security Parameters</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Contract</span>
                <span className="font-medium text-black">WalnutLendingV2</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Vault Asset</span>
                <span className="font-medium text-black">wUSDC</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Encryption</span>
                <span className="font-medium text-black">InEuint128</span>
              </div>
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
        steps={WITHDRAW_STEPS}
        txHash={activeTxHash}
        errorMessage={errorMessage}
        title="Withdraw Progress"
      />
    </div>
  );
}
